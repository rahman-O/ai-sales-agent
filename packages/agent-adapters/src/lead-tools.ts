import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';

const OPEN = `('NEW','ENGAGED','QUALIFIED','NURTURE')`;

type LeadRow = {
  id: string;
  customer_id: string;
  status: string;
  primary_service_id: string | null;
  location_id: string | null;
  need_summary: string | null;
  preferred_contact_channel: string | null;
  language: string | null;
  urgency: string | null;
  version: number;
  created_at: Date;
};

function deriveQualification(
  lead: LeadRow,
  activeLocationCount: number,
): 'INCOMPLETE' | 'SUFFICIENT' {
  if (!lead.primary_service_id) return 'INCOMPLETE';
  if (activeLocationCount > 1 && !lead.location_id) return 'INCOMPLETE';
  if (!lead.need_summary?.trim()) return 'INCOMPLETE';
  if (!lead.preferred_contact_channel?.trim()) return 'INCOMPLETE';
  return 'SUFFICIENT';
}

async function locationCount(c: PoolClient, org: string): Promise<number> {
  const r = await c.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM locations
     WHERE organization_id=$1 AND active=true AND archived_at IS NULL`,
    [org],
  );
  return r.rows[0]?.n ?? 0;
}

async function dto(c: PoolClient, org: string, lead: LeadRow) {
  const activeLocationCount = await locationCount(c, org);
  return {
    id: lead.id,
    customerId: lead.customer_id,
    status: lead.status,
    primaryServiceId: lead.primary_service_id,
    locationId: lead.location_id,
    needSummary: lead.need_summary,
    preferredContactChannel: lead.preferred_contact_channel,
    language: lead.language,
    urgency: lead.urgency,
    version: lead.version,
    qualificationState: deriveQualification(lead, activeLocationCount),
  };
}

async function activity(
  c: PoolClient,
  org: string,
  leadId: string,
  type: string,
  actorType: string,
  actorId: string | null,
  meta: Record<string, unknown>,
  agentRunId?: string | null,
  conversationId?: string | null,
) {
  await c.query(
    `INSERT INTO lead_activities(
       id, organization_id, lead_id, type, actor_type, actor_id,
       source_conversation_id, source_agent_run_id, metadata_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      randomUUID(),
      org,
      leadId,
      type,
      actorType,
      actorId,
      conversationId ?? null,
      agentRunId ?? null,
      JSON.stringify(meta),
    ],
  );
}

export async function toolGetLead(
  c: PoolClient,
  org: string,
  customerId: string,
  args: { leadId?: string; serviceId?: string },
): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
  if (args.leadId) {
    const r = await c.query<LeadRow>(
      `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
              preferred_contact_channel, language, urgency, version, created_at
       FROM leads WHERE organization_id=$1 AND id=$2`,
      [org, args.leadId],
    );
    const lead = r.rows[0];
    if (!lead || lead.customer_id !== customerId) return { ok: false, code: 'NOT_FOUND' };
    return { ok: true, data: await dto(c, org, lead) };
  }
  const open = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads
     WHERE organization_id=$1 AND customer_id=$2 AND status IN ${OPEN}
     ORDER BY created_at ASC`,
    [org, customerId],
  );
  if (args.serviceId) {
    const match = open.rows.find((l) => l.primary_service_id === args.serviceId);
    if (!match) return { ok: false, code: 'NOT_FOUND' };
    return { ok: true, data: await dto(c, org, match) };
  }
  if (open.rows.length === 0) return { ok: false, code: 'NOT_FOUND' };
  if (open.rows.length > 1) return { ok: false, code: 'AMBIGUOUS_LEAD' };
  return { ok: true, data: await dto(c, org, open.rows[0]!) };
}

export async function toolEnsureLead(
  c: PoolClient,
  org: string,
  customerId: string,
  args: {
    serviceId?: string;
    needSummary?: string;
    preferredContactChannel?: string;
    language?: string;
    locationId?: string;
  },
  ctx: { conversationId: string; agentRunId: string },
): Promise<{ ok: true; data: unknown } | { ok: false; code: string; safeMessage?: string }> {
  const serviceId = typeof args.serviceId === 'string' ? args.serviceId : null;
  if (serviceId) {
    const svc = await c.query(
      `SELECT id FROM services
       WHERE organization_id=$1 AND id=$2 AND active=true AND archived_at IS NULL`,
      [org, serviceId],
    );
    if (!svc.rows[0]) return { ok: false, code: 'NOT_FOUND', safeMessage: 'invalid_service' };
  }

  const open = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads
     WHERE organization_id=$1 AND customer_id=$2 AND status IN ${OPEN}
     ORDER BY created_at ASC
     FOR UPDATE`,
    [org, customerId],
  );

  if (serviceId) {
    const serviceOpen = open.rows.find((l) => l.primary_service_id === serviceId);
    const genericOpen = open.rows.find((l) => l.primary_service_id === null);

    if (serviceOpen && genericOpen) {
      const sorted = [genericOpen, serviceOpen].sort(
        (a, b) =>
          a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id),
      );
      const winner = sorted[0]!;
      const loser = sorted[1]!;
      await c.query(
        `UPDATE leads SET
           status='ARCHIVED', status_reason_code='MERGED_DUPLICATE_OPEN_LEAD',
           status_changed_at=now(), status_changed_by_type='SYSTEM',
           archived_at=now(), version=version+1, updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [org, loser.id],
      );
      await activity(c, org, loser.id, 'MERGED_DUPLICATE', 'SYSTEM', null, {
        reasonCode: 'MERGED_DUPLICATE_OPEN_LEAD',
        canonicalLeadId: winner.id,
      }, ctx.agentRunId, ctx.conversationId);
      await c.query(
        `UPDATE leads SET
           primary_service_id=$3,
           location_id=COALESCE(location_id, $4),
           need_summary=COALESCE(need_summary, $5),
           preferred_contact_channel=COALESCE(preferred_contact_channel, $6),
           language=COALESCE(language, $7),
           version=version+1, updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [
          org,
          winner.id,
          serviceId,
          args.locationId ?? null,
          args.needSummary?.slice(0, 2000) ?? null,
          args.preferredContactChannel?.slice(0, 64) ?? null,
          args.language?.slice(0, 16) ?? null,
        ],
      );
      await activity(c, org, winner.id, 'MERGED_DUPLICATE', 'AGENT', null, {
        reasonCode: 'MERGED_DUPLICATE_OPEN_LEAD',
        archivedLeadId: loser.id,
      }, ctx.agentRunId, ctx.conversationId);
      const r = await c.query<LeadRow>(
        `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
                preferred_contact_channel, language, urgency, version, created_at
         FROM leads WHERE organization_id=$1 AND id=$2`,
        [org, winner.id],
      );
      return { ok: true, data: { ...(await dto(c, org, r.rows[0]!)), created: false } };
    }

    if (serviceOpen) {
      return { ok: true, data: { ...(await dto(c, org, serviceOpen)), created: false } };
    }

    if (genericOpen) {
      await c.query(
        `UPDATE leads SET
           primary_service_id=$3,
           location_id=COALESCE(location_id, $4),
           need_summary=COALESCE(need_summary, $5),
           preferred_contact_channel=COALESCE(preferred_contact_channel, $6),
           language=COALESCE(language, $7),
           version=version+1, updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [
          org,
          genericOpen.id,
          serviceId,
          args.locationId ?? null,
          args.needSummary?.slice(0, 2000) ?? null,
          args.preferredContactChannel?.slice(0, 64) ?? null,
          args.language?.slice(0, 16) ?? null,
        ],
      );
      await activity(
        c,
        org,
        genericOpen.id,
        'SERVICE_INTEREST_CHANGED',
        'AGENT',
        null,
        { from: null, to: serviceId, promotion: 'generic_to_service' },
        ctx.agentRunId,
        ctx.conversationId,
      );
      const r = await c.query<LeadRow>(
        `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
                preferred_contact_channel, language, urgency, version, created_at
         FROM leads WHERE organization_id=$1 AND id=$2`,
        [org, genericOpen.id],
      );
      return { ok: true, data: { ...(await dto(c, org, r.rows[0]!)), created: false } };
    }
  } else {
    const generic = open.rows.filter((l) => l.primary_service_id === null);
    if (generic.length === 1) {
      return { ok: true, data: { ...(await dto(c, org, generic[0]!)), created: false } };
    }
    if (generic.length > 1 || open.rows.length > 1) {
      return { ok: false, code: 'AMBIGUOUS_LEAD' };
    }
  }

  const id = randomUUID();
  try {
    await c.query(
      `INSERT INTO leads(
         id, organization_id, customer_id, status, primary_service_id, location_id,
         need_summary, preferred_contact_channel, language, source_type,
         source_conversation_id, created_by_agent_run_id, status_changed_by_type
       ) VALUES ($1,$2,$3,'NEW',$4,$5,$6,$7,$8,'INBOUND_CONVERSATION',$9,$10,'AGENT')`,
      [
        id,
        org,
        customerId,
        serviceId,
        args.locationId ?? null,
        args.needSummary?.slice(0, 2000) ?? null,
        args.preferredContactChannel?.slice(0, 64) ?? null,
        args.language?.slice(0, 16) ?? null,
        ctx.conversationId,
        ctx.agentRunId,
      ],
    );
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (msg.includes('leads_one_') || msg.includes('unique')) {
      const existing = await c.query<LeadRow>(
        `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
                preferred_contact_channel, language, urgency, version, created_at
         FROM leads
         WHERE organization_id=$1 AND customer_id=$2 AND status IN ${OPEN}
           AND (($3::uuid IS NULL AND primary_service_id IS NULL)
                OR primary_service_id = $3::uuid)
         ORDER BY created_at ASC LIMIT 1`,
        [org, customerId, serviceId],
      );
      if (existing.rows[0]) {
        return { ok: true, data: { ...(await dto(c, org, existing.rows[0])), created: false } };
      }
    }
    throw e;
  }
  await activity(
    c,
    org,
    id,
    'LEAD_CREATED',
    'AGENT',
    null,
    { status: 'NEW', primaryServiceId: serviceId },
    ctx.agentRunId,
    ctx.conversationId,
  );
  const r = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads WHERE organization_id=$1 AND id=$2`,
    [org, id],
  );
  return { ok: true, data: { ...(await dto(c, org, r.rows[0]!)), created: true } };
}

const AI_TRANSITIONS = new Set([
  'NEW>ENGAGED',
  'NEW>NURTURE',
  'ENGAGED>QUALIFIED',
  'ENGAGED>NURTURE',
  'QUALIFIED>NURTURE',
  'NURTURE>ENGAGED',
  'NURTURE>QUALIFIED',
]);

export async function toolTransitionLead(
  c: PoolClient,
  org: string,
  customerId: string,
  args: { leadId: string; expectedVersion: number; toStatus: string },
  ctx: { conversationId: string; agentRunId: string },
): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 1) {
    return { ok: false, code: 'INVALID_ARGS' };
  }
  if (args.toStatus === 'ARCHIVED' || args.toStatus === 'DISQUALIFIED') {
    return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
  }
  const r = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
    [org, args.leadId],
  );
  const lead = r.rows[0];
  if (!lead || lead.customer_id !== customerId) return { ok: false, code: 'NOT_FOUND' };
  if (lead.version !== args.expectedVersion) return { ok: false, code: 'VERSION_CONFLICT' };
  if (!AI_TRANSITIONS.has(`${lead.status}>${args.toStatus}`)) {
    return { ok: false, code: 'INVALID_TRANSITION' };
  }
  const upd = await c.query(
    `UPDATE leads SET
       status=$4, status_changed_at=now(), status_changed_by_type='AGENT',
       status_changed_by_id=$5, version=version+1, updated_at=now()
     WHERE organization_id=$1 AND id=$2 AND version=$3
     RETURNING id`,
    [org, args.leadId, args.expectedVersion, args.toStatus, ctx.agentRunId],
  );
  if (!upd.rows[0]) return { ok: false, code: 'VERSION_CONFLICT' };
  await activity(
    c,
    org,
    args.leadId,
    'STATUS_CHANGED',
    'AGENT',
    null,
    { from: lead.status, to: args.toStatus },
    ctx.agentRunId,
    ctx.conversationId,
  );
  const after = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads WHERE organization_id=$1 AND id=$2`,
    [org, args.leadId],
  );
  return { ok: true, data: await dto(c, org, after.rows[0]!) };
}

export async function toolUpdateLeadQualification(
  c: PoolClient,
  org: string,
  customerId: string,
  args: {
    leadId: string;
    expectedVersion: number;
    needSummary?: string;
    preferredContactChannel?: string;
    language?: string;
    locationId?: string;
    serviceId?: string;
  },
  ctx: { conversationId: string; agentRunId: string },
): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 1) {
    return { ok: false, code: 'INVALID_ARGS' };
  }
  const r = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
    [org, args.leadId],
  );
  const lead = r.rows[0];
  if (!lead || lead.customer_id !== customerId) return { ok: false, code: 'NOT_FOUND' };
  if (lead.version !== args.expectedVersion) return { ok: false, code: 'VERSION_CONFLICT' };
  if (!['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'].includes(lead.status)) {
    return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
  }

  // AI must not overwrite non-null human-owned fields
  const needSummary =
    lead.need_summary != null
      ? lead.need_summary
      : args.needSummary?.slice(0, 2000) ?? lead.need_summary;
  const preferred =
    lead.preferred_contact_channel != null
      ? lead.preferred_contact_channel
      : args.preferredContactChannel?.slice(0, 64) ?? lead.preferred_contact_channel;
  const language =
    lead.language != null ? lead.language : args.language?.slice(0, 16) ?? lead.language;
  const locationId =
    lead.location_id != null ? lead.location_id : args.locationId ?? lead.location_id;

  if (args.serviceId && !lead.primary_service_id) {
    const ensured = await toolEnsureLead(
      c,
      org,
      customerId,
      {
        serviceId: args.serviceId,
        needSummary: needSummary ?? undefined,
        preferredContactChannel: preferred ?? undefined,
        language: language ?? undefined,
        locationId: locationId ?? undefined,
      },
      ctx,
    );
    if (!ensured.ok) return ensured;
    return ensured;
  }
  if (args.serviceId && lead.primary_service_id && args.serviceId !== lead.primary_service_id) {
    // AI cannot change established service arbitrarily — reject
    return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
  }

  const upd = await c.query(
    `UPDATE leads SET
       need_summary=$4,
       preferred_contact_channel=$5,
       language=$6,
       location_id=$7,
       version=version+1, updated_at=now()
     WHERE organization_id=$1 AND id=$2 AND version=$3
     RETURNING id`,
    [org, args.leadId, args.expectedVersion, needSummary, preferred, language, locationId],
  );
  if (!upd.rows[0]) return { ok: false, code: 'VERSION_CONFLICT' };
  await activity(
    c,
    org,
    args.leadId,
    'QUALIFICATION_UPDATED',
    'AGENT',
    null,
    { fields: Object.keys(args).filter((k) => !['leadId', 'expectedVersion'].includes(k)) },
    ctx.agentRunId,
    ctx.conversationId,
  );
  const after = await c.query<LeadRow>(
    `SELECT id, customer_id, status, primary_service_id, location_id, need_summary,
            preferred_contact_channel, language, urgency, version, created_at
     FROM leads WHERE organization_id=$1 AND id=$2`,
    [org, args.leadId],
  );
  return { ok: true, data: await dto(c, org, after.rows[0]!) };
}

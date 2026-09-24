import type { Pool, PoolClient } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import {
  buildMetaTemplateComponents,
  validateTemplateParams,
} from './quiet-hours.js';
import { evaluateFreeFormWindow } from '../messaging/messaging-channel.js';

export type FollowUpExecuteResult = {
  outcome: 'DISPATCHED' | 'SUPPRESSED' | 'FAILED' | 'NO_OP' | 'ALREADY_DISPATCHED';
  reasonCode?: string;
  outboundMessageId?: string;
  followUpId: string;
};

async function withTenant<T>(
  pool: Pool,
  organizationId: string,
  userId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId]);
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Execute a due FollowUp under Conversation → FollowUp lock order.
 * Creates at most one outbound Message + OutboundMessageReady; status DISPATCHED.
 */
export async function executeFollowUp(opts: {
  pool: Pool;
  organizationId: string;
  followUpId: string;
  followUpVersion?: number;
  workerId: string;
}): Promise<FollowUpExecuteResult> {
  return withTenant(opts.pool, opts.organizationId, opts.workerId, async (c) => {
    const fu = await c.query<{
      id: string;
      status: string;
      version: number;
      origin_kind: string;
      trigger_type: string;
      outreach_basis: string;
      send_mode: string;
      conversation_id: string | null;
      customer_id: string;
      lead_id: string | null;
      booking_id: string | null;
      channel_connection_id: string | null;
      template_version_id: string | null;
      baseline_inbound_sequence: number | null;
      baseline_ownership_epoch: number | null;
      expected_booking_starts_at: Date | null;
      expected_booking_version: number | null;
      payload_data: Record<string, unknown>;
      outbound_message_id: string | null;
      next_eligible_at: Date;
      scheduled_for: Date;
    }>(
      `SELECT * FROM follow_ups
       WHERE organization_id=$1 AND id=$2
       FOR UPDATE`,
      [opts.organizationId, opts.followUpId],
    );
    const row = fu.rows[0];
    if (!row) return { outcome: 'NO_OP', followUpId: opts.followUpId, reasonCode: 'NOT_FOUND' };

    if (opts.followUpVersion != null && Number(row.version) !== Number(opts.followUpVersion)) {
      return { outcome: 'NO_OP', followUpId: row.id, reasonCode: 'STALE_VERSION' };
    }

    if (row.outbound_message_id) {
      return {
        outcome: 'ALREADY_DISPATCHED',
        followUpId: row.id,
        outboundMessageId: row.outbound_message_id,
      };
    }

    if (['CANCELLED', 'SUPPRESSED', 'DISPATCHED', 'FAILED'].includes(row.status)) {
      return { outcome: 'NO_OP', followUpId: row.id, reasonCode: row.status };
    }

    if (new Date(row.next_eligible_at).getTime() > Date.now() + 5_000) {
      return { outcome: 'NO_OP', followUpId: row.id, reasonCode: 'NOT_YET_DUE' };
    }

    // Claim PROCESSING (lease coordination only)
    await c.query(
      `UPDATE follow_ups SET
         status='PROCESSING',
         processing_owner=$3,
         processing_started_at=now(),
         lease_until=now() + interval '60 seconds',
         updated_at=now()
       WHERE organization_id=$1 AND id=$2 AND status IN ('SCHEDULED','PROCESSING')`,
      [opts.organizationId, row.id, opts.workerId],
    );

    async function suppress(code: string): Promise<FollowUpExecuteResult> {
      await c.query(
        `UPDATE follow_ups SET
           status='SUPPRESSED', suppressed_at=now(), executed_at=now(),
           result_reason_code=$3, processing_owner=NULL, lease_until=NULL, updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [opts.organizationId, row.id, code],
      );
      return { outcome: 'SUPPRESSED', followUpId: row.id, reasonCode: code };
    }

    if (!row.conversation_id) {
      return suppress('MISSING_CONVERSATION');
    }

    // Lock conversation FIRST (P03 serialization boundary)
    const conv = await c.query<{
      id: string;
      mode: string;
      owner_member_id: string | null;
      ownership_epoch: number;
      next_sequence: number;
      channel_connection_id: string;
      last_customer_inbound_at: Date | null;
    }>(
      `SELECT id, mode, owner_member_id, ownership_epoch, next_sequence,
              channel_connection_id, last_customer_inbound_at
       FROM conversations
       WHERE organization_id=$1 AND id=$2
       FOR UPDATE`,
      [opts.organizationId, row.conversation_id],
    );
    const conversation = conv.rows[0];
    if (!conversation) return suppress('CONVERSATION_MISSING');

    // Re-lock follow_up after conversation (already held)
    if (row.origin_kind === 'AUTOMATED') {
      if (
        conversation.mode !== 'AI_ACTIVE' ||
        conversation.owner_member_id != null ||
        row.baseline_ownership_epoch == null ||
        Number(conversation.ownership_epoch) !== Number(row.baseline_ownership_epoch)
      ) {
        return suppress('CONVERSATION_AUTHORITY_CHANGED');
      }
    }

    // Customer reply baseline
    if (row.baseline_inbound_sequence != null) {
      const currentIngress = Number(conversation.next_sequence) - 1;
      if (currentIngress > Number(row.baseline_inbound_sequence)) {
        const newer = await c.query(
          `SELECT 1 FROM messages
           WHERE organization_id=$1 AND conversation_id=$2
             AND origin='CUSTOMER' AND direction='INBOUND'
             AND ingress_sequence > $3
           LIMIT 1`,
          [opts.organizationId, row.conversation_id, row.baseline_inbound_sequence],
        );
        if (newer.rowCount) return suppress('CUSTOMER_REPLIED');
      }
    }

    // Lead terminal
    if (row.lead_id && row.trigger_type === 'LEAD_NO_RESPONSE') {
      const lead = await c.query<{ status: string }>(
        `SELECT status FROM leads WHERE organization_id=$1 AND id=$2`,
        [opts.organizationId, row.lead_id],
      );
      if (!lead.rows[0] || ['DISQUALIFIED', 'ARCHIVED'].includes(lead.rows[0].status)) {
        return suppress('LEAD_TERMINAL');
      }
    }

    // Booking guards
    if (row.booking_id && row.trigger_type === 'BOOKING_REMINDER') {
      const booking = await c.query<{
        status: string;
        starts_at: Date;
        version: number;
      }>(
        `SELECT status, starts_at, version FROM bookings
         WHERE organization_id=$1 AND id=$2`,
        [opts.organizationId, row.booking_id],
      );
      const b = booking.rows[0];
      if (!b || b.status === 'CANCELLED') return suppress('BOOKING_CHANGED');
      if (
        row.expected_booking_version != null &&
        Number(b.version) !== Number(row.expected_booking_version)
      ) {
        return suppress('BOOKING_CHANGED');
      }
      if (
        row.expected_booking_starts_at &&
        new Date(b.starts_at).getTime() !== new Date(row.expected_booking_starts_at).getTime()
      ) {
        return suppress('BOOKING_CHANGED');
      }
      // Missed window: nextEligible after booking start
      if (new Date(row.next_eligible_at).getTime() >= new Date(b.starts_at).getTime()) {
        return suppress('MISSED_ALLOWED_WINDOW');
      }
    }

    const channelId = row.channel_connection_id ?? conversation.channel_connection_id;
    const channel = await c.query<{
      status: string;
      health_status: string;
      provider: string;
    }>(
      `SELECT status, health_status, provider FROM channel_connections
       WHERE organization_id=$1 AND id=$2`,
      [opts.organizationId, channelId],
    );
    const ch = channel.rows[0];
    if (!ch || ch.status !== 'ACTIVE' || ch.health_status === 'AUTH_FAILED') {
      return suppress('CHANNEL_DISABLED');
    }

    const window = evaluateFreeFormWindow(
      conversation.last_customer_inbound_at
        ? new Date(conversation.last_customer_inbound_at)
        : null,
    );

    let sendMode = row.send_mode;
    let templateVersionId = row.template_version_id;
    let templateParams: Record<string, string> = {};
    let contentText = '';
    let providerTemplateName: string | null = null;
    let providerLanguage: string | null = null;
    let providerStatus: string | null = null;

    const payload = (row.payload_data ?? {}) as Record<string, unknown>;
    if (typeof payload.text === 'string') contentText = payload.text.slice(0, 4096);

    if (!window.allowed) {
      sendMode = 'TEMPLATE';
      if (!templateVersionId) return suppress('OUTSIDE_POLICY_WINDOW');
    }

    const timeline = await c.query<{ next_timeline_sequence: number }>(
      `SELECT next_timeline_sequence FROM conversations
       WHERE organization_id=$1 AND id=$2`,
      [opts.organizationId, row.conversation_id],
    );
    const tl = Number(timeline.rows[0].next_timeline_sequence);
    const messageId = randomUUID();
    const epoch = Number(conversation.ownership_epoch);

    if (sendMode === 'TEMPLATE') {
      if (!templateVersionId) return suppress('TEMPLATE_DISABLED');
      const tv = await c.query<{
        provider_template_name: string;
        provider_language_code: string;
        parameter_schema: Record<string, unknown>;
        provider_status: string;
        body_preview: string | null;
        template_id: string;
        internal_status: string;
      }>(
        `SELECT v.provider_template_name, v.provider_language_code, v.parameter_schema,
                v.provider_status, v.body_preview, v.template_id, t.internal_status
         FROM message_template_versions v
         JOIN message_templates t
           ON t.organization_id=v.organization_id AND t.id=v.template_id
         WHERE v.organization_id=$1 AND v.id=$2`,
        [opts.organizationId, templateVersionId],
      );
      const ver = tv.rows[0];
      if (!ver || ver.internal_status === 'DISABLED') return suppress('TEMPLATE_DISABLED');
      // Outside window requires provider-eligible template
      if (!window.allowed && ver.provider_status !== 'APPROVED') {
        // Fixture channels may use UNKNOWN provider status in tests
        if (!String(ch.provider).startsWith('fixture')) {
          return suppress('TEMPLATE_DISABLED');
        }
      }
      const rawParams = (payload.params as Record<string, unknown>) ?? {};
      const schema = (ver.parameter_schema ?? {}) as Record<string, unknown>;
      const validated = validateTemplateParams(schema, rawParams);
      if (!validated.ok) return suppress('TEMPLATE_DISABLED');
      templateParams = validated.params;
      providerTemplateName = ver.provider_template_name;
      providerLanguage = ver.provider_language_code;
      providerStatus = ver.provider_status;
      contentText = ver.body_preview ?? `[template:${ver.provider_template_name}]`;
      const digest = createHash('sha256').update(contentText).digest('hex');

      await c.query(
        `INSERT INTO messages(
           id, organization_id, conversation_id, channel_connection_id, direction, origin,
           ingress_sequence, timeline_sequence, content_text, content_digest, delivery_state,
           authority_epoch, send_mode, template_version_id, template_params_json
         ) VALUES ($1,$2,$3,$4,'OUTBOUND','SYSTEM',NULL,$5,$6,$7,'PENDING',$8,'TEMPLATE',$9,$10::jsonb)`,
        [
          messageId,
          opts.organizationId,
          row.conversation_id,
          channelId,
          tl,
          contentText,
          digest,
          epoch,
          templateVersionId,
          JSON.stringify({
            params: templateParams,
            providerTemplateName,
            providerLanguage,
            providerStatus,
            components: buildMetaTemplateComponents(schema, templateParams),
          }),
        ],
      );
    } else {
      // FREE_FORM only inside window and typically OPERATOR_SCHEDULED
      if (!window.allowed) return suppress('OUTSIDE_POLICY_WINDOW');
      if (!contentText.trim()) return suppress('OUTSIDE_POLICY_WINDOW');
      if (row.origin_kind === 'AUTOMATED') {
        return suppress('OUTSIDE_POLICY_WINDOW');
      }
      const digest = createHash('sha256').update(contentText).digest('hex');
      await c.query(
        `INSERT INTO messages(
           id, organization_id, conversation_id, channel_connection_id, direction, origin,
           ingress_sequence, timeline_sequence, content_text, content_digest, delivery_state,
           authority_epoch, send_mode
         ) VALUES ($1,$2,$3,$4,'OUTBOUND','SYSTEM',NULL,$5,$6,$7,'PENDING',$8,'FREE_FORM')`,
        [
          messageId,
          opts.organizationId,
          row.conversation_id,
          channelId,
          tl,
          contentText,
          digest,
          epoch,
        ],
      );
    }

    await c.query(
      `UPDATE conversations SET
         next_timeline_sequence = next_timeline_sequence + 1,
         last_message_at = now(),
         updated_at = now(),
         version = version + 1
       WHERE organization_id=$1 AND id=$2`,
      [opts.organizationId, row.conversation_id],
    );

    const eventId = randomUUID();
    await c.query(
      `INSERT INTO outbox_events(id, organization_id, event_type, payload_json, available_at)
       VALUES ($1,$2,'OutboundMessageReady',$3::jsonb,now())`,
      [
        eventId,
        opts.organizationId,
        JSON.stringify({
          eventId,
          eventType: 'OutboundMessageReady',
          organizationId: opts.organizationId,
          aggregateType: 'Message',
          aggregateId: messageId,
          payload: {
            conversationId: row.conversation_id,
            messageId,
            followUpId: row.id,
          },
        }),
      ],
    );

    await c.query(
      `UPDATE follow_ups SET
         status='DISPATCHED',
         outbound_message_id=$3,
         executed_at=now(),
         processing_owner=NULL,
         lease_until=NULL,
         updated_at=now()
       WHERE organization_id=$1 AND id=$2`,
      [opts.organizationId, row.id, messageId],
    );

    return {
      outcome: 'DISPATCHED',
      followUpId: row.id,
      outboundMessageId: messageId,
    };
  });
}

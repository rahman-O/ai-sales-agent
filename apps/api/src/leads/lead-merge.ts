import { randomUUID } from 'node:crypto';
import {
  isOpenStatus,
  mergeMissingQualification,
  openKey,
  type MergeQualificationFields,
} from '../domain/lead-state.js';
import type { TenantTxClient } from '../database/tenant-context.service.js';

type LeadRow = {
  id: string;
  customerId: string;
  status: string;
  primaryServiceId: string | null;
  locationId: string | null;
  needSummary: string | null;
  preferredContactChannel: string | null;
  language: string | null;
  urgency: string | null;
  version: number;
  createdAt: Date;
};

function fieldsOf(l: LeadRow): MergeQualificationFields {
  return {
    primaryServiceId: l.primaryServiceId,
    locationId: l.locationId,
    needSummary: l.needSummary,
    preferredContactChannel: l.preferredContactChannel,
    language: l.language,
    urgency: l.urgency,
  };
}

async function appendActivity(
  tx: TenantTxClient,
  organizationId: string,
  leadId: string,
  type: string,
  metadataJson: Record<string, unknown>,
) {
  await tx.leadActivity.create({
    data: {
      id: randomUUID(),
      organizationId,
      leadId,
      type,
      actorType: 'SYSTEM',
      metadataJson,
    },
  });
}

/**
 * Resolve OPEN-lead collisions after customer merge reparent.
 * Callers must already hold FOR UPDATE locks on customers + open leads.
 * Archives losers FIRST, then reparents all surviving/historical leads.
 */
export async function resolveLeadMergeInTx(
  tx: TenantTxClient,
  organizationId: string,
  canonicalCustomerId: string,
  sourceCustomerId: string,
): Promise<void> {
  const openStatuses = ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'];

  const openLeads = (await tx.lead.findMany({
    where: {
      organizationId,
      customerId: { in: [canonicalCustomerId, sourceCustomerId] },
      status: { in: openStatuses },
    },
    orderBy: { id: 'asc' },
  })) as LeadRow[];

  // Group by post-merge open key (after reparent both map to canonical)
  const groups = new Map<string, LeadRow[]>();
  for (const lead of openLeads) {
    const key = openKey(canonicalCustomerId, lead.primaryServiceId);
    const list = groups.get(key) ?? [];
    list.push(lead);
    groups.set(key, list);
  }

  const archivedIds = new Set<string>();

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    const winner = sorted[0]!;
    let winnerFields = fieldsOf(winner);

    for (const loser of sorted.slice(1)) {
      winnerFields = mergeMissingQualification(winnerFields, fieldsOf(loser));
      await tx.lead.update({
        where: { organizationId_id: { organizationId, id: loser.id } },
        data: {
          status: 'ARCHIVED',
          statusReasonCode: 'MERGED_AFTER_CUSTOMER_MERGE',
          statusChangedAt: new Date(),
          statusChangedByType: 'SYSTEM',
          archivedAt: new Date(),
          version: { increment: 1 },
        },
      });
      archivedIds.add(loser.id);
      await appendActivity(tx, organizationId, loser.id, 'MERGED_DUPLICATE', {
        reasonCode: 'MERGED_AFTER_CUSTOMER_MERGE',
        canonicalLeadId: winner.id,
        sourceCustomerId,
        canonicalCustomerId,
      });
      await appendActivity(tx, organizationId, winner.id, 'MERGED_DUPLICATE', {
        reasonCode: 'MERGED_AFTER_CUSTOMER_MERGE',
        archivedLeadId: loser.id,
        sourceCustomerId,
        canonicalCustomerId,
      });
    }

    await tx.lead.update({
      where: { organizationId_id: { organizationId, id: winner.id } },
      data: {
        ...winnerFields,
        version: { increment: 1 },
      },
    });
  }

  // Reparent all non-archived-in-this-pass leads (including historical) from source → canonical
  await tx.lead.updateMany({
    where: {
      organizationId,
      customerId: sourceCustomerId,
      id: { notIn: [...archivedIds] },
    },
    data: { customerId: canonicalCustomerId, version: { increment: 1 } },
  });

  // Also reparent archived losers that still point at source (they stay archived)
  if (archivedIds.size) {
    await tx.lead.updateMany({
      where: {
        organizationId,
        id: { in: [...archivedIds] },
        customerId: sourceCustomerId,
      },
      data: { customerId: canonicalCustomerId },
    });
  }
}

export function isOpenLeadRow(status: string): boolean {
  return isOpenStatus(status);
}

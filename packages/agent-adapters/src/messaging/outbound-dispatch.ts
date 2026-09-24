import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  canTransitionDelivery,
  evaluateFreeFormWindow,
  type DeliveryState,
} from './messaging-channel.js';
import { MetaWhatsAppChannel } from './meta-whatsapp.channel.js';
import { META_WHATSAPP_PROVIDER } from './messaging-channel.js';

export type OutboundDispatchResult = {
  outcome:
    | 'ACCEPTED'
    | 'RETRY'
    | 'FAILED'
    | 'UNKNOWN'
    | 'SKIPPED'
    | 'POLICY_REJECTED'
    | 'SUPPRESSED';
  attemptId?: string;
  providerMessageId?: string;
  class?: string;
};

/**
 * Worker-owned outbound provider dispatch.
 * Application Message remains canonical; retries add OutboundAttempt rows only.
 * Never sends Meta Idempotency-Key (not proven for Messages API).
 *
 * P09: AI outbound requires mode=AI_ACTIVE and authority_epoch match before
 * PENDING→DISPATCHING. Already-DISPATCHING is not recallable after takeover.
 */
export async function dispatchOutboundMessage(
  c: PoolClient,
  organizationId: string,
  messageId: string,
  opts?: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv },
): Promise<OutboundDispatchResult> {
  const msg = await c.query(
    `SELECT m.id, m.conversation_id, m.channel_connection_id, m.content_text, m.delivery_state,
            m.provider_message_id, m.direction, m.origin, m.authority_epoch,
            m.send_mode, m.template_params_json,
            cc.provider, cc.external_channel_id, cc.status AS channel_status,
            cc.health_status, cc.credential_ref,
            conv.mode AS conversation_mode, conv.ownership_epoch AS conversation_epoch,
            conv.last_customer_inbound_at,
            ci.external_address
     FROM messages m
     JOIN channel_connections cc
       ON cc.organization_id = m.organization_id AND cc.id = m.channel_connection_id
     JOIN conversations conv
       ON conv.organization_id = m.organization_id AND conv.id = m.conversation_id
     JOIN customer_identities ci
       ON ci.organization_id = conv.organization_id AND ci.id = conv.identity_id
     WHERE m.organization_id = $1 AND m.id = $2
     FOR UPDATE OF m`,
    [organizationId, messageId],
  );
  const row = msg.rows[0];
  if (!row || row.direction !== 'OUTBOUND') return { outcome: 'SKIPPED' };

  // Already accepted by provider — do not resend
  if (row.provider_message_id && ['ACCEPTED', 'DELIVERED', 'READ'].includes(row.delivery_state)) {
    return { outcome: 'SKIPPED', providerMessageId: row.provider_message_id };
  }
  if (row.delivery_state === 'UNKNOWN') {
    // Ambiguous prior dispatch — no blind resend
    return { outcome: 'UNKNOWN' };
  }
  if (row.delivery_state === 'FAILED' || row.delivery_state === 'SUPPRESSED') {
    return { outcome: 'SKIPPED' };
  }

  // P09 pre-dispatch authority — only before NEW provider I/O from PENDING.
  // DISPATCHING may complete (in-flight cutover best-effort).
  if (row.delivery_state === 'PENDING') {
    const origin = String(row.origin);
    const mode = String(row.conversation_mode);
    const msgEpoch = row.authority_epoch == null ? null : Number(row.authority_epoch);
    const convEpoch = Number(row.conversation_epoch);

    if (origin === 'AI') {
      const ok = mode === 'AI_ACTIVE' && msgEpoch !== null && msgEpoch === convEpoch;
      if (!ok) {
        await c.query(
          `UPDATE messages SET delivery_state='SUPPRESSED'
           WHERE organization_id=$1 AND id=$2 AND delivery_state='PENDING'`,
          [organizationId, messageId],
        );
        return { outcome: 'SUPPRESSED', class: 'AUTHORITY_MISMATCH' };
      }
    } else if (origin === 'OPERATOR') {
      // Operator replies created under pause; reject if conversation returned to AI_ACTIVE
      // without a fresh OPERATOR create (stale reply after resume).
      if (mode === 'AI_ACTIVE' || (msgEpoch !== null && msgEpoch !== convEpoch)) {
        await c.query(
          `UPDATE messages SET delivery_state='SUPPRESSED'
           WHERE organization_id=$1 AND id=$2 AND delivery_state='PENDING'`,
          [organizationId, messageId],
        );
        return { outcome: 'SUPPRESSED', class: 'AUTHORITY_MISMATCH' };
      }
    }
    // SYSTEM: allowed while paused (handoff ack); still subject to care window below.
  }

  if (row.provider !== META_WHATSAPP_PROVIDER && row.provider !== 'whatsapp') {
    // Fixture / non-Meta: mark ACCEPTED locally for tests
    if (String(row.provider).startsWith('fixture') || row.external_channel_id?.startsWith('fixture:')) {
      await c.query(
        `UPDATE messages SET delivery_state='ACCEPTED'
         WHERE organization_id=$1 AND id=$2 AND delivery_state IN ('PENDING','DISPATCHING')`,
        [organizationId, messageId],
      );
      return { outcome: 'ACCEPTED', providerMessageId: `fake:${messageId}` };
    }
    return { outcome: 'SKIPPED' };
  }

  const window = evaluateFreeFormWindow(
    row.last_customer_inbound_at ? new Date(row.last_customer_inbound_at) : null,
  );
  const sendMode = String(row.send_mode ?? 'FREE_FORM');
  if (!window.allowed && sendMode !== 'TEMPLATE') {
    await c.query(
      `UPDATE messages SET delivery_state='FAILED'
       WHERE organization_id=$1 AND id=$2 AND delivery_state IN ('PENDING','DISPATCHING')`,
      [organizationId, messageId],
    );
    return { outcome: 'POLICY_REJECTED', class: 'POLICY_REJECTED' };
  }

  if (row.channel_status !== 'ACTIVE' || row.health_status === 'AUTH_FAILED') {
    await c.query(
      `UPDATE messages SET delivery_state='FAILED'
       WHERE organization_id=$1 AND id=$2 AND delivery_state IN ('PENDING','DISPATCHING')`,
      [organizationId, messageId],
    );
    return { outcome: 'FAILED', class: 'AUTH_FAILURE' };
  }

  // Re-check AI authority under same claim immediately before DISPATCHING transition
  if (row.origin === 'AI' && row.delivery_state === 'PENDING') {
    const live = await c.query(
      `SELECT conv.mode, conv.ownership_epoch, m.authority_epoch
       FROM messages m
       JOIN conversations conv
         ON conv.organization_id = m.organization_id AND conv.id = m.conversation_id
       WHERE m.organization_id=$1 AND m.id=$2
       FOR UPDATE OF m`,
      [organizationId, messageId],
    );
    const liveRow = live.rows[0];
    if (
      !liveRow ||
      liveRow.mode !== 'AI_ACTIVE' ||
      liveRow.authority_epoch == null ||
      Number(liveRow.authority_epoch) !== Number(liveRow.ownership_epoch)
    ) {
      await c.query(
        `UPDATE messages SET delivery_state='SUPPRESSED'
         WHERE organization_id=$1 AND id=$2 AND delivery_state='PENDING'`,
        [organizationId, messageId],
      );
      return { outcome: 'SUPPRESSED', class: 'AUTHORITY_MISMATCH' };
    }
  }

  const attemptNo = await c.query(
    `SELECT COALESCE(MAX(attempt_number), 0)::int AS n FROM outbound_attempts
     WHERE organization_id=$1 AND message_id=$2`,
    [organizationId, messageId],
  );
  const nextAttempt = Number(attemptNo.rows[0].n) + 1;
  const attemptId = randomUUID();
  const attemptEpoch =
    row.authority_epoch == null ? Number(row.conversation_epoch) : Number(row.authority_epoch);

  const claimed = await c.query(
    `UPDATE messages SET delivery_state='DISPATCHING'
     WHERE organization_id=$1 AND id=$2 AND delivery_state IN ('PENDING','DISPATCHING')
     RETURNING id`,
    [organizationId, messageId],
  );
  if (!claimed.rowCount) {
    return { outcome: 'SKIPPED' };
  }

  await c.query(
    `INSERT INTO outbound_attempts(
       id, organization_id, message_id, attempt_number, ownership_epoch, status, dispatched_at
     ) VALUES ($1,$2,$3,$4,$5,'DISPATCHING',now())`,
    [attemptId, organizationId, messageId, nextAttempt, attemptEpoch],
  );

  const channel = new MetaWhatsAppChannel();
  const templateMeta =
    sendMode === 'TEMPLATE' && row.template_params_json
      ? (row.template_params_json as {
          providerTemplateName?: string;
          providerLanguage?: string;
          components?: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>;
        })
      : null;
  const result = await channel.send(
    {
      organizationId,
      channelConnectionId: row.channel_connection_id,
      messageId,
      phoneNumberId: row.external_channel_id,
      toE164: row.external_address,
      text: row.content_text,
      credentialRef: row.credential_ref,
      sendMode: sendMode === 'TEMPLATE' ? 'TEMPLATE' : 'FREE_FORM',
      template:
        templateMeta?.providerTemplateName
          ? {
              name: String(templateMeta.providerTemplateName),
              languageCode: String(templateMeta.providerLanguage ?? 'ar'),
              components: templateMeta.components ?? [],
            }
          : undefined,
    },
    { fetchImpl: opts?.fetchImpl, env: opts?.env },
  );

  if (result.ok) {
    // Persist wamid before marking ACCEPTED — crash between these is still single Message
    await c.query(
      `UPDATE outbound_attempts SET status='ACCEPTED', provider_message_id=$3, accepted_at=now()
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, attemptId, result.providerMessageId],
    );
    await c.query(
      `UPDATE messages SET delivery_state='ACCEPTED', provider_message_id=$3
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, messageId, result.providerMessageId],
    );
    return {
      outcome: 'ACCEPTED',
      attemptId,
      providerMessageId: result.providerMessageId,
      class: 'SUCCESS',
    };
  }

  if (result.class === 'AMBIGUOUS_DISPATCH') {
    await c.query(
      `UPDATE outbound_attempts SET status='UNKNOWN', error_text=$3
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, attemptId, result.safeMessage ?? 'ambiguous'],
    );
    await c.query(
      `UPDATE messages SET delivery_state='UNKNOWN'
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, messageId],
    );
    return { outcome: 'UNKNOWN', attemptId, class: result.class };
  }

  if (result.class === 'DEFINITE_TRANSIENT_FAILURE' || result.class === 'RATE_LIMITED') {
    await c.query(
      `UPDATE outbound_attempts SET status='FAILED', error_text=$3
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, attemptId, result.safeMessage ?? result.class],
    );
    // Leave message PENDING for retry via outbox redelivery / sweeper
    await c.query(
      `UPDATE messages SET delivery_state='PENDING'
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, messageId],
    );
    return { outcome: 'RETRY', attemptId, class: result.class };
  }

  if (result.class === 'AUTH_FAILURE') {
    await c.query(
      `UPDATE channel_connections SET health_status='AUTH_FAILED', updated_at=now()
       WHERE organization_id=$1 AND id=$2`,
      [organizationId, row.channel_connection_id],
    );
  }

  await c.query(
    `UPDATE outbound_attempts SET status='FAILED', error_text=$3
     WHERE organization_id=$1 AND id=$2`,
    [organizationId, attemptId, result.safeMessage ?? result.class],
  );
  await c.query(
    `UPDATE messages SET delivery_state='FAILED'
     WHERE organization_id=$1 AND id=$2`,
    [organizationId, messageId],
  );
  return { outcome: 'FAILED', attemptId, class: result.class };
}

export function applyDeliveryTransition(
  from: string,
  to: DeliveryState,
): { applied: boolean; state: DeliveryState } {
  if (!canTransitionDelivery(from, to)) {
    return { applied: false, state: from as DeliveryState };
  }
  return { applied: true, state: to };
}

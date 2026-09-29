import type { TransportOutcomeClass } from './messaging-channel.js';

export const PROVIDER_MAX_ATTEMPTS = 4;
export const PROVIDER_RETRY_BACKOFF_MS = 5_000;

export type ProviderMetricName =
  | 'provider_webhooks_received'
  | 'provider_webhooks_rejected'
  | 'provider_duplicate_events'
  | 'provider_inbound_processed'
  | 'provider_outbound_attempts'
  | 'provider_outbound_success'
  | 'provider_outbound_failure'
  | 'provider_rate_limit_errors'
  | 'provider_auth_errors'
  | 'provider_timeouts';

const counters = new Map<string, number>();

/** Process-local operational counters. Labels are deliberately bounded. */
export function incrementProviderMetric(
  name: ProviderMetricName,
  labels: { provider: string; eventType?: string; result?: string; failureClass?: string },
): void {
  const bounded = [labels.provider, labels.eventType ?? '', labels.result ?? '', labels.failureClass ?? '']
    .map((value) => value.slice(0, 40))
    .join('|');
  const key = `${name}|${bounded}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function providerMetricSnapshot(): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(counters));
}

export function resetProviderMetricsForTests(): void {
  counters.clear();
}

export function isRetryableProviderFailure(value: TransportOutcomeClass): boolean {
  return value === 'DEFINITE_TRANSIENT_FAILURE' || value === 'RATE_LIMITED';
}

export function isAcceptanceRecipientAllowed(
  recipient: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.PROVIDER_ACCEPTANCE_MODE !== 'true') return true;
  const normalized = recipient.replace(/\D/g, '');
  const entries = (env.PROVIDER_ACCEPTANCE_ALLOWED_RECIPIENTS ?? '')
    .split(',')
    .map((value) => value.replace(/\D/g, ''))
    .filter(Boolean);
  return entries.length > 0 && entries.every((value) => value !== '*') && entries.includes(normalized);
}

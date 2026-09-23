import { randomUUID } from 'node:crypto';

export interface DomainEventEnvelope<T = unknown> {
  eventId: string; organizationId: string; eventType: string; schemaVersion: number;
  aggregateType: string; aggregateId: string; aggregateVersion: number; occurredAt: string;
  actor: { type: 'USER'; id: string }; correlationId?: string; causationId?: string; payload: T;
}

export function domainEvent<T>(input: Omit<DomainEventEnvelope<T>, 'eventId' | 'occurredAt' | 'schemaVersion'>): DomainEventEnvelope<T> {
  return { eventId: randomUUID(), occurredAt: new Date().toISOString(), schemaVersion: 1, ...input };
}

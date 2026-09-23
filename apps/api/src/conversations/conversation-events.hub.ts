import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { createClient, type RedisClientType } from 'redis';

export type ConversationInvalidation = {
  type: string;
  conversationId?: string;
  organizationId?: string;
};

/**
 * SSE invalidation hub. In-process emitter + optional Redis pub/sub for multi-instance.
 * Redis is never the source of truth — clients must refetch Postgres.
 */
@Injectable()
export class ConversationEventsHub implements OnModuleDestroy {
  private readonly local = new EventEmitter();
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private ready: Promise<void>;

  constructor() {
    this.local.setMaxListeners(200);
    this.ready = this.initRedis();
  }

  private channel(organizationId: string) {
    return `conv-events:${organizationId}`;
  }

  private async initRedis() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      this.publisher = createClient({ url }) as RedisClientType;
      this.subscriber = createClient({ url }) as RedisClientType;
      await this.publisher.connect();
      await this.subscriber.connect();
      await this.subscriber.pSubscribe('conv-events:*', (message, channel) => {
        const organizationId = channel.slice('conv-events:'.length);
        try {
          const payload = JSON.parse(message) as ConversationInvalidation;
          this.local.emit(organizationId, payload);
        } catch {
          /* ignore malformed */
        }
      });
    } catch {
      this.publisher = null;
      this.subscriber = null;
    }
  }

  async onModuleDestroy() {
    await this.subscriber?.quit().catch(() => undefined);
    await this.publisher?.quit().catch(() => undefined);
  }

  publish(organizationId: string, event: ConversationInvalidation) {
    const payload = { ...event, organizationId };
    this.local.emit(organizationId, payload);
    void this.ready.then(() => {
      void this.publisher?.publish(this.channel(organizationId), JSON.stringify(payload));
    });
  }

  subscribe(organizationId: string, _userId: string) {
    const emitter = new EventEmitter();
    const onEvent = (event: ConversationInvalidation) => {
      emitter.emit('event', event);
    };
    this.local.on(organizationId, onEvent);
    return {
      on: (fn: (e: ConversationInvalidation) => void) => {
        emitter.on('event', fn);
      },
      close: () => {
        this.local.off(organizationId, onEvent);
        emitter.removeAllListeners();
      },
    };
  }
}

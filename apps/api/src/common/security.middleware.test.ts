import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { SecurityHeadersAndRateLimitMiddleware } from './security.middleware.js';

function request(method: string, path: string, authorization = 'Bearer test-user') {
  return { method, path, headers: { authorization }, ip: '127.0.0.1' } as never;
}

function response() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  } as never;
}

test('P13 security middleware sets headers and limits mutation bursts per subject', () => {
  const middleware = new SecurityHeadersAndRateLimitMiddleware();
  const res = response();
  let nextCalls = 0;
  const next = () => { nextCalls += 1; };

  middleware.use(request('POST', '/v1/organizations/a/bookings'), res, next);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(nextCalls, 1);

  for (let i = 1; i < 30; i++) middleware.use(request('POST', '/v1/organizations/a/bookings'), response(), next);
  assert.throws(
    () => middleware.use(request('POST', '/v1/organizations/a/bookings'), response(), next),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
});

test('P13 security middleware excludes health and provider webhook paths from generic rate buckets', () => {
  const middleware = new SecurityHeadersAndRateLimitMiddleware();
  const next = () => undefined;
  for (let i = 0; i < 200; i++) {
    middleware.use(request('POST', '/v1/webhooks/whatsapp/meta'), response(), next);
    middleware.use(request('GET', '/health/ready'), response(), next);
  }
});

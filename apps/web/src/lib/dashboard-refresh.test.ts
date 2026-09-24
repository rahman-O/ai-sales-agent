import assert from 'node:assert/strict';
import test from 'node:test';
import { createRefreshController } from './dashboard-refresh.ts';

test('createRefreshController: debounce coalesces bursts', async () => {
  let runs = 0;
  const c = createRefreshController({
    debounceMs: 30,
    run: async () => {
      runs += 1;
    },
  });
  c.request();
  c.request();
  c.request();
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(runs, 1);
  c.dispose();
});

test('createRefreshController: dispose prevents further runs', async () => {
  let runs = 0;
  const c = createRefreshController({
    debounceMs: 10,
    run: async () => {
      runs += 1;
    },
  });
  c.dispose();
  c.request();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(runs, 0);
});

test('createRefreshController: single-flight queues trailing refresh', async () => {
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const c = createRefreshController({
    debounceMs: 5,
    run: async () => {
      runs += 1;
      if (runs === 1) await gate;
    },
  });
  c.request();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(runs, 1);
  c.request();
  release();
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(runs >= 2);
  c.dispose();
});

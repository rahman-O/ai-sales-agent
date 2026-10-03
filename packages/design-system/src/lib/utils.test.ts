import assert from 'node:assert/strict';
import test from 'node:test';
import { cn } from './utils.ts';
test('cn merges prefixed utilities without activating legacy class semantics', () => {
  assert.equal(cn('tw:p-2', false, { 'tw:p-4': true }), 'tw:p-4');
  assert.equal(cn('tw:rtl:ps-2', 'tw:rtl:ps-4'), 'tw:rtl:ps-4');
  assert.equal(cn('tw:focus:bg-primary', 'tw:focus:bg-secondary'), 'tw:focus:bg-secondary');
  assert.equal(cn('legacy-card', 'p-2', 'p-4'), 'legacy-card p-2 p-4');
});

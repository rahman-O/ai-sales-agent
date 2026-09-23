import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemberRole } from '@ai-sales-agent/contracts';

function canDemoteOwner(activeOwnerCount: number, targetRole: MemberRole, newRole: MemberRole): boolean {
  if (targetRole === 'OWNER' && newRole !== 'OWNER' && activeOwnerCount <= 1) return false;
  return true;
}

test('last owner cannot be demoted', () => {
  assert.equal(canDemoteOwner(1, 'OWNER', 'ADMIN'), false);
  assert.equal(canDemoteOwner(2, 'OWNER', 'ADMIN'), true);
});

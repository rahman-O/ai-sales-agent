import assert from 'node:assert/strict';

function authorize({ verifiedClaims, requestedOrganizationId, memberships, nowEpochSeconds }) {
  if (!verifiedClaims?.sub || verifiedClaims.exp <= nowEpochSeconds) throw new Error('UNAUTHENTICATED');
  const membership = memberships.find(m => m.userId === verifiedClaims.sub && m.organizationId === requestedOrganizationId && m.status === 'ACTIVE');
  if (!membership) throw new Error('FORBIDDEN');
  return { userId: verifiedClaims.sub, organizationId: membership.organizationId, role: membership.role };
}

const now = 2_000_000_000;
const claims = { sub: 'auth-user-a', exp: now + 300 };
const memberships = [{ userId: 'auth-user-a', organizationId: 'org-a', role: 'OWNER', status: 'ACTIVE' }];
assert.deepEqual(authorize({ verifiedClaims: claims, requestedOrganizationId: 'org-a', memberships, nowEpochSeconds: now }), { userId: 'auth-user-a', organizationId: 'org-a', role: 'OWNER' });
assert.throws(() => authorize({ verifiedClaims: claims, requestedOrganizationId: 'org-b', memberships, nowEpochSeconds: now }), /FORBIDDEN/);
assert.throws(() => authorize({ verifiedClaims: { ...claims, exp: now - 1 }, requestedOrganizationId: 'org-a', memberships, nowEpochSeconds: now }), /UNAUTHENTICATED/);
assert.throws(() => authorize({ verifiedClaims: claims, requestedOrganizationId: 'org-a', memberships: memberships.map(m => ({ ...m, status: 'REVOKED' })), nowEpochSeconds: now }), /FORBIDDEN/);
console.log(JSON.stringify({ passed: 4, scope: 'local authorization boundary only', blocked: 'Supabase JWT/JWKS, refresh, logout, and live revocation require project access' }));


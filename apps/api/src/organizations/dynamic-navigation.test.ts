import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALWAYS_AVAILABLE_MODULE_IDS,
  DASHBOARD_NAV_ITEMS,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  evaluateRouteAccess,
  filterNavItems,
} from '@ai-sales-agent/contracts';

test('MB-03: DASHBOARD_NAV_ITEMS defines central, authoritative navigation items with groups and statuses', () => {
  assert.ok(DASHBOARD_NAV_ITEMS.length >= 10);

  const groups = new Set(DASHBOARD_NAV_ITEMS.map((item) => item.group));
  assert.ok(groups.has('WORKSPACE'));
  assert.ok(groups.has('OPERATIONS'));
  assert.ok(groups.has('GROWTH'));
  assert.ok(groups.has('ADMIN'));

  // Ensure all items have non-empty English & Arabic labels and valid routes
  for (const item of DASHBOARD_NAV_ITEMS) {
    assert.ok(item.label.length > 0, `Item ${item.id} has empty label`);
    assert.ok(item.labelAr.length > 0, `Item ${item.id} has empty labelAr`);
    assert.ok(item.href.startsWith('/'), `Item ${item.id} has invalid href ${item.href}`);
  }
});

test('MB-03: Always-available modules remain visible across all capability configurations', () => {
  const minimalCaps = {
    supportsBooking: false,
    supportsLeads: false,
    supportsOffers: false,
    supportsQuotes: false,
    supportsOrders: false,
    supportsInventory: false,
    supportsStaff: false,
    supportsLocations: false,
    supportsProducts: false,
    supportsServices: false,
    supportsListings: false,
  };

  const visible = filterNavItems(DASHBOARD_NAV_ITEMS, minimalCaps, 'OWNER');
  const visibleIds = visible.map((i) => i.id);

  for (const alwaysId of ALWAYS_AVAILABLE_MODULE_IDS) {
    assert.ok(
      visibleIds.includes(alwaysId),
      `Always-available module ${alwaysId} must be visible even with all optional capabilities false`,
    );
  }

  // Bookings and Leads must NOT be in visibleIds
  assert.equal(visibleIds.includes('bookings'), false);
  assert.equal(visibleIds.includes('leads'), false);
});

test('MB-03: Scenario A — Booking organization displays booking & schedule modules', () => {
  const bookingCaps = {
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
    supportsBooking: true,
    supportsLeads: false,
  };

  const visible = filterNavItems(DASHBOARD_NAV_ITEMS, bookingCaps, 'ADMIN');
  const visibleIds = visible.map((i) => i.id);

  assert.ok(visibleIds.includes('bookings'));
  assert.ok(visibleIds.includes('schedule'));
  assert.equal(visibleIds.includes('leads'), false);

  const routeAccessBooking = evaluateRouteAccess('/bookings', bookingCaps);
  assert.equal(routeAccessBooking.allowed, true);

  const routeAccessLeads = evaluateRouteAccess('/leads', bookingCaps);
  assert.equal(routeAccessLeads.allowed, false);
  assert.ok(routeAccessLeads.reason?.includes('supportsLeads'));
});

test('MB-03: Scenario B — Lead-only organization displays leads and hides booking modules', () => {
  const leadOnlyCaps = {
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
    supportsBooking: false,
    supportsLeads: true,
  };

  const visible = filterNavItems(DASHBOARD_NAV_ITEMS, leadOnlyCaps, 'ADMIN');
  const visibleIds = visible.map((i) => i.id);

  assert.ok(visibleIds.includes('leads'));
  assert.equal(visibleIds.includes('bookings'), false);
  assert.equal(visibleIds.includes('schedule'), false);

  const routeAccessBooking = evaluateRouteAccess('/bookings', leadOnlyCaps);
  assert.equal(routeAccessBooking.allowed, false);
  assert.ok(routeAccessBooking.reason?.includes('supportsBooking'));

  const routeAccessLeads = evaluateRouteAccess('/leads', leadOnlyCaps);
  assert.equal(routeAccessLeads.allowed, true);
});

test('MB-03/MB-05: Future modules (MB-07, MB-08, MB-10, MB-12) are marked COMING_SOON and omitted from active operator nav, while implemented modules (offers) are active when capability enabled', () => {
  const futureEcommerceCaps = {
    ...DEFAULT_ORGANIZATION_CAPABILITIES,
    supportsProducts: true,
    supportsOrders: true,
    supportsInventory: true,
    supportsOffers: true,
    supportsQuotes: true,
    supportsListings: true,
  };

  // Default filter excludes coming soon modules to avoid broken pages
  const activeNav = filterNavItems(DASHBOARD_NAV_ITEMS, futureEcommerceCaps, 'ADMIN');
  const activeNavIds = activeNav.map((i) => i.id);

  assert.equal(activeNavIds.includes('orders'), false);
  assert.equal(activeNavIds.includes('inventory'), false);
  assert.equal(activeNavIds.includes('quotes'), false);
  assert.equal(activeNavIds.includes('listings'), false);
  // In MB-05, offers is implemented and enabled when supportsOffers is true
  assert.equal(activeNavIds.includes('offers'), true);

  // If explicitly requested for roadmap preview, coming soon items can be displayed
  const previewNav = filterNavItems(DASHBOARD_NAV_ITEMS, futureEcommerceCaps, 'ADMIN', {
    includeComingSoon: true,
  });
  const previewIds = previewNav.map((i) => i.id);
  assert.ok(previewIds.includes('orders'));
  assert.ok(previewIds.includes('quotes'));
});

test('MB-03: Role & capability intersection restricts admin routes from regular members', () => {
  const caps = { ...DEFAULT_ORGANIZATION_CAPABILITIES };

  // Owner sees admin channels/templates
  const ownerNav = filterNavItems(DASHBOARD_NAV_ITEMS, caps, 'OWNER');
  assert.ok(ownerNav.some((i) => i.id === 'settings-channels'));

  // Regular Member does NOT see admin channels/templates
  const memberNav = filterNavItems(DASHBOARD_NAV_ITEMS, caps, 'MEMBER');
  assert.equal(memberNav.some((i) => i.id === 'settings-channels'), false);
  assert.equal(memberNav.some((i) => i.id === 'settings-templates'), false);

  // Direct route evaluation for Member
  const memberAccess = evaluateRouteAccess('/settings/channels', caps, 'MEMBER');
  assert.equal(memberAccess.allowed, false);
  assert.ok(memberAccess.reason?.includes('FORBIDDEN'));
});

test('MB-03: Tenant isolation — independent organization capabilities evaluate without cross-tenant bleed', () => {
  const orgACaps = { ...DEFAULT_ORGANIZATION_CAPABILITIES, supportsBooking: true, supportsLeads: false };
  const orgBCaps = { ...DEFAULT_ORGANIZATION_CAPABILITIES, supportsBooking: false, supportsLeads: true };

  const accessA = evaluateRouteAccess('/bookings', orgACaps);
  const accessB = evaluateRouteAccess('/bookings', orgBCaps);

  assert.equal(accessA.allowed, true);
  assert.equal(accessB.allowed, false);
});

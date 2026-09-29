import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AppConfigService } from '../../src/config/config.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { TenantContextService } from '../../src/database/tenant-context.service.js';
import { AnalyticsService } from '../../src/analytics/analytics.service.js';
import { createAppPool } from '../../src/database/pg-pool.js';

test('MB-13 Analytics: Multi-business metrics, capabilities, multi-currency, and tenant isolation', async () => {
  process.env.APP_URL ??= 'http://localhost:3000';
  process.env.API_URL ??= 'http://127.0.0.1:3001';
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  assert.ok(migrationUrl);

  const owner = createAppPool(migrationUrl, { max: 1 });
  const user = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const customerA = randomUUID();
  const customerB = randomUUID();
  const serviceA = randomUUID();
  const productA = randomUUID();

  try {
    // 1. Seed users, organizations, members
    await owner.query(`INSERT INTO users(id, auth_subject) VALUES($1, $2)`, [user, `mb13-${user}`]);

    await owner.query(`INSERT INTO organizations(id, name) VALUES($1, 'MB13 Org A'), ($2, 'MB13 Org B')`, [orgA, orgB]);

    // Org A: supportsBooking, supportsQuotes, supportsOrders, supportsLeads, supportsOffers
    await owner.query(
      `INSERT INTO organization_capabilities(organization_id, supports_booking, supports_quotes, supports_orders, supports_leads, supports_offers)
       VALUES($1, true, true, true, true, true)`,
      [orgA]
    );
    await owner.query(
      `INSERT INTO organization_profiles(organization_id, display_name, timezone)
       VALUES($1, 'Org A Profile', 'Asia/Baghdad')`,
      [orgA]
    );

    // Org B: supportsBooking=false, supportsQuotes=false, supportsOrders=true, supportsLeads=false
    await owner.query(
      `INSERT INTO organization_capabilities(organization_id, supports_booking, supports_quotes, supports_orders, supports_leads, supports_offers)
       VALUES($1, false, false, true, false, false)`,
      [orgB]
    );
    await owner.query(
      `INSERT INTO organization_profiles(organization_id, display_name, timezone)
       VALUES($1, 'Org B Profile', 'Asia/Baghdad')`,
      [orgB]
    );

    await owner.query(
      `INSERT INTO organization_members(organization_id, user_id, role, status)
       VALUES($1, $3, 'OWNER', 'ACTIVE'), ($2, $3, 'ADMIN', 'ACTIVE')`,
      [orgA, orgB, user]
    );

    const locA = randomUUID();
    await owner.query(
      `INSERT INTO locations(id, organization_id, name, timezone, address, active)
       VALUES($1, $2, 'Main Clinic', 'Asia/Baghdad', 'Baghdad', true)`,
      [locA, orgA]
    );

    // 2. Seed catalog items in Org A
    await owner.query(
      `INSERT INTO catalog_items(id, organization_id, kind, name, amount_minor, currency, status)
       VALUES($1, $2, 'SERVICE', 'Root Canal', 150000, 'IQD', 'ACTIVE'),
             ($3, $2, 'PRODUCT', 'Dental Kit', 25000, 'IQD', 'ACTIVE')`,
      [serviceA, orgA, productA]
    );

    await owner.query(
      `INSERT INTO services(id, organization_id, location_id, catalog_item_id, name, duration_minutes, amount_minor, currency, active)
       VALUES($1, $2, $3, $1, 'Root Canal', 60, 150000, 'IQD', true)`,
      [serviceA, orgA, locA]
    );

    // 3. Seed customers and conversations in Org A
    await owner.query(`INSERT INTO customers(id, organization_id, display_name) VALUES($1, $2, 'Customer A')`, [
      customerA,
      orgA,
    ]);

    const connA = randomUUID();
    await owner.query(
      `INSERT INTO channel_connections(id, organization_id, provider, external_channel_id, status)
       VALUES($1, $2, 'whatsapp', $3, 'ACTIVE')`,
      [connA, orgA, `ext-conn-${connA}`]
    );

    const identA = randomUUID();
    await owner.query(
      `INSERT INTO customer_identities(id, organization_id, customer_id, channel_connection_id, channel, external_address)
       VALUES($1, $2, $3, $4, 'whatsapp', '+9647700000001')`,
      [identA, orgA, customerA, connA]
    );

    const convA = randomUUID();
    await owner.query(
      `INSERT INTO conversations(id, organization_id, customer_id, channel_connection_id, identity_id, mode, created_at)
       VALUES($1, $2, $3, $4, $5, 'AI_ACTIVE', '2026-09-15 10:00:00+03')`,
      [convA, orgA, customerA, connA, identA]
    );

    // Messages in Org A
    await owner.query(
      `INSERT INTO messages(id, organization_id, conversation_id, channel_connection_id, ingress_sequence, timeline_sequence, direction, origin, content_text, content_digest, delivery_state, created_at)
       VALUES(gen_random_uuid(), $1, $2, $3, 1, 1, 'INBOUND', 'CUSTOMER', 'I want a quote and order', 'digest1', 'DELIVERED', '2026-09-15 10:01:00+03'),
             (gen_random_uuid(), $1, $2, $3, null, 2, 'OUTBOUND', 'AI', 'Here are your options', 'digest2', 'DELIVERED', '2026-09-15 10:01:05+03')`,
      [orgA, convA, connA]
    );

    // Working state in Org A
    await owner.query(
      `INSERT INTO conversation_working_state(organization_id, conversation_id, customer_id, state_json, updated_at)
       VALUES($1, $2, $3, $4, '2026-09-15 10:02:00+03')`,
      [orgA, convA, customerA, JSON.stringify({ currentIntent: 'QUOTE_INTENT', activeWorkflow: 'QUOTE' })]
    );

    // 4. Seed quotes in Org A: 1 ACCEPTED in IQD (50,000 minor), 1 ACCEPTED in USD (100 minor)
    const quote1 = randomUUID();
    const quote2 = randomUUID();
    await owner.query(
      `INSERT INTO quotes(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, created_at)
       VALUES($1, $3, $4, 'ACCEPTED', 'IQD', 50000, 0, 50000, '2026-09-15 11:00:00+03'),
             ($2, $3, $4, 'ACCEPTED', 'USD', 100, 0, 100, '2026-09-15 11:30:00+03')`,
      [quote1, quote2, orgA, customerA]
    );
    await owner.query(
      `INSERT INTO quote_line_items(id, organization_id, quote_id, catalog_item_id, description_snapshot, quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor, created_at)
       VALUES(gen_random_uuid(), $1, $2, $3, 'Root Canal', 1, 50000, 0, 50000, '2026-09-15 11:00:00+03')`,
      [orgA, quote1, serviceA]
    );

    // 5. Seed orders in Org A: 1 CONFIRMED in IQD (75,000 minor)
    const order1 = randomUUID();
    await owner.query(
      `INSERT INTO orders(id, organization_id, customer_id, status, currency, subtotal_amount_minor, discount_amount_minor, total_amount_minor, created_at)
       VALUES($1, $2, $3, 'CONFIRMED', 'IQD', 75000, 0, 75000, '2026-09-15 12:00:00+03')`,
      [order1, orgA, customerA]
    );
    await owner.query(
      `INSERT INTO order_line_items(id, organization_id, order_id, catalog_item_id, description_snapshot, quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor, created_at)
       VALUES(gen_random_uuid(), $1, $2, $3, 'Dental Kit', 3, 25000, 0, 75000, '2026-09-15 12:00:00+03')`,
      [orgA, order1, productA]
    );

    // 6. Seed booking in Org A
    const staffA = randomUUID();
    await owner.query(
      `INSERT INTO staff_members(id, organization_id, location_id, display_name, active)
       VALUES($1, $2, $3, 'Dr. Sarah', true)`,
      [staffA, orgA, locA]
    );

    const bk1 = randomUUID();
    await owner.query(
      `INSERT INTO bookings(id, organization_id, customer_id, service_id, location_id, staff_member_id, status, starts_at, ends_at, occupied_starts_at, occupied_ends_at, timezone, duration_minutes, created_by_type, created_at)
       VALUES($1, $2, $3, $4, $5, $6, 'CONFIRMED', '2026-09-20 10:00:00+03', '2026-09-20 11:00:00+03', '2026-09-20 10:00:00+03', '2026-09-20 11:00:00+03', 'Asia/Baghdad', 60, 'AGENT', '2026-09-15 13:00:00+03')`,
      [bk1, orgA, customerA, serviceA, locA, staffA]
    );

    // Seed customer in Org B
    await owner.query(`INSERT INTO customers(id, organization_id, display_name) VALUES($1, $2, 'Customer B')`, [
      customerB,
      orgB,
    ]);

    // Instantiate AnalyticsService
    assert.ok(process.env.DATABASE_URL);
    const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL } as AppConfigService);
    const analytics = new AnalyticsService(new TenantContextService(prisma));

    try {
      const q = { from: '2026-09-01', to: '2026-09-30', timezone: 'Asia/Baghdad' };
      const actor = { userId: user, authSubject: `mb13-${user}` };

      // Query Org A
      const resA = await analytics.overview(actor, orgA, q);
      assert.equal(resA.metricVersion, 'analytics_overview:v2');
      assert.equal(resA.range.timezone, 'Asia/Baghdad');

      // Check Conversations & Intents
      assert.equal(resA.conversations.total, 1);
      assert.equal(resA.conversations.aiHandled, 1);
      assert.equal(resA.conversations.humanTakeover, 0);
      assert.equal(resA.conversations.handoffRate, 0);
      assert.equal(resA.intents.byIntent['QUOTE_INTENT'], 1);

      // Check Quotes
      assert.ok(resA.quotes);
      assert.equal(resA.quotes.accepted, 2);
      assert.equal(resA.quotes.total, 2);
      assert.equal(resA.quotes.acceptanceRate.rate, 1.0);

      // Check Orders
      assert.ok(resA.orders);
      assert.equal(resA.orders.confirmed, 1);
      assert.equal(resA.orders.total, 1);
      assert.equal(resA.orders.confirmationRate.rate, 1.0);

      // Check Bookings
      assert.ok(resA.bookings);
      assert.equal(resA.bookings.confirmed, 1);
      assert.equal(resA.bookings.total, 1);

      // Check Multi-Currency Grouping (Never summed across currencies!)
      assert.ok(resA.commercialValues);
      assert.equal(resA.commercialValues.length, 2); // IQD and USD
      const iqd = resA.commercialValues.find(v => v.currency === 'IQD');
      const usd = resA.commercialValues.find(v => v.currency === 'USD');
      assert.ok(iqd);
      assert.ok(usd);
      assert.equal(iqd.acceptedQuoteValueMinor, '50000');
      assert.equal(iqd.confirmedOrderValueMinor, '75000');
      assert.equal(iqd.totalCommercialValueMinor, '125000');
      assert.equal(usd.acceptedQuoteValueMinor, '100');
      assert.equal(usd.confirmedOrderValueMinor, '0');
      assert.equal(usd.totalCommercialValueMinor, '100');

      // Check Catalog Analytics
      assert.ok(resA.catalog.mostBookedServices.length > 0);
      assert.equal(resA.catalog.mostBookedServices[0]?.name, 'Root Canal');
      assert.ok(resA.catalog.mostQuotedItems.length > 0);
      assert.equal(resA.catalog.mostQuotedItems[0]?.name, 'Root Canal');
      assert.ok(resA.catalog.mostOrderedItems.length > 0);
      assert.equal(resA.catalog.mostOrderedItems[0]?.name, 'Dental Kit');

      // Check Funnels
      assert.ok(resA.funnels.quote);
      assert.equal(resA.funnels.quote.stages.length, 4);
      assert.ok(resA.funnels.order);
      assert.equal(resA.funnels.order.stages.length, 4);
      assert.ok(resA.funnels.booking);
      assert.equal(resA.funnels.booking.stages.length, 4);

      // Query Org B (Capability Gating: supportsBooking=false, supportsQuotes=false)
      const resB = await analytics.overview(actor, orgB, q);
      assert.equal(resB.capabilities.supportsBooking, false);
      assert.equal(resB.capabilities.supportsQuotes, false);
      assert.equal(resB.capabilities.supportsOrders, true);
      assert.equal(resB.bookings, undefined);
      assert.equal(resB.quotes, undefined);
      assert.ok(resB.orders);
      assert.equal(resB.orders.total, 0);
      assert.equal(resB.funnels.booking, undefined);
      assert.equal(resB.funnels.quote, undefined);
      assert.ok(resB.funnels.order);

      // Cross-Tenant Isolation: Org B has 0 quotes and 0 orders from Org A
      assert.equal(resB.commercialValues.length, 0);

      // Sub-endpoint queries
      const funnelsB = await analytics.funnels(actor, orgB, q);
      assert.equal(funnelsB.metricVersion, 'analytics_funnels:v1');
      assert.equal(funnelsB.funnels.booking, undefined);

      const catalogA = await analytics.catalog(actor, orgA, q);
      assert.equal(catalogA.metricVersion, 'analytics_catalog:v1');
      assert.ok(catalogA.catalog.mostOrderedItems.length > 0);
    } finally {
      await prisma.onModuleDestroy();
    }
  } finally {
    await owner.end();
  }
});

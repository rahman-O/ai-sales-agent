import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  calculateTransactionPricing,
  isValidOrderTransition,
  isValidQuoteTransition,
  type QuoteStatus,
  type OrderStatus,
  type TransactionItemInput,
} from '@ai-sales-agent/contracts';
import { isValidUuid } from './uuid-validator.js';

export async function toolGetQuote(
  c: PoolClient,
  organizationId: string,
  customerId: string | null,
  args: { quoteId?: string },
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (args.quoteId) {
    if (!isValidUuid(args.quoteId)) {
      return { ok: false, code: 'INVALID_ARGUMENT' };
    }
    const res = await c.query(
      `SELECT q.id, q.organization_id, q.customer_id, q.lead_id, q.status, q.currency,
              q.subtotal_amount_minor, q.discount_amount_minor, q.total_amount_minor,
              q.expires_at, q.notes, q.version, q.metadata_json, q.created_at, q.updated_at
       FROM quotes q
       WHERE q.organization_id = $1 AND q.id = $2`,
      [organizationId, args.quoteId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, code: 'NOT_FOUND' };
    if (customerId && row.customer_id && row.customer_id !== customerId) {
      return { ok: false, code: 'FORBIDDEN' };
    }

    const linesRes = await c.query(
      `SELECT id, catalog_item_id, description_snapshot, quantity, unit_amount_minor,
              discount_amount_minor, line_total_amount_minor, metadata_json
       FROM quote_line_items
       WHERE organization_id = $1 AND quote_id = $2
       ORDER BY created_at ASC`,
      [organizationId, args.quoteId],
    );

    return {
      ok: true,
      code: 'OK',
      data: {
        quote: {
          ...row,
          lineItems: linesRes.rows,
        },
      },
    };
  }

  // Find latest quote for customer
  const res = await c.query(
    `SELECT q.id, q.organization_id, q.customer_id, q.lead_id, q.status, q.currency,
            q.subtotal_amount_minor, q.discount_amount_minor, q.total_amount_minor,
            q.expires_at, q.notes, q.version, q.metadata_json, q.created_at, q.updated_at
     FROM quotes q
     WHERE q.organization_id = $1 AND q.customer_id = $2
     ORDER BY q.created_at DESC LIMIT 1`,
    [organizationId, customerId],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, code: 'NOT_FOUND' };

  const linesRes = await c.query(
    `SELECT id, catalog_item_id, description_snapshot, quantity, unit_amount_minor,
            discount_amount_minor, line_total_amount_minor, metadata_json
     FROM quote_line_items
     WHERE organization_id = $1 AND quote_id = $2
     ORDER BY created_at ASC`,
    [organizationId, row.id],
  );

  return {
    ok: true,
    code: 'OK',
    data: {
      quote: {
        ...row,
        lineItems: linesRes.rows,
      },
    },
  };
}

export async function toolCreateQuote(
  c: PoolClient,
  organizationId: string,
  customerId: string | null,
  args: {
    items: Array<{ catalogItemId?: string; description?: string; quantity?: number }>;
    leadId?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!Array.isArray(args.items) || args.items.length === 0) {
    return { ok: false, code: 'INVALID_ARGUMENT' };
  }

  // 1. Fetch catalog items
  const itemIds = args.items
    .map((i) => i.catalogItemId)
    .filter((id): id is string => typeof id === 'string' && isValidUuid(id));

  let catalogRows: any[] = [];
  if (itemIds.length > 0) {
    const res = await c.query(
      `SELECT id, name, amount_minor, currency, status
       FROM catalog_items
       WHERE organization_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NULL`,
      [organizationId, itemIds],
    );
    catalogRows = res.rows;
  }

  const catalogItemsMap = new Map(
    catalogRows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        amountMinor: r.amount_minor != null ? BigInt(r.amount_minor) : null,
        currency: r.currency,
        status: r.status,
      },
    ]),
  );

  // 2. Fetch active offers
  const offersRes = await c.query(
    `SELECT o.id, o.offer_type, o.discount_percentage, o.discount_amount_minor, o.stackable, o.priority,
            COALESCE(json_agg(t.catalog_item_id) FILTER (WHERE t.catalog_item_id IS NOT NULL), '[]') as target_item_ids
     FROM offers o
     LEFT JOIN offer_catalog_items t ON t.organization_id = o.organization_id AND t.offer_id = o.id
     WHERE o.organization_id = $1 AND o.status = 'ACTIVE' AND o.archived_at IS NULL
     GROUP BY o.id, o.offer_type, o.discount_percentage, o.discount_amount_minor, o.stackable, o.priority`,
    [organizationId],
  );

  const activeOffers = offersRes.rows.map((o) => ({
    id: o.id,
    offerType: o.offer_type,
    discountPercentage: o.discount_percentage,
    discountAmountMinor: o.discount_amount_minor != null ? BigInt(o.discount_amount_minor) : null,
    targetCatalogItemIds: o.target_item_ids || [],
    stackable: o.stackable,
    priority: o.priority,
  }));

  const transactionItems: TransactionItemInput[] = args.items.map((i) => ({
    catalogItemId: i.catalogItemId,
    description: i.description,
    quantity: typeof i.quantity === 'number' && i.quantity > 0 ? i.quantity : 1,
  }));

  let pricing;
  try {
    pricing = calculateTransactionPricing({
      items: transactionItems,
      catalogItemsMap,
      activeOffers,
      defaultCurrency: 'IQD',
      allowManualPricing: false,
    });
  } catch (err: any) {
    return { ok: false, code: 'PRICING_FAILED', data: { error: err.message } };
  }

  const quoteId = randomUUID();
  const insertQuote = await c.query(
    `INSERT INTO quotes (
       id, organization_id, customer_id, lead_id, status, currency,
       subtotal_amount_minor, discount_amount_minor, total_amount_minor,
       version, notes, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, 'DRAFT', $5,
       $6, $7, $8,
       1, $9, now(), now()
     ) RETURNING *`,
    [
      quoteId,
      organizationId,
      customerId,
      args.leadId || null,
      pricing.currency,
      pricing.subtotalAmountMinor.toString(),
      pricing.discountAmountMinor.toString(),
      pricing.totalAmountMinor.toString(),
      args.notes || null,
    ],
  );

  for (const line of pricing.lineItems) {
    await c.query(
      `INSERT INTO quote_line_items (
         id, organization_id, quote_id, catalog_item_id, description_snapshot,
         quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor,
         metadata_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10::jsonb, now(), now()
       )`,
      [
        randomUUID(),
        organizationId,
        quoteId,
        line.catalogItemId,
        line.description,
        line.quantity,
        line.unitAmountMinor.toString(),
        line.discountAmountMinor.toString(),
        line.lineTotalAmountMinor.toString(),
        JSON.stringify(line.appliedOfferId ? { appliedOfferId: line.appliedOfferId } : {}),
      ],
    );
  }

  return {
    ok: true,
    code: 'OK',
    data: {
      quote: {
        ...insertQuote.rows[0],
        lineItems: pricing.lineItems,
      },
    },
  };
}

export async function toolPresentQuote(
  c: PoolClient,
  organizationId: string,
  quoteId: string,
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(quoteId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const res = await c.query(
    `UPDATE quotes
     SET status = 'PRESENTED', presented_at = now(), version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND status = 'DRAFT'
     RETURNING *`,
    [organizationId, quoteId],
  );

  if (res.rows.length === 0) {
    return { ok: false, code: 'INVALID_TRANSITION' };
  }

  return { ok: true, code: 'OK', data: { quote: res.rows[0] } };
}

export async function toolAcceptQuote(
  c: PoolClient,
  organizationId: string,
  quoteId: string,
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(quoteId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const check = await c.query(
    `SELECT id, status, expires_at FROM quotes WHERE organization_id = $1 AND id = $2`,
    [organizationId, quoteId],
  );
  const row = check.rows[0];
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.status !== 'PRESENTED') return { ok: false, code: 'INVALID_TRANSITION' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ok: false, code: 'QUOTE_EXPIRED' };
  }

  const res = await c.query(
    `UPDATE quotes
     SET status = 'ACCEPTED', accepted_at = now(), version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND status = 'PRESENTED'
     RETURNING *`,
    [organizationId, quoteId],
  );

  return { ok: true, code: 'OK', data: { quote: res.rows[0] } };
}

export async function toolRejectQuote(
  c: PoolClient,
  organizationId: string,
  quoteId: string,
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(quoteId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const res = await c.query(
    `UPDATE quotes
     SET status = 'REJECTED', rejected_at = now(), version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND status = 'PRESENTED'
     RETURNING *`,
    [organizationId, quoteId],
  );

  if (res.rows.length === 0) return { ok: false, code: 'INVALID_TRANSITION' };
  return { ok: true, code: 'OK', data: { quote: res.rows[0] } };
}

export async function toolCancelQuote(
  c: PoolClient,
  organizationId: string,
  quoteId: string,
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(quoteId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const res = await c.query(
    `UPDATE quotes
     SET status = 'CANCELLED', cancelled_at = now(), version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND status IN ('DRAFT', 'PRESENTED')
     RETURNING *`,
    [organizationId, quoteId],
  );

  if (res.rows.length === 0) return { ok: false, code: 'INVALID_TRANSITION' };
  return { ok: true, code: 'OK', data: { quote: res.rows[0] } };
}

export async function toolGetOrder(
  c: PoolClient,
  organizationId: string,
  customerId: string | null,
  args: { orderId?: string },
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (args.orderId) {
    if (!isValidUuid(args.orderId)) {
      return { ok: false, code: 'INVALID_ARGUMENT' };
    }
    const res = await c.query(
      `SELECT o.id, o.organization_id, o.customer_id, o.lead_id, o.quote_id, o.status, o.currency,
              o.subtotal_amount_minor, o.discount_amount_minor, o.total_amount_minor,
              o.notes, o.version, o.metadata_json, o.confirmed_at, o.completed_at, o.cancelled_at,
              o.created_at, o.updated_at
       FROM orders o
       WHERE o.organization_id = $1 AND o.id = $2`,
      [organizationId, args.orderId],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, code: 'NOT_FOUND' };
    if (customerId && row.customer_id && row.customer_id !== customerId) {
      return { ok: false, code: 'FORBIDDEN' };
    }

    const linesRes = await c.query(
      `SELECT id, catalog_item_id, description_snapshot, quantity, unit_amount_minor,
              discount_amount_minor, line_total_amount_minor, metadata_json
       FROM order_line_items
       WHERE organization_id = $1 AND order_id = $2
       ORDER BY created_at ASC`,
      [organizationId, args.orderId],
    );

    return {
      ok: true,
      code: 'OK',
      data: {
        order: {
          ...row,
          lineItems: linesRes.rows,
        },
      },
    };
  }

  // Find latest order for customer
  const res = await c.query(
    `SELECT o.id, o.organization_id, o.customer_id, o.lead_id, o.quote_id, o.status, o.currency,
            o.subtotal_amount_minor, o.discount_amount_minor, o.total_amount_minor,
            o.notes, o.version, o.metadata_json, o.confirmed_at, o.completed_at, o.cancelled_at,
            o.created_at, o.updated_at
     FROM orders o
     WHERE o.organization_id = $1 AND o.customer_id = $2
     ORDER BY o.created_at DESC LIMIT 1`,
    [organizationId, customerId],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, code: 'NOT_FOUND' };

  const linesRes = await c.query(
    `SELECT id, catalog_item_id, description_snapshot, quantity, unit_amount_minor,
            discount_amount_minor, line_total_amount_minor, metadata_json
     FROM order_line_items
     WHERE organization_id = $1 AND order_id = $2
     ORDER BY created_at ASC`,
    [organizationId, row.id],
  );

  return {
    ok: true,
    code: 'OK',
    data: {
      order: {
        ...row,
        lineItems: linesRes.rows,
      },
    },
  };
}

export async function toolCreateOrder(
  c: PoolClient,
  organizationId: string,
  customerId: string | null,
  args: {
    items: Array<{ catalogItemId?: string; description?: string; quantity?: number }>;
    quoteId?: string;
    leadId?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!Array.isArray(args.items) || args.items.length === 0) {
    return { ok: false, code: 'INVALID_ARGUMENT' };
  }

  const itemIds = args.items
    .map((i) => i.catalogItemId)
    .filter((id): id is string => typeof id === 'string' && isValidUuid(id));

  if (itemIds.length !== args.items.length) {
    return { ok: false, code: 'INVALID_CATALOG_ITEM', data: { error: 'Orders require valid catalogItemId for all items' } };
  }

  const res = await c.query(
    `SELECT id, name, amount_minor, currency, status
     FROM catalog_items
     WHERE organization_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NULL`,
    [organizationId, itemIds],
  );

  const catalogItemsMap = new Map(
    res.rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        amountMinor: r.amount_minor != null ? BigInt(r.amount_minor) : null,
        currency: r.currency,
        status: r.status,
      },
    ]),
  );

  const offersRes = await c.query(
    `SELECT o.id, o.offer_type, o.discount_percentage, o.discount_amount_minor, o.stackable, o.priority,
            COALESCE(json_agg(t.catalog_item_id) FILTER (WHERE t.catalog_item_id IS NOT NULL), '[]') as target_item_ids
     FROM offers o
     LEFT JOIN offer_catalog_items t ON t.organization_id = o.organization_id AND t.offer_id = o.id
     WHERE o.organization_id = $1 AND o.status = 'ACTIVE' AND o.archived_at IS NULL
     GROUP BY o.id, o.offer_type, o.discount_percentage, o.discount_amount_minor, o.stackable, o.priority`,
    [organizationId],
  );

  const activeOffers = offersRes.rows.map((o) => ({
    id: o.id,
    offerType: o.offer_type,
    discountPercentage: o.discount_percentage,
    discountAmountMinor: o.discount_amount_minor != null ? BigInt(o.discount_amount_minor) : null,
    targetCatalogItemIds: o.target_item_ids || [],
    stackable: o.stackable,
    priority: o.priority,
  }));

  const transactionItems: TransactionItemInput[] = args.items.map((i) => ({
    catalogItemId: i.catalogItemId,
    description: i.description,
    quantity: typeof i.quantity === 'number' && i.quantity > 0 ? i.quantity : 1,
  }));

  let pricing;
  try {
    pricing = calculateTransactionPricing({
      items: transactionItems,
      catalogItemsMap,
      activeOffers,
      defaultCurrency: 'IQD',
      allowManualPricing: false,
    });
  } catch (err: any) {
    return { ok: false, code: 'PRICING_FAILED', data: { error: err.message } };
  }

  // Policy check: MINIMUM_ORDER
  const policyRes = await c.query(
    `SELECT content_structured FROM business_policies
     WHERE organization_id = $1 AND policy_type = 'MINIMUM_ORDER' AND archived_at IS NULL LIMIT 1`,
    [organizationId],
  );
  if (policyRes.rows[0]?.content_structured?.minimumOrderAmountMinor != null) {
    const minRequired = BigInt(policyRes.rows[0].content_structured.minimumOrderAmountMinor);
    if (pricing.totalAmountMinor < minRequired) {
      return {
        ok: false,
        code: 'MINIMUM_ORDER_NOT_MET',
        data: {
          totalAmountMinor: pricing.totalAmountMinor.toString(),
          requiredMinimumMinor: minRequired.toString(),
        },
      };
    }
  }

  const orderId = randomUUID();
  const insertOrder = await c.query(
    `INSERT INTO orders (
       id, organization_id, customer_id, lead_id, quote_id, status, currency,
       subtotal_amount_minor, discount_amount_minor, total_amount_minor,
       version, notes, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, 'PENDING_CONFIRMATION', $6,
       $7, $8, $9,
       1, $10, now(), now()
     ) RETURNING *`,
    [
      orderId,
      organizationId,
      customerId,
      args.leadId || null,
      args.quoteId || null,
      pricing.currency,
      pricing.subtotalAmountMinor.toString(),
      pricing.discountAmountMinor.toString(),
      pricing.totalAmountMinor.toString(),
      args.notes || null,
    ],
  );

  for (const line of pricing.lineItems) {
    await c.query(
      `INSERT INTO order_line_items (
         id, organization_id, order_id, catalog_item_id, description_snapshot,
         quantity, unit_amount_minor, discount_amount_minor, line_total_amount_minor,
         metadata_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10::jsonb, now(), now()
       )`,
      [
        randomUUID(),
        organizationId,
        orderId,
        line.catalogItemId,
        line.description,
        line.quantity,
        line.unitAmountMinor.toString(),
        line.discountAmountMinor.toString(),
        line.lineTotalAmountMinor.toString(),
        JSON.stringify(line.appliedOfferId ? { appliedOfferId: line.appliedOfferId } : {}),
      ],
    );
  }

  return {
    ok: true,
    code: 'OK',
    data: {
      order: {
        ...insertOrder.rows[0],
        lineItems: pricing.lineItems,
      },
    },
  };
}

export async function toolConfirmOrder(
  c: PoolClient,
  organizationId: string,
  orderId: string,
  args?: { expectedTotalAmountMinor?: string; expectedVersion?: number },
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(orderId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const existingRes = await c.query(
    `SELECT id, status, version, total_amount_minor FROM orders WHERE organization_id = $1 AND id = $2`,
    [organizationId, orderId],
  );
  const existing = existingRes.rows[0];
  if (!existing) return { ok: false, code: 'NOT_FOUND' };

  if (args?.expectedVersion != null && existing.version !== args.expectedVersion) {
    return { ok: false, code: 'VERSION_MISMATCH' };
  }

  if (args?.expectedTotalAmountMinor != null) {
    const expected = BigInt(args.expectedTotalAmountMinor);
    if (BigInt(existing.total_amount_minor) !== expected) {
      return { ok: false, code: 'CONFIRMATION_STALE' };
    }
  }

  if (existing.status !== 'PENDING_CONFIRMATION') {
    return { ok: false, code: 'INVALID_TRANSITION' };
  }

  const res = await c.query(
    `UPDATE orders
     SET status = 'CONFIRMED', confirmed_at = now(), version = version + 1, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND status = 'PENDING_CONFIRMATION'
     RETURNING *`,
    [organizationId, orderId],
  );

  return { ok: true, code: 'OK', data: { order: res.rows[0] } };
}

export async function toolCancelOrder(
  c: PoolClient,
  organizationId: string,
  orderId: string,
  expectedVersion?: number,
): Promise<{ ok: boolean; code: string; data?: unknown }> {
  if (!isValidUuid(orderId)) return { ok: false, code: 'INVALID_ARGUMENT' };

  const query = expectedVersion != null
    ? `UPDATE orders
       SET status = 'CANCELLED', cancelled_at = now(), version = version + 1, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED') AND version = $3
       RETURNING *`
    : `UPDATE orders
       SET status = 'CANCELLED', cancelled_at = now(), version = version + 1, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED')
       RETURNING *`;

  const params = expectedVersion != null ? [organizationId, orderId, expectedVersion] : [organizationId, orderId];
  const res = await c.query(query, params);

  if (res.rows.length === 0) return { ok: false, code: 'INVALID_TRANSITION' };
  return { ok: true, code: 'OK', data: { order: res.rows[0] } };
}

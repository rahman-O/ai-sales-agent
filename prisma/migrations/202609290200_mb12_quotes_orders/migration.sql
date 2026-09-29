-- MB-12: Non-booking transaction primitives (Quotes and Orders with line items).

-- 1. Quotes
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PRESENTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  currency char(3) NOT NULL DEFAULT 'IQD',
  subtotal_amount_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  total_amount_minor bigint NOT NULL DEFAULT 0 CHECK (total_amount_minor >= 0),
  expires_at timestamptz,
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  metadata_json jsonb CHECK (metadata_json IS NULL OR jsonb_typeof(metadata_json) = 'object'),
  presented_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX quotes_lookup_idx ON quotes (organization_id, status, created_at DESC);
CREATE INDEX quotes_customer_idx ON quotes (organization_id, customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON quotes TO app_runtime;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quotes
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- 2. Quote Line Items
CREATE TABLE quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  description_snapshot text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  line_total_amount_minor bigint NOT NULL CHECK (line_total_amount_minor >= 0),
  metadata_json jsonb CHECK (metadata_json IS NULL OR jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX quote_line_items_quote_idx ON quote_line_items (organization_id, quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON quote_line_items TO app_runtime;

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quote_line_items
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- 3. Orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED')),
  currency char(3) NOT NULL DEFAULT 'IQD',
  subtotal_amount_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  total_amount_minor bigint NOT NULL DEFAULT 0 CHECK (total_amount_minor >= 0),
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  metadata_json jsonb CHECK (metadata_json IS NULL OR jsonb_typeof(metadata_json) = 'object'),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX orders_lookup_idx ON orders (organization_id, status, created_at DESC);
CREATE INDEX orders_customer_idx ON orders (organization_id, customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO app_runtime;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- 4. Order Line Items
CREATE TABLE order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE SET NULL,
  description_snapshot text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  line_total_amount_minor bigint NOT NULL CHECK (line_total_amount_minor >= 0),
  metadata_json jsonb CHECK (metadata_json IS NULL OR jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX order_line_items_order_idx ON order_line_items (organization_id, order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON order_line_items TO app_runtime;

ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_line_items
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- MB-05: Generic Offers & Promotions System

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  description text CHECK (description IS NULL OR length(btrim(description)) <= 2000),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
  offer_type text NOT NULL CHECK (offer_type IN ('PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'FIXED_PRICE', 'INFORMATIONAL')),
  discount_percentage integer CHECK (discount_percentage IS NULL OR (discount_percentage >= 1 AND discount_percentage <= 100)),
  discount_amount_minor bigint CHECK (discount_amount_minor IS NULL OR discount_amount_minor >= 0),
  currency char(3) CHECK (currency IS NULL OR currency = upper(currency)),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 0 CHECK (priority >= 0),
  stackable boolean NOT NULL DEFAULT false,
  eligibility text NOT NULL DEFAULT 'ANY_CUSTOMER' CHECK (eligibility IN ('ANY_CUSTOMER', 'NEW_CUSTOMER', 'EXISTING_CUSTOMER')),
  metadata_json jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CONSTRAINT valid_offer_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX offers_org_status_dates_idx ON offers (organization_id, status, starts_at, ends_at);

CREATE TABLE offer_catalog_items (
  organization_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, offer_id, catalog_item_id),
  FOREIGN KEY (organization_id, offer_id) REFERENCES offers(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, catalog_item_id) REFERENCES catalog_items(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX offer_catalog_items_org_item_idx ON offer_catalog_items (organization_id, catalog_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON offers, offer_catalog_items TO app_runtime;

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON offers
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

ALTER TABLE offer_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_catalog_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON offer_catalog_items
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

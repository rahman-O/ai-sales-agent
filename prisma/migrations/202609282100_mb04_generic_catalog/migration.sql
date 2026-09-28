-- MB-04: Generic Business Catalog

CREATE TABLE catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('SERVICE', 'PRODUCT', 'LISTING', 'PACKAGE', 'OTHER')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  description text CHECK (description IS NULL OR length(btrim(description)) <= 2000),
  sku text CHECK (sku IS NULL OR length(btrim(sku)) <= 64),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency char(3) CHECK (currency IS NULL OR currency = upper(currency)),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  metadata_json jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX catalog_items_org_kind_status_idx ON catalog_items (organization_id, kind, status);
CREATE INDEX catalog_items_org_status_name_idx ON catalog_items (organization_id, status, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_items TO app_runtime;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON catalog_items
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Add catalog_item_id to services
ALTER TABLE services ADD COLUMN catalog_item_id uuid;
ALTER TABLE services ADD CONSTRAINT services_catalog_item_id_key UNIQUE (catalog_item_id);
ALTER TABLE services ADD CONSTRAINT services_org_catalog_item_unique UNIQUE (organization_id, catalog_item_id);
ALTER TABLE services ADD CONSTRAINT services_catalog_item_fkey
  FOREIGN KEY (organization_id, catalog_item_id)
  REFERENCES catalog_items(organization_id, id)
  ON DELETE SET NULL;

-- Backfill: For each existing service, create a corresponding CatalogItem and link it
DO $$
DECLARE
  svc RECORD;
  new_cat_id uuid;
BEGIN
  FOR svc IN SELECT * FROM services WHERE catalog_item_id IS NULL LOOP
    new_cat_id := gen_random_uuid();
    INSERT INTO catalog_items (
      id,
      organization_id,
      kind,
      name,
      description,
      sku,
      amount_minor,
      currency,
      status,
      metadata_json,
      version,
      archived_at,
      created_at,
      updated_at
    ) VALUES (
      new_cat_id,
      svc.organization_id,
      'SERVICE',
      svc.name,
      NULL,
      NULL,
      svc.amount_minor,
      svc.currency,
      CASE
        WHEN svc.archived_at IS NOT NULL THEN 'ARCHIVED'
        WHEN svc.active = true THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END,
      NULL,
      svc.version,
      svc.archived_at,
      svc.created_at,
      svc.updated_at
    );

    UPDATE services
    SET catalog_item_id = new_cat_id
    WHERE organization_id = svc.organization_id AND id = svc.id;
  END LOOP;
END $$;

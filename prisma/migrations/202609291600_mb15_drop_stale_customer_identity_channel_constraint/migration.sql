-- Drop stale customer_identities constraint that was not dropped in P03 due to 63-character truncation.
-- P03 replaced this with customer_identities_org_connection_address_key (organization_id, channel_connection_id, external_address).
ALTER TABLE customer_identities
  DROP CONSTRAINT IF EXISTS customer_identities_organization_id_channel_external_addres_key;

-- Close Phase 02 relational gaps identified during security review.
CREATE UNIQUE INDEX locations_one_active_per_org_idx
  ON locations (organization_id)
  WHERE active AND archived_at IS NULL;

ALTER TABLE staff_members
  ADD CONSTRAINT staff_members_active_org_member_fk
  FOREIGN KEY (organization_id, member_user_id)
  REFERENCES organization_members(organization_id, user_id)
  ON DELETE RESTRICT;

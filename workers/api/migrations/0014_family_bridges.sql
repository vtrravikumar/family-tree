-- Family bridges connect independently managed family workspaces.
-- Person-family ownership is validated transactionally by the API.
CREATE TABLE family_bridges (
  id TEXT PRIMARY KEY,
  family_a_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  family_b_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  anchor_a_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  anchor_b_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  connector_a_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  connector_b_person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL DEFAULT 'marriage' CHECK (relationship_type = 'marriage'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','revoked')),
  initiated_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  initiating_family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  rejected_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TEXT,
  rejection_reason TEXT,
  revoked_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TEXT,
  revocation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (family_a_id < family_b_id),
  CHECK (family_a_id <> family_b_id),
  CHECK (initiating_family_id = family_a_id OR initiating_family_id = family_b_id),
  CHECK ((status = 'active' AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
      OR (status <> 'active')),
  CHECK ((status = 'rejected' AND rejected_by_user_id IS NOT NULL AND rejected_at IS NOT NULL)
      OR (status <> 'rejected')),
  CHECK ((status = 'revoked' AND revoked_by_user_id IS NOT NULL AND revoked_at IS NOT NULL)
      OR (status <> 'revoked'))
);

CREATE UNIQUE INDEX family_bridges_unique_live_connection
  ON family_bridges(
    family_a_id, family_b_id,
    anchor_a_person_id, anchor_b_person_id,
    connector_a_person_id, connector_b_person_id,
    relationship_type
  )
  WHERE status IN ('pending','active');

CREATE INDEX family_bridges_family_a_status ON family_bridges(family_a_id,status);
CREATE INDEX family_bridges_family_b_status ON family_bridges(family_b_id,status);
CREATE INDEX family_bridges_initiator ON family_bridges(initiated_by_user_id,created_at);

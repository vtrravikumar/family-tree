-- Identity association is separate from family membership and person history.
-- This migration creates empty tables; it does not modify existing family records.
PRAGMA foreign_keys = ON;

CREATE TABLE person_identity_links (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (family_id, person_id),
  UNIQUE (family_id, user_id),
  FOREIGN KEY (person_id, family_id) REFERENCES persons(id, family_id) ON DELETE CASCADE
);

CREATE TABLE person_identity_claims (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_at TEXT NOT NULL,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_reason TEXT,
  FOREIGN KEY (person_id, family_id) REFERENCES persons(id, family_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX one_pending_identity_claim_per_account_person
  ON person_identity_claims(family_id, person_id, requester_user_id)
  WHERE status = 'pending';
CREATE INDEX identity_claims_pending_by_family
  ON person_identity_claims(family_id, requested_at)
  WHERE status = 'pending';
CREATE INDEX identity_claims_by_requester
  ON person_identity_claims(family_id, requester_user_id, requested_at);

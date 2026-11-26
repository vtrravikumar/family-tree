-- Durable retry queue for R2 portrait objects whose deletion did not complete.
-- Intentionally has no family/person foreign key so cleanup survives family cascades.
CREATE TABLE person_photo_cleanup (
  object_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX person_photo_cleanup_by_created ON person_photo_cleanup(created_at);

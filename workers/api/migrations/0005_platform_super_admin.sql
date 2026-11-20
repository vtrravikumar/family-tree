-- Platform-level administrators are separate from family membership roles.
CREATE TABLE platform_super_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE platform_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX platform_audit_by_actor ON platform_audit_logs(actor_user_id, created_at);
CREATE INDEX platform_audit_by_target ON platform_audit_logs(target_type, target_id, created_at);

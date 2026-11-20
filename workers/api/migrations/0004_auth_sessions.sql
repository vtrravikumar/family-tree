-- Server-managed browser sessions. Store only SHA-256 hashes of opaque session tokens.
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX auth_sessions_by_user ON auth_sessions(user_id);
CREATE INDEX auth_sessions_by_expiry ON auth_sessions(expires_at);

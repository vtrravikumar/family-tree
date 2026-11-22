CREATE TABLE api_rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count > 0),
  PRIMARY KEY(scope, key_hash)
);

CREATE INDEX api_rate_limits_expiry ON api_rate_limits(scope, window_started_at);

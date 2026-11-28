-- One platform-wide identity matching policy. Family workspaces cannot override it.
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO platform_settings(key,value_json,updated_by_user_id,updated_at)
VALUES(
  'identity_name_matching_policy',
  '{"enabled":true,"allowPartial":true,"minMatchingTokens":1,"ignoreCase":true,"ignorePunctuation":true,"allowMissingMiddle":true,"allowTokenOrderVariations":true}',
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);

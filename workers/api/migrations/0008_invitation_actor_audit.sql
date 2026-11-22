ALTER TABLE invitations ADD COLUMN accepted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invitations ADD COLUMN revoked_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

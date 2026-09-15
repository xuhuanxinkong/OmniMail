CREATE TABLE icloud_alias_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icloud_account_id TEXT NOT NULL REFERENCES icloud_accounts(id) ON DELETE CASCADE,
  alias_email TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, alias_email, tag_name)
);

CREATE INDEX idx_icloud_alias_tags_account
  ON icloud_alias_tags(user_id, icloud_account_id, alias_email);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'public',
  badge TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  visitor_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_events_app_type ON app_events(app_id, event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_app_status ON comments(app_id, status, created_at);

import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dataDir = path.resolve(process.cwd(), 'storage')
const dbFile = path.resolve(dataDir, 'local.sqlite')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbFile)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role INTEGER NOT NULL DEFAULT 4,
  limite INTEGER NOT NULL DEFAULT 100000,
  gerado INTEGER NOT NULL DEFAULT 0,
  limit_page_upload INTEGER NOT NULL DEFAULT 200,
  foto TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'completed',
  internal_status TEXT NOT NULL DEFAULT 'idle',
  source_lang TEXT NOT NULL DEFAULT 'auto',
  target_lang TEXT NOT NULL DEFAULT 'pt-BR',
  provider_lang TEXT NOT NULL DEFAULT 'google',
  include_logs INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS section_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  original_path TEXT NOT NULL,
  translated_path TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  translation_status TEXT NOT NULL DEFAULT 'translated',
  selected_for_processing INTEGER NOT NULL DEFAULT 1,
  source_lang TEXT,
  target_lang TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS section_image_ocr_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_image_id INTEGER NOT NULL,
  det_id INTEGER NOT NULL,
  cls_name TEXT,
  conf REAL,
  x1 INTEGER NOT NULL,
  y1 INTEGER NOT NULL,
  x2 INTEGER NOT NULL,
  y2 INTEGER NOT NULL,
  ocr_text TEXT NOT NULL DEFAULT '',
  translated_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(section_image_id) REFERENCES section_images(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_section_image_ocr_items_image ON section_image_ocr_items(section_image_id);
`)

export { db }

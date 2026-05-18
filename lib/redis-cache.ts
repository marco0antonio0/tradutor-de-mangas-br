import 'server-only'

import { db } from '@/lib/local-backend/db'

const DEFAULT_LOCAL_TTL_SECONDS = 300

function nowMs() {
  return Date.now()
}

function purgeExpired() {
  db.prepare('DELETE FROM kv_store WHERE expires_at IS NOT NULL AND expires_at <= ?').run(nowMs())
}

function getRaw(key: string): string | null {
  purgeExpired()
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export async function redisGetString(key: string) {
  return getRaw(key)
}

export async function redisMGetStrings(keys: string[]) {
  if (keys.length === 0) return []
  purgeExpired()

  const stmt = db.prepare('SELECT key, value FROM kv_store WHERE key = ?')
  return keys.map((key) => {
    const row = stmt.get(key) as { key: string; value: string } | undefined
    return row?.value ?? null
  })
}

export async function redisSetString(key: string, value: string, ttlSeconds?: number | null) {
  const ttl = typeof ttlSeconds === 'number'
    ? ttlSeconds
    : DEFAULT_LOCAL_TTL_SECONDS
  const expiresAt = ttl > 0 ? nowMs() + Math.floor(ttl * 1000) : null

  db.prepare(`
    INSERT INTO kv_store (key, value, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
  `).run(key, value, expiresAt)
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const raw = await redisGetString(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds?: number | null) {
  return redisSetString(key, JSON.stringify(value), ttlSeconds)
}

export async function redisDeleteByPrefix(prefix: string, _scanCount = 200) {
  db.prepare('DELETE FROM kv_store WHERE key LIKE ?').run(`${prefix}%`)
}

export async function redisHGetAll(_key: string): Promise<Record<string, string> | null> {
  return null
}

export async function redisLLen(_key: string): Promise<number | null> {
  return null
}

export async function redisLPos(_key: string, _element: string): Promise<number | null> {
  return null
}

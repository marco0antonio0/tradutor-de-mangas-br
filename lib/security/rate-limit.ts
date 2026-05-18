import { db } from '@/lib/backend/shared/database.module'

function nowMs() {
  return Date.now()
}

function keyFor(scope: string, identifier: string) {
  return `ratelimit:${scope}:${identifier}`
}

type Stored = { count: number; resetAt: number }

function readState(key: string): Stored | null {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1').get(key) as { value?: string } | undefined
  if (!row?.value) return null
  try {
    const parsed = JSON.parse(String(row.value)) as Partial<Stored>
    const count = Number(parsed.count ?? 0)
    const resetAt = Number(parsed.resetAt ?? 0)
    if (!Number.isFinite(count) || !Number.isFinite(resetAt)) return null
    return { count, resetAt }
  } catch {
    return null
  }
}

function writeState(key: string, state: Stored, ttlMs: number) {
  db.prepare(`
    INSERT INTO kv_store (key, value, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
  `).run(key, JSON.stringify(state), nowMs() + ttlMs)
}

export function consumeRateLimit(scope: string, identifier: string, limit: number, windowMs: number) {
  const key = keyFor(scope, identifier)
  const current = nowMs()
  const existing = readState(key)

  const resetAt = existing && existing.resetAt > current ? existing.resetAt : current + windowMs
  const count = existing && existing.resetAt > current ? existing.count + 1 : 1

  writeState(key, { count, resetAt }, windowMs)

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: Math.max(1, Math.ceil((resetAt - current) / 1000)),
  }
}

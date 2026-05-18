import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/backend/shared/database.module'
import type { LocalUser, LoginResult } from './auth.types'

function mapUser(row: any): LocalUser {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    role: Number(row.role ?? 0),
    limite: Number(row.limite ?? 0),
    gerado: Number(row.gerado ?? 0),
    limit_page_upload: Number(row.limit_page_upload ?? 0),
    foto: row.foto ? String(row.foto) : null,
  }
}

export class AuthRepository {
  hasAnyUser() {
    const row = db.prepare('SELECT COUNT(1) AS total FROM users').get() as { total?: number } | undefined
    return Number(row?.total ?? 0) > 0
  }

  createInitialAdmin(name: string, email: string, password: string) {
    const hasUsers = this.hasAnyUser()
    if (hasUsers) {
      return { ok: false as const, reason: 'already_initialized' as const }
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, limite, gerado, limit_page_upload, created_at, updated_at)
      VALUES (?, ?, ?, 4, 100000, 0, 200, ?, ?)
    `).run(name, email, passwordHash, now, now)

    return { ok: true as const, userId: Number(result.lastInsertRowid) }
  }

  loginWithEmailPassword(email: string, password: string): LoginResult | null {
    const userRow = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as any
    if (!userRow) return null
    if (!bcrypt.compareSync(password, String(userRow.password_hash))) return null

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
      token,
      Number(userRow.id),
      expiresAt,
      now
    )

    return { token, user: mapUser(userRow) }
  }

  getUserFromToken(token: string | null | undefined): LocalUser | null {
    if (!token) return null

    const row = db.prepare(`
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > ?
      LIMIT 1
    `).get(token, new Date().toISOString()) as any

    if (!row) return null
    return mapUser(row)
  }

  deleteSession(token: string | null | undefined) {
    if (!token) return
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
}

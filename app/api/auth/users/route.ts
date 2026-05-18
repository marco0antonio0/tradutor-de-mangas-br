import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/backend/shared/database.module'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

function forbiddenResponse() {
  return NextResponse.json(
    { message: 'Acesso negado', error: 'Forbidden', statusCode: 403 },
    { status: 403 }
  )
}

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  const rows = db.prepare(`
    SELECT id, name, email, role, limite, gerado, limit_page_upload, foto, created_at
    FROM users
    ORDER BY id ASC
  `).all() as Array<{
    id: number
    name: string
    email: string
    role: number
    limite: number
    gerado: number
    limit_page_upload: number
    foto: string | null
    created_at: string
  }>

  return NextResponse.json(rows.map((row) => ({
    id: Number(row.id),
    idUser: Number(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    role: Number(row.role ?? 0),
    limite: Number(row.limite ?? 0),
    gerado: Number(row.gerado ?? 0),
    limit_page_upload: Number(row.limit_page_upload ?? 0),
    foto: row.foto ? String(row.foto) : null,
    createdAt: String(row.created_at ?? ''),
  })))
}

export async function POST(request: Request) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json(
      { message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 },
      { status: 403 }
    )
  }

  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  let payload: unknown = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const roleRaw = typeof body.role === 'number' ? body.role : Number(body.role)
  const role = Number.isFinite(roleRaw) ? Math.max(0, Math.min(4, Math.floor(roleRaw))) : 0

  if (!name || !email || !password) {
    return NextResponse.json(
      { message: 'Nome, email e senha são obrigatórios', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }
  if (password.length < 6) {
    return NextResponse.json(
      { message: 'Senha deve ter pelo menos 6 caracteres', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email) as { id?: number } | undefined
  if (existing?.id) {
    return NextResponse.json(
      { message: 'Email já cadastrado', error: 'Conflict', statusCode: 409 },
      { status: 409 }
    )
  }

  const passwordHash = bcrypt.hashSync(password, 10)
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, limite, gerado, limit_page_upload, created_at, updated_at)
    VALUES (?, ?, ?, ?, 100000, 0, 200, ?, ?)
  `).run(name, email, passwordHash, role, now, now)

  return NextResponse.json(
    {
      id: Number(result.lastInsertRowid),
      name,
      email,
      role,
      message: 'Usuário criado com sucesso.',
    },
    { status: 201 }
  )
}

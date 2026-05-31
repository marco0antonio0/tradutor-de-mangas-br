import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import { parseJsonBody } from '@/app/api/_shared/validation'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/backend/shared/database.module'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

function forbiddenResponse() {
  return NextResponse.json(
    { message: 'Acesso negado', error: 'Forbidden', statusCode: 403 },
    { status: 403 }
  )
}

const createUserBodySchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().email('Email inválido').transform((v) => v.toLowerCase()),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.coerce.number().int().min(0).max(4).default(0),
})

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

  const parsedBody = await parseJsonBody(request, createUserBodySchema)
  if (!parsedBody.success) return parsedBody.response
  const { name, email, password, role } = parsedBody.data

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

import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/backend/shared/database.module'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

type RouteParams = { params: Promise<{ id: string }> }

function forbiddenResponse() {
  return NextResponse.json(
    { message: 'Acesso negado', error: 'Forbidden', statusCode: 403 },
    { status: 403 }
  )
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json(
      { message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 },
      { status: 403 }
    )
  }

  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  const { id } = await params
  const userId = Number.parseInt(id, 10)
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { message: 'ID inválido', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  let payload: unknown = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!newPassword || newPassword.trim().length < 6) {
    return NextResponse.json(
      { message: 'Nova senha deve ter pelo menos 6 caracteres', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id?: number } | undefined
  if (!existing?.id) {
    return NextResponse.json(
      { message: 'Usuário não encontrado', error: 'Not Found', statusCode: 404 },
      { status: 404 }
    )
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    passwordHash,
    new Date().toISOString(),
    userId
  )

  return NextResponse.json({ success: true, message: 'Senha atualizada com sucesso.' })
}

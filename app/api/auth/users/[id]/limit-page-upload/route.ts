import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
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
  const limitRaw = typeof body.limit_page_upload === 'number'
    ? body.limit_page_upload
    : Number(body.limit_page_upload)
  const limitPageUpload = Number.isFinite(limitRaw) ? Math.max(0, Math.floor(limitRaw)) : NaN

  if (!Number.isFinite(limitPageUpload)) {
    return NextResponse.json(
      { message: 'Limite de páginas inválido', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const existing = db.prepare('SELECT id, limite, gerado FROM users WHERE id = ?').get(userId) as {
    id?: number
    limite?: number
    gerado?: number
  } | undefined
  if (!existing?.id) {
    return NextResponse.json(
      { message: 'Usuário não encontrado', error: 'Not Found', statusCode: 404 },
      { status: 404 }
    )
  }

  db.prepare('UPDATE users SET limit_page_upload = ?, updated_at = ? WHERE id = ?').run(
    limitPageUpload,
    new Date().toISOString(),
    userId
  )

  return NextResponse.json({
    id: userId,
    limite: Number(existing.limite ?? 0),
    gerado: Number(existing.gerado ?? 0),
    limit_page_upload: limitPageUpload,
    message: 'Limite de páginas atualizado.',
  })
}

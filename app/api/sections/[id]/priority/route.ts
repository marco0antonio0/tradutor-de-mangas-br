import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { updateSectionPriority } from '@/lib/local-backend/sections'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

type RouteParams = { params: Promise<{ id: string }> }

function unauthorized() {
  return NextResponse.json(
    { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
    { status: 401 }
  )
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const cookieStore = await cookies()
  const user = getUserFromToken(cookieStore.get(AUTH_TOKEN_COOKIE)?.value)
  if (!user) return unauthorized()

  const { id } = await params
  const sectionId = Number(id)
  if (!Number.isFinite(sectionId) || sectionId <= 0) {
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })
  }

  let payload: { priority?: unknown } = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const priority = Math.max(0, Math.min(10, Math.floor(Number(payload.priority ?? 10))))
  if (!Number.isFinite(priority)) {
    return NextResponse.json({ message: 'Prioridade inválida.' }, { status: 400 })
  }

  const ok = updateSectionPriority(sectionId, user.id, priority)
  if (!ok) return NextResponse.json({ message: 'Seção não encontrada.' }, { status: 404 })

  return NextResponse.json({ id: sectionId, priority })
}

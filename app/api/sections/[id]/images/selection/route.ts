import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { updateImageSelection } from '@/lib/local-backend/sections'

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

  let payload: { selection?: unknown; images?: unknown } = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const raw = (payload.selection ?? payload.images) as unknown
  const selection: Record<number, boolean> = {}

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as { id?: unknown; selected?: unknown; selected_for_processing?: unknown }
      const imageId = Number(item.id)
      const value = item.selected ?? item.selected_for_processing
      if (!Number.isFinite(imageId)) continue
      selection[imageId] = Boolean(value)
    }
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const imageId = Number(key)
      if (!Number.isFinite(imageId)) continue
      selection[imageId] = Boolean(value)
    }
  }

  const ok = updateImageSelection(sectionId, user.id, selection)
  if (!ok) return NextResponse.json({ message: 'Seção não encontrada.' }, { status: 404 })

  return NextResponse.json({ id: sectionId, updated: Object.keys(selection).length })
}

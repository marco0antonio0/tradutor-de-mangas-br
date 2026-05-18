import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { deleteSection, getSectionDetail } from '@/lib/local-backend/sections'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
type RouteParams = { params: Promise<{ id: string }> }

function unauthorized() {
  return NextResponse.json(
    { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
    { status: 401 }
  )
}

export async function GET(_: Request, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)
  if (!user) return unauthorized()

  const { id } = await params
  const sectionId = Number.parseInt(id, 10)
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ message: 'ID inválido', error: 'Bad Request', statusCode: 400 }, { status: 400 })
  }

  const section = getSectionDetail(sectionId, user.id)
  if (!section) {
    return NextResponse.json({ message: 'Seção não encontrada', error: 'Not Found', statusCode: 404 }, { status: 404 })
  }

  return NextResponse.json(section)
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)
  if (!user) return unauthorized()

  const { id } = await params
  const sectionId = Number.parseInt(id, 10)
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ message: 'ID inválido', error: 'Bad Request', statusCode: 400 }, { status: 400 })
  }

  const ok = deleteSection(sectionId, user.id)
  if (!ok) {
    return NextResponse.json({ message: 'Seção não encontrada', error: 'Not Found', statusCode: 404 }, { status: 404 })
  }

  return NextResponse.json({ message: 'Seção removida com sucesso' })
}

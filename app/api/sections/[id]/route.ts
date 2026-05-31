import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { deleteSection, getSectionDetail } from '@/lib/local-backend/sections'
import { parseParams } from '@/app/api/_shared/validation'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
type RouteParams = { params: Promise<{ id: string }> }
const sectionParamsSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
})

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

  const parsedParams = parseParams(await params, sectionParamsSchema)
  if (!parsedParams.success) return parsedParams.response
  const sectionId = parsedParams.data.id

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

  const parsedParams = parseParams(await params, sectionParamsSchema)
  if (!parsedParams.success) return parsedParams.response
  const sectionId = parsedParams.data.id

  const ok = deleteSection(sectionId, user.id)
  if (!ok) {
    return NextResponse.json({ message: 'Seção não encontrada', error: 'Not Found', statusCode: 404 }, { status: 404 })
  }

  return NextResponse.json({ message: 'Seção removida com sucesso' })
}

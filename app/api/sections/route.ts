import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { createSectionFromFormData, listSections } from '@/lib/local-backend/sections'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

function unauthorized() {
  return NextResponse.json(
    { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
    { status: 401 }
  )
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)
  if (!user) return unauthorized()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const perPage = Math.max(1, Math.min(100, Number.parseInt(searchParams.get('per_page') || '12', 10) || 12))

  const allSections = listSections(user.id)
  const total = allSections.length
  const start = (page - 1) * perPage
  const items = allSections.slice(start, start + perPage)
  const lastPage = Math.max(1, Math.ceil(total / perPage))

  return NextResponse.json({
    sections: items,
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: lastPage,
      from: total === 0 ? null : start + 1,
      to: total === 0 ? null : Math.min(start + perPage, total),
    },
    links: {
      first: null,
      last: null,
      prev: page > 1 ? '#' : null,
      next: page < lastPage ? '#' : null,
    },
  })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)
  if (!user) return unauthorized()

  try {
    const formData = await request.formData()
    const sectionId = await createSectionFromFormData(user.id, formData)
    return NextResponse.json({
      message: 'Seção criada com sucesso',
      section: { id: sectionId },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar seção'
    return NextResponse.json({ message, error: 'Bad Request', statusCode: 400 }, { status: 400 })
  }
}

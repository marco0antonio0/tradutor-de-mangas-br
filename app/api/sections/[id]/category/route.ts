import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

function unauthorized() {
  return NextResponse.json(
    { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
    { status: 401 }
  )
}

async function requireUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  return getUserFromToken(token)
}

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorized()

  return NextResponse.json({
    category: null,
    categories: [],
    category_items: [],
  })
}

export async function PUT() {
  const user = await requireUser()
  if (!user) return unauthorized()

  return NextResponse.json({
    category: null,
    message: 'Categorias não estão disponíveis nesta instância local.',
  })
}

export async function DELETE() {
  const user = await requireUser()
  if (!user) return unauthorized()

  return NextResponse.json({
    category: null,
    message: 'Categorias não estão disponíveis nesta instância local.',
  })
}

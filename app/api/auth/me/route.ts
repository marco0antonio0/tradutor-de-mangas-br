import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)

  if (!user) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  return NextResponse.json({
    idUser: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    limite: null,
    gerado: 0,
    limit_page_upload: null,
    foto: user.foto,
  })
}

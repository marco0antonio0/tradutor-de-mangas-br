import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)

  if (!user) {
    cookieStore.delete(AUTH_TOKEN_COOKIE)
    return NextResponse.json(
      { authenticated: false, reason: 'expired_token', error: 'Sessão expirada' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      limite: null,
      gerado: 0,
      limit_page_upload: null,
      foto: user.foto,
    },
  })
}

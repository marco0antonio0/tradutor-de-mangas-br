import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'

export const AUTH_TOKEN_COOKIE = 'manga-access-token'

export function unauthorizedPayload() {
  return { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 }
}

export function unauthorizedResponse() {
  return NextResponse.json(unauthorizedPayload(), { status: 401 })
}

export async function requireUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  return getUserFromToken(token)
}

export function isSessionExpiredStatus(status: number) {
  return status === 401 || status === 403
}

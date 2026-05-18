import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

function isStateChangingMethod(method: string) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
}

function firstHeaderValue(value: string | null) {
  if (!value) return null
  return value.split(',')[0]?.trim() || null
}

function isTrustedOrigin(request: NextRequest) {
  const origin = firstHeaderValue(request.headers.get('origin'))
  if (!origin) return false

  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'))
  const host = forwardedHost || firstHeaderValue(request.headers.get('host'))
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))
  if (!host) return false

  const proto = forwardedProto || request.nextUrl.protocol.replace(':', '')
  const expectedOrigin = `${proto}://${host}`
  return origin === expectedOrigin
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://openrouter.ai; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  )

  if (pathname.startsWith('/api/') && isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json(
      {
        message: 'Origem não autorizada',
        error: 'Forbidden',
        statusCode: 403,
      },
      { status: 403 }
    )
  }

  // Rotas de autenticação são tratadas pelas APIs /api/auth/*
  if (pathname.startsWith('/api/auth/')) {
    return response
  }

  // Rotas públicas de compartilhamento não exigem sessão
  if (pathname.startsWith('/api/public/')) {
    return response
  }

  // Setup inicial precisa ser público na primeira execução
  if (pathname.startsWith('/api/setup/')) {
    return response
  }

  // Rotas públicas de tradução da landing (/)
  if (pathname === '/api/translate' || pathname.startsWith('/api/translate/')) {
    return response
  }

  // Verificar presença de sessão para demais rotas /api/*
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)

    if (!token) {
      return NextResponse.json(
        {
          message: 'Token inválido ou expirado',
          error: 'Unauthorized',
          statusCode: 401,
        },
        { status: 401 }
      )
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authController } from '@/lib/backend/auth/auth.module'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

function shouldUseSecureCookie(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedProto) return forwardedProto === 'https'

  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
      return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403 })
    }

    const clientIp = request.headers.get('x-real-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'local'
    const body = await request.json() as { email?: string; password?: string }
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')

    const ipLimiter = consumeRateLimit('auth-login-ip', clientIp, 20, 5 * 60 * 1000)
    if (!ipLimiter.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(ipLimiter.retryAfterSec) } }
      )
    }
    const emailKey = email.toLowerCase() || 'unknown'
    const emailLimiter = consumeRateLimit('auth-login-email', emailKey, 8, 10 * 60 * 1000)
    if (!emailLimiter.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas para este usuário. Aguarde alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(emailLimiter.retryAfterSec) } }
      )
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    if (!authController.hasAnyUser()) {
      return NextResponse.json({ error: 'Sistema não inicializado. Acesse /setup para criar o admin.' }, { status: 409 })
    }

    const login = authController.loginWithEmailPassword(email, password)
    if (!login) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set(AUTH_TOKEN_COOKIE, login.token, {
      httpOnly: true,
      secure: shouldUseSecureCookie(request),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      id: login.user.id,
    })
  } catch (error) {
    console.error('Login route error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

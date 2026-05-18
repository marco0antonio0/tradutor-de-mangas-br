import { NextResponse } from 'next/server'
import { authController } from '@/lib/backend/auth/auth.module'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

type SetupBody = {
  name?: unknown
  email?: unknown
  password?: unknown
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isLocalSetupRequest(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedFor && forwardedFor !== '127.0.0.1' && forwardedFor !== '::1') return false

  const host = request.headers.get('host')?.split(':')[0]?.trim().toLowerCase() ?? ''
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

export async function POST(request: Request) {
  try {
    if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
      return NextResponse.json({ message: 'Origem não autorizada.' }, { status: 403 })
    }
    if (!isLocalSetupRequest(request)) {
      return NextResponse.json({ message: 'Configuração inicial permitida apenas localmente.' }, { status: 403 })
    }

    const body = (await request.json()) as SetupBody
    const name = asText(body.name)
    const email = asText(body.email).toLowerCase()
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }

    const result = authController.createInitialAdmin(name, email, password)
    if (!result.ok) {
      return NextResponse.json(
        { message: 'Sistema já inicializado. Faça login normalmente.', reason: result.reason },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, userId: result.userId })
  } catch (error) {
    console.error('Setup admin route error:', error)
    return NextResponse.json({ message: 'Erro ao criar administrador inicial.' }, { status: 500 })
  }
}

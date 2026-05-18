import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'

export async function PUT() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  return NextResponse.json({
    idUser: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    foto: user.foto,
    message: 'Edição de perfil não está disponível nesta instância local.',
  })
}

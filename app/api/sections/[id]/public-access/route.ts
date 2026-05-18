import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'

export async function PATCH() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  return NextResponse.json({
    public_access: null,
    message: 'Compartilhamento público não está disponível nesta instância local.',
  })
}

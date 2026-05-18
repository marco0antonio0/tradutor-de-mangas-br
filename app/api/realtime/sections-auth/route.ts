import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  return NextResponse.json(
    { message: 'Realtime via WebSocket não está disponível nesta instância local.' },
    { status: 501 }
  )
}

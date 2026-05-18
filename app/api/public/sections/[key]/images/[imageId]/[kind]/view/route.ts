import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { message: 'Compartilhamento público não está disponível nesta instância local.' },
    { status: 404 }
  )
}

import { NextResponse } from 'next/server'
import { authController } from '@/lib/backend/auth/auth.module'

export async function GET() {
  const initialized = authController.hasAnyUser()
  return NextResponse.json({ initialized })
}

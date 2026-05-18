import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  return NextResponse.json({ sections: [], queue: [], meta: { total: 0 } })
}

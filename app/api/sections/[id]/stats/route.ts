import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: RouteParams) {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const { id } = await params
  return NextResponse.json({
    id: Number(id),
    stats: {
      total_images: 0,
      translated_images: 0,
      processing_images: 0,
      queued_images: 0,
      error_images: 0,
    },
  })
}

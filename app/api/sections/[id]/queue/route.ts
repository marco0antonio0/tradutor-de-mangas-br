import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import { parseParams } from '@/app/api/_shared/validation'
import { reprocessSection } from '@/lib/local-backend/sections'

type RouteParams = { params: Promise<{ id: string }> }
const sectionParamsSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
})

export async function POST(_: Request, { params }: RouteParams) {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const parsedParams = parseParams(await params, sectionParamsSchema)
  if (!parsedParams.success) return parsedParams.response
  const sectionId = parsedParams.data.id

  const ok = reprocessSection(sectionId, user.id)
  if (!ok) return NextResponse.json({ message: 'Seção não encontrada.' }, { status: 404 })

  return NextResponse.json({ id: sectionId, queued: true, status: 'processing' })
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const parsedParams = parseParams(await params, sectionParamsSchema)
  if (!parsedParams.success) return parsedParams.response
  return NextResponse.json({ id: parsedParams.data.id, cancelled: true })
}

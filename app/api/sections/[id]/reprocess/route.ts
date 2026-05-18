import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import { reprocessSection } from '@/lib/local-backend/sections'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_: Request, { params }: RouteParams) {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const { id } = await params
  const sectionId = Number(id)
  if (!Number.isFinite(sectionId) || sectionId <= 0) {
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })
  }

  const ok = reprocessSection(sectionId, user.id)
  if (!ok) return NextResponse.json({ message: 'Seção não encontrada.' }, { status: 404 })

  return NextResponse.json({ id: sectionId, status: 'processing' })
}

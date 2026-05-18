import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { redisGetJson, redisSetJson } from '@/lib/redis-cache'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
const READ_PROGRESS_TTL = 0

interface ReadProgressRecord {
  done: boolean
  updated_at: string
}

type RouteParams = { params: Promise<{ id: string }> }

function buildReadProgressKey(sectionId: string, userId: number) {
  const userIdentity = `id:${Math.floor(userId)}`
  return `manga:read-progress:v1:section:${sectionId}:user:${userIdentity}`
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)
  const { id } = await params

  if (!token?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = buildReadProgressKey(id, user.id)
  const data = await redisGetJson<ReadProgressRecord>(key)

  return NextResponse.json({ done: data?.done ?? false })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)
  const { id } = await params

  if (!token?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let done = false
  try {
    const body = (await request.json()) as Record<string, unknown>
    done = body.done === true
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = buildReadProgressKey(id, user.id)
  const record: ReadProgressRecord = { done, updated_at: new Date().toISOString() }

  await redisSetJson(key, record, READ_PROGRESS_TTL)

  return NextResponse.json({ ok: true })
}

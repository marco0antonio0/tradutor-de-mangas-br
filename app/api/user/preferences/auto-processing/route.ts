import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { redisGetJson, redisSetJson } from '@/lib/redis-cache'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
const USER_PREFERENCES_TTL_SECONDS = 0

interface AutoProcessingPreferenceRecord {
  auto_processing_enabled: boolean
  updated_at: string
}

function buildPreferenceKey(userId: number) {
  const userIdentity = `id:${Math.floor(userId)}`
  return `manga:user-preferences:v1:user:${userIdentity}`
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)

  if (!token?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = buildPreferenceKey(user.id)
  const data = await redisGetJson<AutoProcessingPreferenceRecord>(key)

  return NextResponse.json({
    auto_processing_enabled: data?.auto_processing_enabled ?? false,
  })
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)

  if (!token?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let enabled = false
  try {
    const body = (await request.json()) as Record<string, unknown>
    enabled = body.auto_processing_enabled === true
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = buildPreferenceKey(user.id)

  const nextRecord: AutoProcessingPreferenceRecord = {
    auto_processing_enabled: enabled,
    updated_at: new Date().toISOString(),
  }

  await redisSetJson(key, nextRecord, USER_PREFERENCES_TTL_SECONDS)

  return NextResponse.json({
    ok: true,
    auto_processing_enabled: enabled,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { redisMGetStrings } from '@/lib/redis-cache'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
const MAX_SECTION_IDS = 200

interface ReadProgressRecord {
  done: boolean
  updated_at: string
}

function buildReadProgressKey(sectionId: string, userId: number) {
  const userIdentity = `id:${Math.floor(userId)}`
  return `manga:read-progress:v1:section:${sectionId}:user:${userIdentity}`
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)

  if (!token?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const sectionIdsParam = searchParams.get('section_ids') ?? ''
  const rawIds = sectionIdsParam.split(',').map((s) => s.trim()).filter(Boolean)

  if (rawIds.length === 0) {
    return NextResponse.json({ done: {} })
  }

  const validIds = rawIds.filter((id) => /^\d+$/.test(id)).slice(0, MAX_SECTION_IDS)

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = validIds.map((id) => buildReadProgressKey(id, user.id))
  const values = await redisMGetStrings(keys)

  const done: Record<string, boolean> = {}
  for (let i = 0; i < validIds.length; i++) {
    const id = validIds[i]
    const value = values[i]
    if (!id || value === null) continue

    try {
      const parsed = JSON.parse(value) as ReadProgressRecord
      done[id] = parsed.done === true
    } catch {
      done[id] = false
    }
  }

  return NextResponse.json({ done })
}

import fs from 'node:fs'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/local-backend/auth'
import { resolveImageFile } from '@/lib/local-backend/sections'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

type RouteParams = { params: Promise<{ id: string; imageId: string; kind: string }> }

export async function GET(_: Request, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)

  if (!user) {
    return Response.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  const { id, imageId, kind } = await params
  if (kind !== 'original' && kind !== 'translated') {
    return Response.json(
      { message: 'Tipo de imagem inválido', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const sectionId = Number.parseInt(id, 10)
  const parsedImageId = Number.parseInt(imageId, 10)
  if (!Number.isFinite(sectionId) || !Number.isFinite(parsedImageId)) {
    return Response.json(
      { message: 'Parâmetros inválidos', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const file = resolveImageFile(sectionId, parsedImageId, kind, user.id)
  if (!file) {
    return Response.json(
      { message: 'Imagem não encontrada', error: 'Not Found', statusCode: 404 },
      { status: 404 }
    )
  }

  const buffer = fs.readFileSync(file.filePath)
  return new Response(buffer, {
    status: 200,
    headers: {
      'content-type': file.mime,
      'content-length': String(buffer.byteLength),
      'cache-control': 'private, max-age=86400, stale-while-revalidate=604800',
      vary: 'Cookie',
    },
  })
}

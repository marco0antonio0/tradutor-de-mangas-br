import { cookies } from 'next/headers'
import { deleteSession } from '@/lib/local-backend/auth'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

export async function POST(request: Request) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return Response.json(
      { message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 },
      { status: 403 }
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  deleteSession(token)
  cookieStore.delete(AUTH_TOKEN_COOKIE)
  return Response.json({ success: true })
}

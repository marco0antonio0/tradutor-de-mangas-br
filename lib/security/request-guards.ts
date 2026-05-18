export function isStateChangingMethod(method: string) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
}

function firstHeaderValue(value: string | null) {
  if (!value) return null
  return value.split(',')[0]?.trim() || null
}

export function isTrustedOrigin(request: Request) {
  const origin = firstHeaderValue(request.headers.get('origin'))
  if (!origin) return false

  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'))
  const host = forwardedHost || firstHeaderValue(request.headers.get('host'))
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))

  if (!host) return false

  let expectedOrigin = ''
  if (forwardedProto) {
    expectedOrigin = `${forwardedProto}://${host}`
  } else {
    try {
      const url = new URL(request.url)
      expectedOrigin = `${url.protocol}//${host}`
    } catch {
      expectedOrigin = `http://${host}`
    }
  }

  return origin === expectedOrigin
}

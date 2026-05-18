import 'server-only'

// API Python (FastAPI) — execução local na mesma máquina.
export const MODEL_API_BASE_URL = process.env.MODEL_API_BASE_URL || 'http://localhost:8023'

// Sem autenticação por chave: a API Python só escuta em localhost.
export const MODEL_API_KEY = ''

export function buildModelApiUrl(path: string) {
  if (path.startsWith('/')) return `${MODEL_API_BASE_URL}${path}`
  return `${MODEL_API_BASE_URL}/${path}`
}

export function modelApiHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...extra,
  }

  if (MODEL_API_KEY) headers['X-API-Key'] = MODEL_API_KEY
  return headers
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/backend/shared/database.module'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import { decryptSecret, encryptSecret } from '@/lib/security/secrets'
import { isStateChangingMethod, isTrustedOrigin } from '@/lib/security/request-guards'

const OPENROUTER_KEY_KV = 'manga:openrouter:api_key'
const OPENROUTER_MODEL_KV = 'manga:openrouter:model'
const ALLOWED_MODELS = ['google/gemma-4-31b-it'] as const

function forbiddenResponse() {
  return NextResponse.json(
    { message: 'Acesso negado', error: 'Forbidden', statusCode: 403 },
    { status: 403 }
  )
}

function getKv(key: string): string | null {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1').get(key) as { value?: string } | undefined
  return row?.value ? String(row.value) : null
}

function getOpenRouterApiKey(): string | null {
  const raw = getKv(OPENROUTER_KEY_KV)
  if (!raw) return null

  const decrypted = decryptSecret(raw)
  if (decrypted) return decrypted

  // Migração automática de valor legado em texto puro.
  setKv(OPENROUTER_KEY_KV, encryptSecret(raw))
  return raw
}

function setKv(key: string, value: string) {
  db.prepare(`
    INSERT INTO kv_store (key, value, expires_at)
    VALUES (?, ?, NULL)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = NULL
  `).run(key, value)
}

function deleteKv(key: string) {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key)
}

async function validateOpenRouterApiKey(apiKey: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { valid: false as const, availableModels: [] as string[] }
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> }
    const ids = Array.isArray(payload?.data)
      ? payload.data.map((entry) => String(entry?.id ?? '').trim()).filter(Boolean)
      : []

    const availableModels = ALLOWED_MODELS.filter((model) => ids.includes(model))
    return { valid: true as const, availableModels }
  } catch {
    return { valid: false as const, availableModels: [] as string[] }
  }
}

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const apiKey = getOpenRouterApiKey()
  const selectedModel = getKv(OPENROUTER_MODEL_KV)

  if (!apiKey) {
    return NextResponse.json({
      hasApiKey: false,
      isValid: false,
      availableModels: [],
      selectedModel: null,
    })
  }

  const validation = await validateOpenRouterApiKey(apiKey)
  return NextResponse.json({
    hasApiKey: true,
    isValid: validation.valid,
    availableModels: validation.availableModels,
    selectedModel: selectedModel && validation.availableModels.includes(selectedModel)
      ? selectedModel
      : null,
  })
}

export async function PUT(request: Request) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json({ message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 }, { status: 403 })
  }

  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  let payload: unknown = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''

  if (!apiKey) {
    return NextResponse.json(
      { message: 'Informe a API key do OpenRouter.', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const validation = await validateOpenRouterApiKey(apiKey)
  if (!validation.valid) {
    return NextResponse.json(
      { message: 'API key inválida para OpenRouter.', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  setKv(OPENROUTER_KEY_KV, encryptSecret(apiKey))

  const selectedModel = getKv(OPENROUTER_MODEL_KV)
  if (!selectedModel || !validation.availableModels.includes(selectedModel)) {
    if (validation.availableModels.length > 0) {
      setKv(OPENROUTER_MODEL_KV, validation.availableModels[0])
    }
  }

  return NextResponse.json({
    message: 'API key do OpenRouter salva com sucesso.',
    hasApiKey: true,
    isValid: true,
    availableModels: validation.availableModels,
    selectedModel: validation.availableModels[0] ?? null,
  })
}

export async function PATCH(request: Request) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json({ message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 }, { status: 403 })
  }

  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  let payload: unknown = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const model = typeof body.model === 'string' ? body.model.trim() : ''

  if (!ALLOWED_MODELS.includes(model as (typeof ALLOWED_MODELS)[number])) {
    return NextResponse.json(
      { message: 'Modelo não permitido.', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { message: 'Cadastre uma API key antes de escolher o modelo.', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  const validation = await validateOpenRouterApiKey(apiKey)
  if (!validation.valid || !validation.availableModels.includes(model)) {
    return NextResponse.json(
      { message: 'Modelo indisponível para a API key informada.', error: 'Bad Request', statusCode: 400 },
      { status: 400 }
    )
  }

  setKv(OPENROUTER_MODEL_KV, model)

  return NextResponse.json({
    message: 'Modelo do OpenRouter atualizado.',
    selectedModel: model,
  })
}

export async function DELETE(request: Request) {
  if (isStateChangingMethod(request.method) && !isTrustedOrigin(request)) {
    return NextResponse.json({ message: 'Origem não autorizada', error: 'Forbidden', statusCode: 403 }, { status: 403 })
  }

  const user = await requireUser()
  if (!user) return unauthorizedResponse()
  if (user.role !== 4) return forbiddenResponse()

  deleteKv(OPENROUTER_KEY_KV)
  deleteKv(OPENROUTER_MODEL_KV)

  return NextResponse.json({
    message: 'API key do OpenRouter removida com sucesso.',
    hasApiKey: false,
    isValid: false,
    availableModels: [],
    selectedModel: null,
  })
}

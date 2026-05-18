import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { redisGetJson, redisSetJson } from '@/lib/redis-cache'
import { getUserFromToken } from '@/lib/local-backend/auth'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
const OVERLAY_STATE_TTL_SECONDS = 0
const MAX_OVERLAY_STATE_BYTES = 900_000

const ALLOWED_FONT_FAMILIES = new Set([
  'sans',
  'serif',
  'mono',
  'comic',
  'manga',
  'anime',
  'manhwa',
  'condensed',
])
const ALLOWED_SHAPES = new Set(['rect', 'oval'])

interface OverlayItemOverrideState {
  dx: number
  dy: number
  shape?: 'rect' | 'oval'
  fontScale?: number
  sizeScale?: number
  widthScale?: number
  heightScale?: number
  density?: number
}

interface OverlayManualItemState {
  id: number
  box: [number, number, number, number]
  ocr_text: string
  translated_text: string
}

interface OverlayStateRecord {
  font_family: string
  font_scale: number
  box_inset_percent: number
  density: number
  global_shape: 'rect' | 'oval'
  overrides_by_image_id: Record<string, Record<string, OverlayItemOverrideState>>
  manual_items_by_image_id: Record<string, OverlayManualItemState[]>
  hidden_item_ids_by_image_id: Record<string, number[]>
  updated_at: string
}

type RouteParams = { params: Promise<{ id: string }> }

function asObjectRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function normalizeSectionId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'unknown'
  return encodeURIComponent(trimmed)
}

function buildOverlayStateCacheKey(sectionId: string, userId: number) {
  const userIdentity = `id:${Math.floor(userId)}`
  return `manga:overlay-state:v1:section:${normalizeSectionId(sectionId)}:user:${userIdentity}`
}

function sanitizeOverrides(rawValue: unknown) {
  const root = asObjectRecord(rawValue)
  if (!root) return {} as Record<string, Record<string, OverlayItemOverrideState>>

  const result: Record<string, Record<string, OverlayItemOverrideState>> = {}
  const imageEntries = Object.entries(root).slice(0, 1000)

  for (const [imageId, imageOverridesRaw] of imageEntries) {
    const imageOverrides = asObjectRecord(imageOverridesRaw)
    if (!imageOverrides) continue

    const nextImageOverrides: Record<string, OverlayItemOverrideState> = {}
    const itemEntries = Object.entries(imageOverrides).slice(0, 5000)

    for (const [itemId, itemOverrideRaw] of itemEntries) {
      const itemOverride = asObjectRecord(itemOverrideRaw)
      if (!itemOverride) continue

      const dx = clampRange(toFiniteNumber(itemOverride.dx) ?? 0, -5000, 5000)
      const dy = clampRange(toFiniteNumber(itemOverride.dy) ?? 0, -5000, 5000)
      const shapeRaw = typeof itemOverride.shape === 'string' ? itemOverride.shape.trim().toLowerCase() : ''
      const fontScaleRaw = toFiniteNumber(itemOverride.fontScale)
      const sizeScaleRaw = toFiniteNumber(itemOverride.sizeScale)
      const widthScaleRaw = toFiniteNumber(itemOverride.widthScale)
      const heightScaleRaw = toFiniteNumber(itemOverride.heightScale)
      const densityRaw = toFiniteNumber(itemOverride.density)

      const nextItemOverride: OverlayItemOverrideState = { dx, dy }

      if (ALLOWED_SHAPES.has(shapeRaw)) {
        nextItemOverride.shape = shapeRaw as 'rect' | 'oval'
      }
      if (fontScaleRaw !== null) {
        nextItemOverride.fontScale = clampRange(fontScaleRaw, 0.45, 5)
      }
      if (sizeScaleRaw !== null) {
        nextItemOverride.sizeScale = clampRange(sizeScaleRaw, 0.55, 1.85)
      }
      if (widthScaleRaw !== null) {
        nextItemOverride.widthScale = clampRange(widthScaleRaw, 0.25, 4)
      }
      if (heightScaleRaw !== null) {
        nextItemOverride.heightScale = clampRange(heightScaleRaw, 0.25, 4)
      }
      if (densityRaw !== null) {
        nextItemOverride.density = clampRange(densityRaw, 0.45, 2.5)
      }

      nextImageOverrides[itemId] = nextItemOverride
    }

    if (Object.keys(nextImageOverrides).length > 0) {
      result[imageId] = nextImageOverrides
    }
  }

  return result
}

function sanitizeManualItems(rawValue: unknown) {
  const root = asObjectRecord(rawValue)
  if (!root) return {} as Record<string, OverlayManualItemState[]>

  const result: Record<string, OverlayManualItemState[]> = {}
  const imageEntries = Object.entries(root).slice(0, 1000)

  for (const [imageId, imageManualItemsRaw] of imageEntries) {
    if (!Array.isArray(imageManualItemsRaw) || imageManualItemsRaw.length === 0) continue

    const nextImageManualItems: OverlayManualItemState[] = []
    for (const imageManualItemRaw of imageManualItemsRaw.slice(0, 5000)) {
      const imageManualItem = asObjectRecord(imageManualItemRaw)
      if (!imageManualItem) continue

      const itemIdRaw = toFiniteNumber(imageManualItem.id)
      if (itemIdRaw === null) continue

      const box = Array.isArray(imageManualItem.box) ? imageManualItem.box : []
      if (box.length !== 4) continue

      const x1Raw = toFiniteNumber(box[0])
      const y1Raw = toFiniteNumber(box[1])
      const x2Raw = toFiniteNumber(box[2])
      const y2Raw = toFiniteNumber(box[3])
      if (x1Raw === null || y1Raw === null || x2Raw === null || y2Raw === null) continue

      const x1 = clampRange(Math.min(x1Raw, x2Raw), 0, 100_000)
      const y1 = clampRange(Math.min(y1Raw, y2Raw), 0, 100_000)
      const x2 = clampRange(Math.max(x1Raw, x2Raw), 0, 100_000)
      const y2 = clampRange(Math.max(y1Raw, y2Raw), 0, 100_000)
      if (x2 <= x1 || y2 <= y1) continue

      const ocrTextRaw = typeof imageManualItem.ocr_text === 'string'
        ? imageManualItem.ocr_text
        : (typeof imageManualItem.ocrText === 'string' ? imageManualItem.ocrText : '')
      const translatedTextRaw = typeof imageManualItem.translated_text === 'string'
        ? imageManualItem.translated_text
        : (typeof imageManualItem.translatedText === 'string' ? imageManualItem.translatedText : '')
      const ocrText = ocrTextRaw.trim().slice(0, 12_000)
      const translatedText = translatedTextRaw.trim().slice(0, 12_000)
      if (!ocrText && !translatedText) continue

      nextImageManualItems.push({
        id: Math.floor(itemIdRaw),
        box: [x1, y1, x2, y2],
        ocr_text: ocrText || translatedText,
        translated_text: translatedText || ocrText,
      })
    }

    if (nextImageManualItems.length > 0) {
      result[imageId] = nextImageManualItems
    }
  }

  return result
}

function sanitizeHiddenItemIds(rawValue: unknown) {
  const root = asObjectRecord(rawValue)
  if (!root) return {} as Record<string, number[]>

  const result: Record<string, number[]> = {}
  const imageEntries = Object.entries(root).slice(0, 1000)

  for (const [imageId, hiddenIdsRaw] of imageEntries) {
    if (!Array.isArray(hiddenIdsRaw) || hiddenIdsRaw.length === 0) continue

    const nextHiddenIds = hiddenIdsRaw
      .map((value) => toFiniteNumber(value))
      .filter((value): value is number => value !== null)
      .map((value) => Math.floor(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b)

    if (nextHiddenIds.length > 0) {
      result[imageId] = nextHiddenIds
    }
  }

  return result
}

function sanitizeOverlayState(rawValue: unknown): OverlayStateRecord | null {
  const root = asObjectRecord(rawValue)
  if (!root) return null

  const fontFamilyRaw = typeof root.font_family === 'string' ? root.font_family.trim() : 'condensed'
  const fontFamily = ALLOWED_FONT_FAMILIES.has(fontFamilyRaw) ? fontFamilyRaw : 'condensed'
  const globalShapeRaw = typeof root.global_shape === 'string' ? root.global_shape.trim().toLowerCase() : 'rect'
  const globalShape = ALLOWED_SHAPES.has(globalShapeRaw) ? (globalShapeRaw as 'rect' | 'oval') : 'rect'

  const fontScale = clampRange(toFiniteNumber(root.font_scale) ?? 0.3, 0.1, 1.35)
  const boxInsetPercent = clampRange(toFiniteNumber(root.box_inset_percent) ?? 6, -20, 30)
  const density = clampRange(toFiniteNumber(root.density) ?? 1, 0.35, 2.2)
  const overridesByImageId = sanitizeOverrides(root.overrides_by_image_id)
  const manualItemsByImageId = sanitizeManualItems(root.manual_items_by_image_id)
  const hiddenItemIdsByImageId = sanitizeHiddenItemIds(root.hidden_item_ids_by_image_id)

  return {
    font_family: fontFamily,
    font_scale: fontScale,
    box_inset_percent: boxInsetPercent,
    density,
    global_shape: globalShape,
    overrides_by_image_id: overridesByImageId,
    manual_items_by_image_id: manualItemsByImageId,
    hidden_item_ids_by_image_id: hiddenItemIdsByImageId,
    updated_at: new Date().toISOString(),
  }
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)
  const { id } = await params

  if (!token?.value) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  const cacheKey = buildOverlayStateCacheKey(id, user.id)
  const state = await redisGetJson<OverlayStateRecord>(cacheKey)

  return NextResponse.json({ state: state ?? null })
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)
  const { id } = await params

  if (!token?.value) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  const user = getUserFromToken(token.value)
  if (!user) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  try {
    const payload = await request.json()
    const bodyRecord = asObjectRecord(payload)
    const rawState = bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'state')
      ? bodyRecord.state
      : payload

    const state = sanitizeOverlayState(rawState)
    if (!state) {
      return NextResponse.json(
        { message: 'Payload de estado inválido.' },
        { status: 400 }
      )
    }

    const serialized = JSON.stringify(state)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_OVERLAY_STATE_BYTES) {
      return NextResponse.json(
        { message: 'Estado do overlay excede o tamanho máximo permitido.' },
        { status: 413 }
      )
    }

    const cacheKey = buildOverlayStateCacheKey(id, user.id)
    await redisSetJson(cacheKey, state, OVERLAY_STATE_TTL_SECONDS)

    return NextResponse.json({ ok: true, state })
  } catch (error) {
    console.error('Overlay state route error:', error)
    return NextResponse.json(
      { message: 'Erro ao salvar estado do overlay.' },
      { status: 500 }
    )
  }
}

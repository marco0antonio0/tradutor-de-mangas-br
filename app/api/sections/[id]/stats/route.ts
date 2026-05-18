import { NextResponse } from 'next/server'
import { requireUser, unauthorizedResponse } from '@/app/api/_shared/proxy'
import { db } from '@/lib/backend/shared/database.module'

type RouteParams = { params: Promise<{ id: string }> }
const GEMMA_MODEL_ID = 'google/gemma-4-31b-it'
const GEMMA_INPUT_PRICE_PER_1M = 0.12
const GEMMA_OUTPUT_PRICE_PER_1M = 0.37
const CHARS_PER_TOKEN_ESTIMATE = 4
const OPENROUTER_MODEL_KV = 'manga:openrouter:model'

export async function GET(_: Request, { params }: RouteParams) {
  const user = await requireUser()
  if (!user) return unauthorizedResponse()

  const { id } = await params
  const sectionId = Number.parseInt(id, 10)
  if (!Number.isFinite(sectionId) || sectionId <= 0) {
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })
  }

  const section = db.prepare(`
    SELECT id, provider_lang
    FROM sections
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(sectionId, user.id) as { id?: number; provider_lang?: string | null } | undefined

  if (!section?.id) {
    return NextResponse.json({ message: 'Seção não encontrada.' }, { status: 404 })
  }

  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total_pages,
      SUM(CASE WHEN selected_for_processing = 1 THEN 1 ELSE 0 END) AS selected_pages,
      SUM(CASE WHEN translation_status IN ('translated','extracted') THEN 1 ELSE 0 END) AS translated_pages,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_pages
    FROM section_images
    WHERE section_id = ?
  `).get(sectionId) as Record<string, unknown>

  const ocr = db.prepare(`
    SELECT
      COUNT(DISTINCT section_image_id) AS ocr_completed_pages,
      COUNT(*) AS total_detections,
      COALESCE(SUM(LENGTH(COALESCE(ocr_text, ''))), 0) AS total_input_chars,
      COALESCE(SUM(LENGTH(COALESCE(translated_text, ''))), 0) AS total_output_chars
    FROM section_image_ocr_items
    WHERE section_image_id IN (
      SELECT id FROM section_images WHERE section_id = ?
    )
  `).get(sectionId) as Record<string, unknown>

  const toNum = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const totalPages = Math.max(0, Math.floor(toNum(counts.total_pages)))
  const selectedPages = Math.max(0, Math.floor(toNum(counts.selected_pages)))
  const translatedPages = Math.max(0, Math.floor(toNum(counts.translated_pages)))
  const completedPages = Math.max(0, Math.floor(toNum(counts.completed_pages)))
  const ocrCompletedPages = Math.max(0, Math.floor(toNum(ocr.ocr_completed_pages)))
  const totalDetections = Math.max(0, Math.floor(toNum(ocr.total_detections)))
  const totalInputChars = Math.max(0, Math.floor(toNum(ocr.total_input_chars)))
  const totalOutputChars = Math.max(0, Math.floor(toNum(ocr.total_output_chars)))

  const estimatedInputTokens = Math.max(0, totalInputChars / CHARS_PER_TOKEN_ESTIMATE)
  const estimatedOutputTokens = Math.max(0, totalOutputChars / CHARS_PER_TOKEN_ESTIMATE)

  const providerLang = String(section.provider_lang ?? 'google')
  const normalizedProvider = providerLang.trim().toLowerCase()
  const isOpenRouterProvider = normalizedProvider === 'openrouter' || normalizedProvider.startsWith('openrouter:')
  const modelFromProvider = normalizedProvider.startsWith('openrouter:')
    ? providerLang.trim().slice('openrouter:'.length).trim()
    : ''
  const selectedOpenRouterModel = db.prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1')
    .get(OPENROUTER_MODEL_KV) as { value?: string } | undefined
  const costModel = (modelFromProvider || String(selectedOpenRouterModel?.value ?? '').trim() || GEMMA_MODEL_ID)
  const estimatedInputCostUsd = isOpenRouterProvider
    ? (estimatedInputTokens / 1_000_000) * GEMMA_INPUT_PRICE_PER_1M
    : null
  const estimatedOutputCostUsd = isOpenRouterProvider
    ? (estimatedOutputTokens / 1_000_000) * GEMMA_OUTPUT_PRICE_PER_1M
    : null
  const estimatedTotalCostUsd = (
    estimatedInputCostUsd !== null
    && estimatedOutputCostUsd !== null
  )
    ? estimatedInputCostUsd + estimatedOutputCostUsd
    : null

  return NextResponse.json({
    section_id: sectionId,
    total_pages: totalPages,
    selected_pages: selectedPages,
    translated_pages: translatedPages,
    ocr_completed_pages: ocrCompletedPages,
    completed_pages: completedPages,
    pages_with_elapsed_ms: 0,
    total_elapsed_minutes: 0,
    avg_elapsed_seconds_per_page: 0,
    total_detections: totalDetections,
    provider_lang: providerLang,
    cost_model: isOpenRouterProvider ? costModel : null,
    estimated_input_tokens: Math.round(estimatedInputTokens),
    estimated_output_tokens: Math.round(estimatedOutputTokens),
    estimated_input_cost_usd: estimatedInputCostUsd,
    estimated_output_cost_usd: estimatedOutputCostUsd,
    estimated_total_cost_usd: estimatedTotalCostUsd,
    generated_at: new Date().toISOString(),
  })
}

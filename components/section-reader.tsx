'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  buildPublicReaderPath,
  buildPublicReaderUrl,
  buildImageViewUrl,
  formatSectionDate,
  formatStatus,
  getSectionQueueState,
  getSectionPriorityInfo,
  isImageTranslated,
  normalizeStatus,
  type SectionDetail,
  type SectionImage,
  type SectionImageOcrItem,
  type SectionListItem,
  type SectionPublicAccess,
  toErrorMessage,
} from '@/lib/sections'
import { readAutoProcessingEnabledPreference } from '@/lib/user-preferences'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BarChart3,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Rows3,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { SpotlightTour, checkTourDone, type TourStep } from '@/components/spotlight-tour'

interface SectionReaderProps {
  sectionId: number
}

interface DeleteSectionResponse {
  message?: string
  section?: { id?: number }
}

interface RenameSectionResponse {
  id?: number
  name?: string
  status?: string
  updated_at?: string
  message?: string
  error?: string
}

interface SectionPublicAccessResponse {
  section_id?: number
  public_access?: SectionPublicAccess | null
  message?: string
  error?: string
}

interface AuthMeLimitsResponse {
  role?: unknown
  limite?: number
  gerado?: number
  limit_page_upload?: number
  message?: string
  error?: string
}

interface SectionRealtimeAuthResponse {
  socket_url?: unknown
  namespace?: unknown
  token?: unknown
}

interface SectionCategoryResponse {
  section_id?: unknown
  category?: unknown
  category_id?: unknown
  category_preferences?: unknown
  categories?: unknown
  deleted_sections_count?: unknown
  message?: string
  error?: string
}

interface SectionStatsResponse {
  section_id?: unknown
  total_pages?: unknown
  selected_pages?: unknown
  translated_pages?: unknown
  ocr_completed_pages?: unknown
  completed_pages?: unknown
  pages_with_elapsed_ms?: unknown
  total_elapsed_ms?: unknown
  total_elapsed_minutes?: unknown
  avg_elapsed_ms_per_page?: unknown
  avg_elapsed_seconds_per_page?: unknown
  total_detections?: unknown
  provider_lang?: unknown
  cost_model?: unknown
  estimated_input_tokens?: unknown
  estimated_output_tokens?: unknown
  estimated_input_cost_usd?: unknown
  estimated_output_cost_usd?: unknown
  estimated_total_cost_usd?: unknown
  generated_at?: unknown
  message?: unknown
  error?: unknown
}

interface LimitModalState {
  title: string
  description: string
  details?: string
}

interface QueueMetricCardProps {
  label: string
  value: string
}

interface QueueActionOptions {
  silent?: boolean
  automatic?: boolean
}

interface OcrOverlayItem {
  id: number
  box: [number, number, number, number]
  ocrText: string
  translatedText: string
}

type OcrOverlayShape = 'rect' | 'oval'
type OcrOverlayTextMode = 'translated' | 'original'
type OcrOverlayFontFamily =
  | 'sans'
  | 'serif'
  | 'mono'
  | 'comic'
  | 'manga'
  | 'anime'
  | 'manhwa'
  | 'condensed'

interface OcrOverlayItemOverride {
  dx: number
  dy: number
  shape?: OcrOverlayShape
  fontScale?: number
  sizeScale?: number
  widthScale?: number
  heightScale?: number
  density?: number
}

interface OcrOverlayItemColors {
  red: number
  green: number
  blue: number
  baseAlpha: number
  borderColor: string
  textColor: string
}

interface OcrBatchTranslateResponse {
  translations?: unknown
  provider_lang?: unknown
  source_lang?: unknown
  target_lang?: unknown
  message?: string
  error?: string
}

interface OcrImageQueueResponse {
  job_key?: unknown
  job_id?: unknown
  queue_key?: unknown
  status?: unknown
  queue_position?: unknown
  redis?: unknown
  message?: unknown
  error?: unknown
}

interface OcrImageJobPollResponse {
  job_key?: unknown
  queue_key?: unknown
  status?: unknown
  queue_position?: unknown
  queue_length?: unknown
  lock_value?: unknown
  job?: unknown
  message?: unknown
  error?: unknown
}

interface OcrOverlayStateResponse {
  state?: unknown
  message?: string
  error?: string
}

interface OcrOverlayPersistedManualItemPayload {
  id: number
  box: [number, number, number, number]
  ocr_text: string
  translated_text: string
}

interface OcrOverlayPersistedStatePayload {
  font_family: OcrOverlayFontFamily
  font_scale: number
  box_inset_percent: number
  density: number
  overlay_opacity: number
  global_shape: OcrOverlayShape
  overrides_by_image_id: Record<string, Record<string, OcrOverlayItemOverride>>
  manual_items_by_image_id: Record<string, OcrOverlayPersistedManualItemPayload[]>
  hidden_item_ids_by_image_id: Record<string, number[]>
}

interface OcrOverlayStateSnapshot {
  fontFamily: OcrOverlayFontFamily
  fontScale: number
  boxInsetPercent: number
  density: number
  overlayOpacity: number
  globalShape: OcrOverlayShape
  overridesByImageId: Record<number, Record<number, OcrOverlayItemOverride>>
  manualItemsByImageId: Record<number, OcrOverlayItem[]>
  hiddenItemIdsByImageId: Record<number, number[]>
}

interface SectionCategoryOverlayPreferences {
  font_family: OcrOverlayFontFamily
  font_scale: number
  box_inset_percent: number
  density: number
  overlay_opacity: number
  global_shape: OcrOverlayShape
  default_reading_mode: 'paginated' | 'scroll'
}

interface ImageNaturalSize {
  width: number
  height: number
}

interface OverlayLanguageOption {
  code: string
  name: string
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toStringValue(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function firstDefined<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined) return value
  }
  return null
}

function asObjectRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function resolveAuthMePayload(payload: unknown) {
  const root = asObjectRecord(payload) ?? {}
  const nestedUser = asObjectRecord(root.user) ?? {}

  return {
    role: root.role ?? nestedUser.role,
  }
}

function QueueMetricCard({ label, value }: QueueMetricCardProps) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

const PROCESSING_STATUSES = new Set([
  'processing',
  'processando',
  'in_progress',
  'running',
  'traduzindo',
  'translating',
])
const FAILED_TRANSLATION_STATUSES = new Set([
  'failed',
  'error',
  'erro',
  'timeout',
  'timed_out',
])
const READING_PRELOAD_RADIUS = 2
const SWIPE_TRIGGER_PX = 56
const SWIPE_DIRECTION_RATIO = 1.2
const READ_PAGES_LS_PREFIX = 'manga-read-'
export const SECTION_READ_LS_PREFIX = 'manga-section-read-'
const SECTION_READ_THRESHOLD = 0.70
const SECTION_CATEGORY_MAX_LENGTH = 64
const OCR_COMPLETED_STATUSES = new Set(['ocr_concluido', 'ocr_completed'])
const OCR_OVERLAY_PROVIDER_DEFAULT = 'google'
const OCR_OVERLAY_FONT_SCALE_MIN = 0.1
const OCR_OVERLAY_FONT_SCALE_MAX = 1.5
const OCR_OVERLAY_FONT_SCALE_STEP = 0.05
const OCR_OVERLAY_DEFAULT_FONT_SCALE = 0.3
const OCR_OVERLAY_DEFAULT_FONT_FAMILY: OcrOverlayFontFamily = 'condensed'
const OCR_OVERLAY_DEFAULT_SHAPE: OcrOverlayShape = 'rect'
const OCR_OVERLAY_BOX_INSET_MIN = -20
const OCR_OVERLAY_BOX_INSET_MAX = 30
const OCR_OVERLAY_BOX_INSET_STEP = 2
const OCR_OVERLAY_DEFAULT_BOX_INSET = 6
const OCR_OVERLAY_ITEM_FONT_SCALE_MIN = 0.45
const OCR_OVERLAY_ITEM_FONT_SCALE_MAX = 5
const OCR_OVERLAY_ITEM_FONT_SCALE_STEP = 0.1
const OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT = 1
const OCR_OVERLAY_DENSITY_MIN = 0.35
const OCR_OVERLAY_DENSITY_MAX = 2.2
const OCR_OVERLAY_DENSITY_STEP = 0.1
const OCR_OVERLAY_DENSITY_DEFAULT = 2.0
const OCR_OVERLAY_OPACITY_MIN = 0.08
const OCR_OVERLAY_OPACITY_MAX = 1
const OCR_OVERLAY_OPACITY_DEFAULT = 1
const OCR_OVERLAY_ITEM_DENSITY_MIN = 0.45
const OCR_OVERLAY_ITEM_DENSITY_MAX = 2.5
const OCR_OVERLAY_ITEM_DENSITY_STEP = 0.1
const OCR_OVERLAY_ITEM_DENSITY_DEFAULT = 1
const OCR_OVERLAY_ITEM_SIZE_MIN = 0.55
const OCR_OVERLAY_ITEM_SIZE_MAX = 1.85
const OCR_OVERLAY_ITEM_SIZE_STEP = 0.05
const OCR_OVERLAY_ITEM_SIZE_DEFAULT = 1
const OCR_OVERLAY_ITEM_AXIS_SCALE_MIN = 0.25
const OCR_OVERLAY_ITEM_AXIS_SCALE_MAX = 4
const OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT = 1
const OCR_OVERLAY_QUICK_EDITOR_DOUBLE_TAP_MS = 700
const OCR_OVERLAY_QUICK_EDITOR_TAP_MOVE_PX = 48
const OCR_QUEUE_POLL_INTERVAL_MS = 900
const OCR_QUEUE_POLL_TIMEOUT_MS = 45_000
const OCR_OVERLAY_SELECTION_SOURCE_DEFAULT = 'auto'
const OCR_OVERLAY_SELECTION_TARGET_DEFAULT = 'pt-BR'
const OCR_OVERLAY_SELECTION_LANGUAGES: OverlayLanguageOption[] = [
  { code: 'auto', name: 'Detectar automaticamente' },
  { code: 'en', name: 'Inglês' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Francês' },
  { code: 'de', name: 'Alemão' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japonês' },
  { code: 'ko', name: 'Coreano' },
  { code: 'zh-cn', name: 'Chinês Simplificado' },
  { code: 'zh-tw', name: 'Chinês Tradicional' },
  { code: 'ru', name: 'Russo' },
  { code: 'ar', name: 'Árabe' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turco' },
  { code: 'nl', name: 'Holandês' },
  { code: 'pl', name: 'Polonês' },
  { code: 'uk', name: 'Ucraniano' },
  { code: 'vi', name: 'Vietnamita' },
  { code: 'id', name: 'Indonésio' },
  { code: 'th', name: 'Tailandês' },
]
const OCR_OVERLAY_SELECTION_TARGET_LANGUAGES = OCR_OVERLAY_SELECTION_LANGUAGES.filter(
  (language) => language.code !== 'auto'
)

const OCR_OVERLAY_FONT_FAMILIES: Record<OcrOverlayFontFamily, { label: string; css: string }> = {
  sans: {
    label: 'Wild Words',
    css: 'var(--font-bangers), "CC Wild Words", "Anime Ace 2.0 BB", "Komika Axis", cursive',
  },
  serif: {
    label: 'Retro Hero',
    css: 'var(--font-carter-one), var(--font-righteous), "Trebuchet MS", sans-serif',
  },
  mono: {
    label: 'Tech Scan',
    css: 'var(--font-rubik-mono-one), var(--font-audiowide), "Arial Black", sans-serif',
  },
  comic: {
    label: 'Ink Brush',
    css: 'var(--font-permanent-marker), var(--font-kalam), "Comic Sans MS", cursive',
  },
  manga: {
    label: 'Shonen Blast',
    css: 'var(--font-luckiest-guy), var(--font-bangers), var(--font-changa-one), "Arial Black", sans-serif',
  },
  anime: {
    label: 'Anime Title',
    css: 'var(--font-bebas-neue), var(--font-anton), var(--font-teko), Impact, sans-serif',
  },
  manhwa: {
    label: 'Manhwa Clean Pro',
    css: 'var(--font-noto-sans-kr), "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif',
  },
  condensed: {
    label: 'Action Condensed',
    css: 'var(--font-teko), var(--font-bebas-neue), "Arial Narrow", Impact, sans-serif',
  },
}

function resolveOcrOverlayProvider(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || 'google'
}

function formatProviderLabel(value: string | null | undefined) {
  const provider = resolveOcrOverlayProvider(value)
  if (provider.toLowerCase() === 'google') return 'Google Translate'
  if (provider.toLowerCase().startsWith('openrouter:')) {
    const model = provider.slice('openrouter:'.length).trim()
    return model ? `OpenRouter (${model})` : 'OpenRouter'
  }
  return provider
}

function normalizeOverlaySelectionLanguage(
  value: string | null | undefined,
  fallback: string,
  options: OverlayLanguageOption[]
) {
  const normalizedFallback = options.find((option) => option.code === fallback)?.code ?? options[0]?.code ?? fallback
  if (typeof value !== 'string') return normalizedFallback

  const trimmed = value.trim()
  if (!trimmed) return normalizedFallback

  const match = options.find((option) => option.code.toLowerCase() === trimmed.toLowerCase())
  return match?.code ?? normalizedFallback
}

function isOverlayFontFamily(value: string): value is OcrOverlayFontFamily {
  return Object.prototype.hasOwnProperty.call(OCR_OVERLAY_FONT_FAMILIES, value)
}

function isOverlayShape(value: string): value is OcrOverlayShape {
  return value === 'rect' || value === 'oval'
}

function sanitizeOverlayItemOverride(value: OcrOverlayItemOverride): OcrOverlayItemOverride {
  const next: OcrOverlayItemOverride = {
    dx: clampRange(toFiniteNumber(value.dx) ?? 0, -5000, 5000),
    dy: clampRange(toFiniteNumber(value.dy) ?? 0, -5000, 5000),
  }

  if (value.shape === 'rect' || value.shape === 'oval') {
    next.shape = value.shape
  }

  const fontScale = toFiniteNumber(value.fontScale)
  if (fontScale !== null) {
    next.fontScale = clampRange(fontScale, OCR_OVERLAY_ITEM_FONT_SCALE_MIN, OCR_OVERLAY_ITEM_FONT_SCALE_MAX)
  }

  const sizeScale = toFiniteNumber(value.sizeScale)
  if (sizeScale !== null) {
    next.sizeScale = clampRange(sizeScale, OCR_OVERLAY_ITEM_SIZE_MIN, OCR_OVERLAY_ITEM_SIZE_MAX)
  }

  const widthScale = toFiniteNumber(value.widthScale)
  if (widthScale !== null) {
    next.widthScale = clampRange(widthScale, OCR_OVERLAY_ITEM_AXIS_SCALE_MIN, OCR_OVERLAY_ITEM_AXIS_SCALE_MAX)
  }

  const heightScale = toFiniteNumber(value.heightScale)
  if (heightScale !== null) {
    next.heightScale = clampRange(heightScale, OCR_OVERLAY_ITEM_AXIS_SCALE_MIN, OCR_OVERLAY_ITEM_AXIS_SCALE_MAX)
  }

  const density = toFiniteNumber(value.density)
  if (density !== null) {
    next.density = clampRange(density, OCR_OVERLAY_ITEM_DENSITY_MIN, OCR_OVERLAY_ITEM_DENSITY_MAX)
  }

  return next
}

function normalizeOverlayOverrides(
  rawValue: unknown
): Record<number, Record<number, OcrOverlayItemOverride>> {
  const root = asObjectRecord(rawValue)
  if (!root) return {}

  const normalized: Record<number, Record<number, OcrOverlayItemOverride>> = {}
  const imageIds = Object.keys(root)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const imageOverridesRaw = asObjectRecord(root[String(imageId)])
    if (!imageOverridesRaw) continue

    const itemIds = Object.keys(imageOverridesRaw)
      .map((key) => Number.parseInt(key, 10))
      .filter((itemId) => Number.isFinite(itemId))
      .sort((a, b) => a - b)

    const nextImageOverrides: Record<number, OcrOverlayItemOverride> = {}
    for (const itemId of itemIds) {
      const itemRaw = asObjectRecord(imageOverridesRaw[String(itemId)])
      if (!itemRaw) continue

      const rawShape = typeof itemRaw.shape === 'string' ? itemRaw.shape.trim().toLowerCase() : ''
      const nextOverride: OcrOverlayItemOverride = sanitizeOverlayItemOverride({
        dx: toFiniteNumber(itemRaw.dx) ?? 0,
        dy: toFiniteNumber(itemRaw.dy) ?? 0,
        shape: rawShape === 'rect' || rawShape === 'oval' ? rawShape : undefined,
        fontScale: toFiniteNumber(itemRaw.fontScale) ?? undefined,
        sizeScale: toFiniteNumber(itemRaw.sizeScale) ?? undefined,
        widthScale: toFiniteNumber(itemRaw.widthScale) ?? undefined,
        heightScale: toFiniteNumber(itemRaw.heightScale) ?? undefined,
        density: toFiniteNumber(itemRaw.density) ?? undefined,
      })
      nextImageOverrides[itemId] = nextOverride
    }

    if (Object.keys(nextImageOverrides).length > 0) {
      normalized[imageId] = nextImageOverrides
    }
  }

  return normalized
}

function serializeOverlayOverrides(
  overridesByImageId: Record<number, Record<number, OcrOverlayItemOverride>>
): Record<string, Record<string, OcrOverlayItemOverride>> {
  const serialized: Record<string, Record<string, OcrOverlayItemOverride>> = {}
  const imageIds = Object.keys(overridesByImageId)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const imageOverrides = overridesByImageId[imageId]
    if (!imageOverrides) continue

    const itemIds = Object.keys(imageOverrides)
      .map((key) => Number.parseInt(key, 10))
      .filter((itemId) => Number.isFinite(itemId))
      .sort((a, b) => a - b)

    const nextImageOverrides: Record<string, OcrOverlayItemOverride> = {}
    for (const itemId of itemIds) {
      const override = imageOverrides[itemId]
      if (!override) continue
      nextImageOverrides[String(itemId)] = sanitizeOverlayItemOverride(override)
    }

    if (Object.keys(nextImageOverrides).length > 0) {
      serialized[String(imageId)] = nextImageOverrides
    }
  }

  return serialized
}

function normalizeOverlayManualItems(
  rawValue: unknown
): Record<number, OcrOverlayItem[]> {
  const root = asObjectRecord(rawValue)
  if (!root) return {}

  const normalized: Record<number, OcrOverlayItem[]> = {}
  const imageIds = Object.keys(root)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const imageItemsRaw = root[String(imageId)]
    if (!Array.isArray(imageItemsRaw) || imageItemsRaw.length === 0) continue

    const nextItems: OcrOverlayItem[] = []
    for (const rawItem of imageItemsRaw) {
      const item = asObjectRecord(rawItem)
      if (!item) continue

      const idRaw = toFiniteNumber(item.id)
      if (idRaw === null) continue

      const boxRaw = Array.isArray(item.box) ? item.box : []
      if (boxRaw.length !== 4) continue

      const x1Raw = toFiniteNumber(boxRaw[0])
      const y1Raw = toFiniteNumber(boxRaw[1])
      const x2Raw = toFiniteNumber(boxRaw[2])
      const y2Raw = toFiniteNumber(boxRaw[3])
      if (x1Raw === null || y1Raw === null || x2Raw === null || y2Raw === null) continue

      const x1 = Math.min(x1Raw, x2Raw)
      const y1 = Math.min(y1Raw, y2Raw)
      const x2 = Math.max(x1Raw, x2Raw)
      const y2 = Math.max(y1Raw, y2Raw)
      if (x2 <= x1 || y2 <= y1) continue

      const ocrText = typeof item.ocr_text === 'string'
        ? item.ocr_text.trim()
        : (typeof item.ocrText === 'string' ? item.ocrText.trim() : '')
      const translatedText = typeof item.translated_text === 'string'
        ? item.translated_text.trim()
        : (typeof item.translatedText === 'string' ? item.translatedText.trim() : '')

      if (!ocrText && !translatedText) continue

      nextItems.push({
        id: Math.floor(idRaw),
        box: [x1, y1, x2, y2],
        ocrText: ocrText || translatedText,
        translatedText: translatedText || ocrText,
      })
    }

    if (nextItems.length > 0) {
      normalized[imageId] = nextItems
    }
  }

  return normalized
}

function serializeOverlayManualItems(
  manualItemsByImageId: Record<number, OcrOverlayItem[]>
): Record<string, OcrOverlayPersistedManualItemPayload[]> {
  const serialized: Record<string, OcrOverlayPersistedManualItemPayload[]> = {}
  const imageIds = Object.keys(manualItemsByImageId)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const items = manualItemsByImageId[imageId]
    if (!Array.isArray(items) || items.length === 0) continue

    const nextItems: OcrOverlayPersistedManualItemPayload[] = []
    for (const item of items) {
      if (!item) continue
      const [x1, y1, x2, y2] = item.box
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue
      if (x2 <= x1 || y2 <= y1) continue

      const ocrText = item.ocrText.trim()
      const translatedText = item.translatedText.trim()
      if (!ocrText && !translatedText) continue

      nextItems.push({
        id: Math.floor(item.id),
        box: [x1, y1, x2, y2],
        ocr_text: ocrText || translatedText,
        translated_text: translatedText || ocrText,
      })
    }

    if (nextItems.length > 0) {
      serialized[String(imageId)] = nextItems
    }
  }

  return serialized
}

function normalizeOverlayHiddenItemIds(
  rawValue: unknown
): Record<number, number[]> {
  const root = asObjectRecord(rawValue)
  if (!root) return {}

  const normalized: Record<number, number[]> = {}
  const imageIds = Object.keys(root)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const hiddenIdsRaw = root[String(imageId)]
    if (!Array.isArray(hiddenIdsRaw) || hiddenIdsRaw.length === 0) continue

    const normalizedHiddenIds = hiddenIdsRaw
      .map((value: unknown) => toFiniteNumber(value))
      .filter((value): value is number => value !== null)
      .map((value: number) => Math.floor(value))
      .filter((value: number, index: number, array: number[]) => array.indexOf(value) === index)
      .sort((a: number, b: number) => a - b)

    if (normalizedHiddenIds.length > 0) {
      normalized[imageId] = normalizedHiddenIds
    }
  }

  return normalized
}

function serializeOverlayHiddenItemIds(
  hiddenItemIdsByImageId: Record<number, number[]>
): Record<string, number[]> {
  const serialized: Record<string, number[]> = {}
  const imageIds = Object.keys(hiddenItemIdsByImageId)
    .map((key) => Number.parseInt(key, 10))
    .filter((imageId) => Number.isFinite(imageId))
    .sort((a, b) => a - b)

  for (const imageId of imageIds) {
    const hiddenIds = Array.isArray(hiddenItemIdsByImageId[imageId])
      ? hiddenItemIdsByImageId[imageId]
      : []
    if (hiddenIds.length === 0) continue

    const normalizedHiddenIds = hiddenIds
      .map((value) => toFiniteNumber(value))
      .filter((value): value is number => value !== null)
      .map((value) => Math.floor(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b)

    if (normalizedHiddenIds.length > 0) {
      serialized[String(imageId)] = normalizedHiddenIds
    }
  }

  return serialized
}

function upsertOverlayItem(items: OcrOverlayItem[], nextItem: OcrOverlayItem) {
  const index = items.findIndex((item) => item.id === nextItem.id)
  if (index === -1) {
    return [...items, nextItem]
  }

  const next = items.slice()
  next[index] = nextItem
  return next
}

function removeOverlayItem(items: OcrOverlayItem[], itemId: number) {
  const next = items.filter((item) => item.id !== itemId)
  return next
}

function mergeOverlayItems(seedItems: OcrOverlayItem[], manualItems: OcrOverlayItem[]) {
  if (manualItems.length === 0) return seedItems
  const merged = seedItems.slice()
  for (const manualItem of manualItems) {
    const index = merged.findIndex((item) => item.id === manualItem.id)
    if (index >= 0) {
      merged[index] = manualItem
    } else {
      merged.push(manualItem)
    }
  }
  return merged
}

function filterOverlayItemsByHiddenIds(items: OcrOverlayItem[], hiddenIds: number[]) {
  if (hiddenIds.length === 0) return items
  const hiddenSet = new Set(hiddenIds)
  return items.filter((item) => !hiddenSet.has(item.id))
}

function resolveQuickEditorPlacement(
  anchor: { leftPercent: number; topPercent: number } | null
): { side: 'top' | 'bottom'; align: 'start' | 'center' | 'end' } {
  if (!anchor) {
    return { side: 'top', align: 'center' }
  }

  const top = clampPercent(anchor.topPercent)
  const left = clampPercent(anchor.leftPercent)
  const side: 'top' | 'bottom' = top < 22 ? 'bottom' : 'top'

  let align: 'start' | 'center' | 'end' = 'center'
  if (left < 24) align = 'start'
  if (left > 76) align = 'end'

  return { side, align }
}

function isOverlaySelectionPopoverInternalTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false

  return Boolean(
    element.closest('[data-ocr-overlay-interactive="true"]')
    || element.closest('[data-ocr-overlay-selection-lang-select="true"]')
    || element.closest('[data-slot="select-content"]')
  )
}

function buildOverlayStatePayload(snapshot: OcrOverlayStateSnapshot): OcrOverlayPersistedStatePayload {
  return {
    font_family: snapshot.fontFamily,
    font_scale: clampRange(snapshot.fontScale, OCR_OVERLAY_FONT_SCALE_MIN, OCR_OVERLAY_FONT_SCALE_MAX),
    box_inset_percent: clampRange(snapshot.boxInsetPercent, OCR_OVERLAY_BOX_INSET_MIN, OCR_OVERLAY_BOX_INSET_MAX),
    density: clampRange(snapshot.density, OCR_OVERLAY_DENSITY_MIN, OCR_OVERLAY_DENSITY_MAX),
    overlay_opacity: clampRange(snapshot.overlayOpacity, OCR_OVERLAY_OPACITY_MIN, OCR_OVERLAY_OPACITY_MAX),
    global_shape: snapshot.globalShape,
    overrides_by_image_id: serializeOverlayOverrides(snapshot.overridesByImageId),
    manual_items_by_image_id: serializeOverlayManualItems(snapshot.manualItemsByImageId),
    hidden_item_ids_by_image_id: serializeOverlayHiddenItemIds(snapshot.hiddenItemIdsByImageId),
  }
}

function parseOverlayStateSnapshot(rawValue: unknown): OcrOverlayStateSnapshot | null {
  const root = asObjectRecord(rawValue)
  if (!root) return null

  const rawFontFamily = typeof root.font_family === 'string'
    ? root.font_family.trim().toLowerCase()
    : ''
  const fontFamily: OcrOverlayFontFamily = isOverlayFontFamily(rawFontFamily)
    ? rawFontFamily
    : OCR_OVERLAY_DEFAULT_FONT_FAMILY

  const fontScale = clampRange(
    toFiniteNumber(root.font_scale) ?? OCR_OVERLAY_DEFAULT_FONT_SCALE,
    OCR_OVERLAY_FONT_SCALE_MIN,
    OCR_OVERLAY_FONT_SCALE_MAX
  )
  const boxInsetPercent = clampRange(
    toFiniteNumber(root.box_inset_percent) ?? OCR_OVERLAY_DEFAULT_BOX_INSET,
    OCR_OVERLAY_BOX_INSET_MIN,
    OCR_OVERLAY_BOX_INSET_MAX
  )
  const density = clampRange(
    toFiniteNumber(root.density) ?? OCR_OVERLAY_DENSITY_DEFAULT,
    OCR_OVERLAY_DENSITY_MIN,
    OCR_OVERLAY_DENSITY_MAX
  )
  const overlayOpacity = clampRange(
    toFiniteNumber(root.overlay_opacity) ?? OCR_OVERLAY_OPACITY_DEFAULT,
    OCR_OVERLAY_OPACITY_MIN,
    OCR_OVERLAY_OPACITY_MAX
  )
  const globalShapeRaw = typeof root.global_shape === 'string' ? root.global_shape.trim().toLowerCase() : ''
  const globalShape: OcrOverlayShape = isOverlayShape(globalShapeRaw)
    ? globalShapeRaw
    : OCR_OVERLAY_DEFAULT_SHAPE

  return {
    fontFamily,
    fontScale,
    boxInsetPercent,
    density,
    overlayOpacity,
    globalShape,
    overridesByImageId: normalizeOverlayOverrides(root.overrides_by_image_id),
    manualItemsByImageId: normalizeOverlayManualItems(root.manual_items_by_image_id),
    hiddenItemIdsByImageId: normalizeOverlayHiddenItemIds(root.hidden_item_ids_by_image_id),
  }
}

function isOcrCompletedStatus(value: string | null | undefined) {
  return OCR_COMPLETED_STATUSES.has(normalizeStatus(value))
}

function toOverlaySeedItems(image: SectionImage) {
  const ocrItems = image.ocr?.items
  if (!Array.isArray(ocrItems) || ocrItems.length === 0) return [] as OcrOverlayItem[]

  const result: OcrOverlayItem[] = []

  for (const rawItem of ocrItems) {
    const item = rawItem as SectionImageOcrItem
    const box = Array.isArray(item.box) ? item.box : []
    if (box.length !== 4) continue

    const rawX1 = Number(box[0])
    const rawY1 = Number(box[1])
    const rawX2 = Number(box[2])
    const rawY2 = Number(box[3])
    if (
      !Number.isFinite(rawX1)
      || !Number.isFinite(rawY1)
      || !Number.isFinite(rawX2)
      || !Number.isFinite(rawY2)
    ) {
      continue
    }

    const x1 = Math.min(rawX1, rawX2)
    const y1 = Math.min(rawY1, rawY2)
    const x2 = Math.max(rawX1, rawX2)
    const y2 = Math.max(rawY1, rawY2)
    if (x2 <= x1 || y2 <= y1) continue

    const ocrText = typeof item.ocr_text === 'string' ? item.ocr_text.trim() : ''
    if (!ocrText) continue

    const translatedText = typeof item.translated_text === 'string' ? item.translated_text.trim() : ''

    result.push({
      id: item.id,
      box: [x1, y1, x2, y2],
      ocrText,
      translatedText,
    })
  }

  return result
}

function hasOcrOverlayData(image: SectionImage | null) {
  if (!image) return false
  return toOverlaySeedItems(image).length > 0
}

function isImageOcrReady(image: SectionImage | null) {
  if (!image) return false
  return isOcrCompletedStatus(image.status) || isOcrCompletedStatus(image.translation_status)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function toRelativePercent(value: number, reference: number) {
  if (!Number.isFinite(value) || !Number.isFinite(reference) || reference === 0) return 100
  return Math.round((value / reference) * 100)
}

function normalizeSectionCategoryValue(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, SECTION_CATEGORY_MAX_LENGTH)
}

function normalizeSectionCategoryOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]

  const seen = new Set<string>()
  const options: string[] = []

  for (const item of value) {
    const normalized = normalizeSectionCategoryValue(item)
    if (!normalized) continue

    const key = normalized.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) continue
    seen.add(key)
    options.push(normalized)

    if (options.length >= 200) break
  }

  options.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  return options
}

function normalizeSectionCategoryOverlayPreferences(value: unknown): SectionCategoryOverlayPreferences | null {
  const root = asObjectRecord(value)
  if (!root) return null

  const rawFontFamily = typeof root.font_family === 'string'
    ? root.font_family.trim().toLowerCase()
    : ''
  const fontFamily: OcrOverlayFontFamily = isOverlayFontFamily(rawFontFamily)
    ? rawFontFamily
    : OCR_OVERLAY_DEFAULT_FONT_FAMILY

  const rawShape = typeof root.global_shape === 'string'
    ? root.global_shape.trim().toLowerCase()
    : ''
  const globalShape: OcrOverlayShape = isOverlayShape(rawShape)
    ? rawShape
    : OCR_OVERLAY_DEFAULT_SHAPE
  const rawDefaultReadingMode = typeof root.default_reading_mode === 'string'
    ? root.default_reading_mode.trim().toLowerCase()
    : ''
  const defaultReadingMode: 'paginated' | 'scroll' =
    rawDefaultReadingMode === 'scroll' ? 'scroll' : 'paginated'

  return {
    font_family: fontFamily,
    font_scale: clampRange(
      toFiniteNumber(root.font_scale) ?? OCR_OVERLAY_DEFAULT_FONT_SCALE,
      OCR_OVERLAY_FONT_SCALE_MIN,
      OCR_OVERLAY_FONT_SCALE_MAX
    ),
    box_inset_percent: clampRange(
      toFiniteNumber(root.box_inset_percent) ?? OCR_OVERLAY_DEFAULT_BOX_INSET,
      OCR_OVERLAY_BOX_INSET_MIN,
      OCR_OVERLAY_BOX_INSET_MAX
    ),
    density: clampRange(
      toFiniteNumber(root.density) ?? OCR_OVERLAY_DENSITY_DEFAULT,
      OCR_OVERLAY_DENSITY_MIN,
      OCR_OVERLAY_DENSITY_MAX
    ),
    overlay_opacity: clampRange(
      toFiniteNumber(root.overlay_opacity) ?? OCR_OVERLAY_OPACITY_DEFAULT,
      OCR_OVERLAY_OPACITY_MIN,
      OCR_OVERLAY_OPACITY_MAX
    ),
    global_shape: globalShape,
    default_reading_mode: defaultReadingMode,
  }
}

function toSectionCategoryKey(value: string) {
  return normalizeSectionCategoryValue(value).toLocaleLowerCase('pt-BR')
}

function getRelativeLuminance(red: number, green: number, blue: number) {
  const srgb = [red, green, blue].map((channel) => {
    const value = channel / 255
    if (value <= 0.03928) return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

function getContrastRatio(l1: number, l2: number) {
  const light = Math.max(l1, l2)
  const dark = Math.min(l1, l2)
  return (light + 0.05) / (dark + 0.05)
}

function toOverlayColorProfile(red: number, green: number, blue: number): OcrOverlayItemColors {
  const clampedRed = Math.round(clampRange(red, 0, 255))
  const clampedGreen = Math.round(clampRange(green, 0, 255))
  const clampedBlue = Math.round(clampRange(blue, 0, 255))
  const bgLuminance = getRelativeLuminance(clampedRed, clampedGreen, clampedBlue)
  const contrastWithWhite = getContrastRatio(bgLuminance, 1)
  const contrastWithBlack = getContrastRatio(bgLuminance, 0)
  const useDarkText = contrastWithBlack >= contrastWithWhite
  const channelSpread = Math.max(clampedRed, clampedGreen, clampedBlue) - Math.min(clampedRed, clampedGreen, clampedBlue)
  const isNearNeutral = channelSpread <= 24
  const isVeryLightBackground = bgLuminance >= 0.92
  const isLightBackground = bgLuminance >= 0.82
  const whiteBlendStrength = isVeryLightBackground && isNearNeutral ? 0.08 : 0
  const profiledRed = Math.round(clampRange(clampedRed + ((255 - clampedRed) * whiteBlendStrength), 0, 255))
  const profiledGreen = Math.round(clampRange(clampedGreen + ((255 - clampedGreen) * whiteBlendStrength), 0, 255))
  const profiledBlue = Math.round(clampRange(clampedBlue + ((255 - clampedBlue) * whiteBlendStrength), 0, 255))

  const textColor = useDarkText ? 'rgba(15,23,42,0.96)' : 'rgba(226,232,240,0.92)'
  const borderColor = isVeryLightBackground && isNearNeutral
    ? 'rgba(255,255,255,0.015)'
    : isLightBackground
      ? `rgba(${profiledRed},${profiledGreen},${profiledBlue},0.08)`
      : (useDarkText ? 'rgba(15,23,42,0.34)' : 'rgba(248,250,252,0.38)')
  const baseAlpha = isVeryLightBackground && isNearNeutral
    ? 0.66
    : isLightBackground
      ? 0.72
      : (useDarkText ? 0.84 : 0.74)

  return {
    red: profiledRed,
    green: profiledGreen,
    blue: profiledBlue,
    baseAlpha,
    borderColor,
    textColor,
  }
}

async function loadImageForSampling(src: string) {
  const response = await fetch(src, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Falha ao buscar imagem para amostragem de cor (HTTP ${response.status}).`)
  }

  const imageBlob = await response.blob()

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(imageBlob)
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao carregar blob da imagem para amostragem de cor.'))
    }
    image.src = objectUrl
  })
}

function sampleAverageColor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const safeX = Math.max(0, Math.floor(x))
  const safeY = Math.max(0, Math.floor(y))
  const safeW = Math.max(1, Math.floor(width))
  const safeH = Math.max(1, Math.floor(height))
  const imageData = context.getImageData(safeX, safeY, safeW, safeH).data

  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  let nonDarkRed = 0
  let nonDarkGreen = 0
  let nonDarkBlue = 0
  let nonDarkCount = 0
  type ColorBucket = { weight: number; red: number; green: number; blue: number }
  const buckets = new Map<string, ColorBucket>()
  const quantizeStep = 24

  const step = Math.max(1, Math.floor(Math.min(safeW, safeH) / 10))
  for (let row = 0; row < safeH; row += step) {
    for (let col = 0; col < safeW; col += step) {
      const index = (row * safeW + col) * 4
      const alpha = imageData[index + 3]
      if (alpha < 20) continue

      const sampledRed = imageData[index]
      const sampledGreen = imageData[index + 1]
      const sampledBlue = imageData[index + 2]
      red += sampledRed
      green += sampledGreen
      blue += sampledBlue
      count += 1

      const luminance = getRelativeLuminance(sampledRed, sampledGreen, sampledBlue)
      const maxChannel = Math.max(sampledRed, sampledGreen, sampledBlue)
      const minChannel = Math.min(sampledRed, sampledGreen, sampledBlue)
      const saturation = maxChannel <= 0 ? 0 : (maxChannel - minChannel) / maxChannel
      const quantizedRed = Math.round(sampledRed / quantizeStep) * quantizeStep
      const quantizedGreen = Math.round(sampledGreen / quantizeStep) * quantizeStep
      const quantizedBlue = Math.round(sampledBlue / quantizeStep) * quantizeStep
      const bucketKey = `${quantizedRed}:${quantizedGreen}:${quantizedBlue}`

      let weight = 1
      if (saturation >= 0.14) weight *= 1.35
      if (luminance > 0.96 && saturation < 0.08) weight *= 0.22
      if (luminance < 0.16) weight *= 0.18

      const bucket = buckets.get(bucketKey) ?? { weight: 0, red: 0, green: 0, blue: 0 }
      bucket.weight += weight
      bucket.red += sampledRed * weight
      bucket.green += sampledGreen * weight
      bucket.blue += sampledBlue * weight
      buckets.set(bucketKey, bucket)

      if (luminance >= 0.2) {
        nonDarkRed += sampledRed
        nonDarkGreen += sampledGreen
        nonDarkBlue += sampledBlue
        nonDarkCount += 1
      }
    }
  }

  if (count === 0) {
    return { red: 255, green: 255, blue: 255 }
  }

  const dominantBucket = Array.from(buckets.values()).sort((a, b) => b.weight - a.weight)[0]
  if (dominantBucket && dominantBucket.weight > 0) {
    return {
      red: dominantBucket.red / dominantBucket.weight,
      green: dominantBucket.green / dominantBucket.weight,
      blue: dominantBucket.blue / dominantBucket.weight,
    }
  }

  // Evita "puxar" para preto/cinza por conta de texto escuro sobre o balão.
  if (nonDarkCount >= Math.max(4, Math.floor(count * 0.2))) {
    return {
      red: nonDarkRed / nonDarkCount,
      green: nonDarkGreen / nonDarkCount,
      blue: nonDarkBlue / nonDarkCount,
    }
  }

  return {
    red: red / count,
    green: green / count,
    blue: blue / count,
  }
}

async function cropImageAreaToBlob(
  imageSrc: string,
  referenceSize: ImageNaturalSize,
  box: [number, number, number, number]
) {
  const image = await loadImageForSampling(imageSrc)
  const [x1Raw, y1Raw, x2Raw, y2Raw] = box

  const x1 = clampRange(Math.min(x1Raw, x2Raw), 0, referenceSize.width)
  const y1 = clampRange(Math.min(y1Raw, y2Raw), 0, referenceSize.height)
  const x2 = clampRange(Math.max(x1Raw, x2Raw), 0, referenceSize.width)
  const y2 = clampRange(Math.max(y1Raw, y2Raw), 0, referenceSize.height)
  if (x2 <= x1 || y2 <= y1) {
    throw new Error('Área inválida para OCR.')
  }

  const scaleX = image.naturalWidth / referenceSize.width
  const scaleY = image.naturalHeight / referenceSize.height

  const cropX = Math.floor(x1 * scaleX)
  const cropY = Math.floor(y1 * scaleY)
  const cropW = Math.max(1, Math.ceil((x2 - x1) * scaleX))
  const cropH = Math.max(1, Math.ceil((y2 - y1) * scaleY))

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Falha ao preparar recorte da área selecionada.')
  }

  context.drawImage(
    image,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar imagem recortada para OCR.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

function OcrTextOverlay({
  imageId,
  items,
  referenceSize,
  fontScale,
  boxInsetPercent,
  overlayDensity,
  overlayOpacity = OCR_OVERLAY_OPACITY_DEFAULT,
  globalShape = OCR_OVERLAY_DEFAULT_SHAPE,
  fontFamilyCss,
  visualScale = 1,
  editable = false,
  selectedItemId = null,
  itemOverrides = {},
  itemColors = {},
  onSelectItem,
  onClearSelection,
  onMoveItem,
  onResizeItem,
  onOpenQuickEditor,
  dragEnabledItemId = null,
  selectionModeEnabled = false,
  showTranslatingPlaceholder = false,
  textMode = 'translated',
  onSelectionDraftReady,
  selectionPreviewBox = null,
  onSelectionPreviewChange,
}: {
  imageId: number
  items: OcrOverlayItem[]
  referenceSize: ImageNaturalSize | null
  fontScale: number
  boxInsetPercent: number
  overlayDensity: number
  overlayOpacity?: number
  globalShape?: OcrOverlayShape
  fontFamilyCss: string
  visualScale?: number
  editable?: boolean
  selectedItemId?: number | null
  itemOverrides?: Record<number, OcrOverlayItemOverride>
  itemColors?: Record<number, OcrOverlayItemColors>
  onSelectItem?: (imageId: number, itemId: number) => void
  onClearSelection?: () => void
  onMoveItem?: (imageId: number, itemId: number, dx: number, dy: number) => void
  onResizeItem?: (
    imageId: number,
    itemId: number,
    payload: { dx: number; dy: number; widthScale: number; heightScale: number }
  ) => void
  onOpenQuickEditor?: (payload: { imageId: number; itemId: number; leftPercent: number; topPercent: number }) => void
  dragEnabledItemId?: number | null
  selectionModeEnabled?: boolean
  showTranslatingPlaceholder?: boolean
  textMode?: OcrOverlayTextMode
  onSelectionDraftReady?: (payload: {
    imageId: number
    box: [number, number, number, number]
    leftPercent: number
    topPercent: number
  }) => void
  selectionPreviewBox?: [number, number, number, number] | null
  onSelectionPreviewChange?: (payload: {
    imageId: number
    box: [number, number, number, number]
    leftPercent: number
    topPercent: number
  }) => void
}) {
  if (!referenceSize) return null
  if (items.length === 0 && !selectionModeEnabled && !selectionPreviewBox) return null

  const { width: refWidth, height: refHeight } = referenceSize
  if (refWidth <= 0 || refHeight <= 0) return null
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const lastTapRef = useRef<{ itemId: number; at: number; x: number; y: number } | null>(null)
  const [overlaySize, setOverlaySize] = useState<ImageNaturalSize | null>(null)
  const [selectionDraft, setSelectionDraft] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)

  useEffect(() => {
    const element = overlayRef.current
    if (!element) return

    const updateSize = () => {
      setOverlaySize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(() => updateSize())
    observer.observe(element)
    window.addEventListener('resize', updateSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const safeFontScale = clampRange(fontScale, OCR_OVERLAY_FONT_SCALE_MIN, OCR_OVERLAY_FONT_SCALE_MAX)
  const safeBoxInsetPercent = clampRange(boxInsetPercent, OCR_OVERLAY_BOX_INSET_MIN, OCR_OVERLAY_BOX_INSET_MAX)
  const safeOverlayDensity = clampRange(overlayDensity, OCR_OVERLAY_DENSITY_MIN, OCR_OVERLAY_DENSITY_MAX)
  const safeOverlayOpacity = clampRange(overlayOpacity, OCR_OVERLAY_OPACITY_MIN, OCR_OVERLAY_OPACITY_MAX)
  const safeVisualScale = clampRange(visualScale, 0.1, 6)
  const ratioX = overlaySize?.width ? (overlaySize.width / refWidth) * safeVisualScale : safeVisualScale
  const ratioY = overlaySize?.height ? (overlaySize.height / refHeight) * safeVisualScale : safeVisualScale
  const selectionPreviewData = (() => {
    if (!selectionPreviewBox) return null
    const [rawX1, rawY1, rawX2, rawY2] = selectionPreviewBox
    const x1 = clampRange(Math.min(rawX1, rawX2), 0, refWidth)
    const y1 = clampRange(Math.min(rawY1, rawY2), 0, refHeight)
    const x2 = clampRange(Math.max(rawX1, rawX2), 0, refWidth)
    const y2 = clampRange(Math.max(rawY1, rawY2), 0, refHeight)
    if (x2 <= x1 || y2 <= y1) return null

    return {
      x1,
      y1,
      x2,
      y2,
      left: `${clampPercent((x1 / refWidth) * 100)}%`,
      top: `${clampPercent((y1 / refHeight) * 100)}%`,
      width: `${clampPercent(((x2 - x1) / refWidth) * 100)}%`,
      height: `${clampPercent(((y2 - y1) / refHeight) * 100)}%`,
      leftPercent: clampPercent(((x1 + x2) / 2 / refWidth) * 100),
      topPercent: clampPercent((y1 / refHeight) * 100),
    }
  })()

  const handleResizeSelectionPreview = (
    corner: 'top-left' | 'bottom-right',
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!selectionPreviewData || !onSelectionPreviewChange) return
    event.preventDefault()
    event.stopPropagation()

    const pointerTarget = event.currentTarget
    try {
      pointerTarget.setPointerCapture(event.pointerId)
    } catch {
    }

    const pointerId = event.pointerId
    const minScreenPx = 18
    const anchorX = corner === 'top-left' ? selectionPreviewData.x2 : selectionPreviewData.x1
    const anchorY = corner === 'top-left' ? selectionPreviewData.y2 : selectionPreviewData.y1

    const getOverlayRect = () => {
      const rect = overlayRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return null
      return rect
    }

    const getPointerCoords = (clientX: number, clientY: number) => {
      const rect = getOverlayRect()
      if (!rect) return null
      const px = clampRange(clientX - rect.left, 0, rect.width)
      const py = clampRange(clientY - rect.top, 0, rect.height)
      const x = clampRange((px / rect.width) * refWidth, 0, refWidth)
      const y = clampRange((py / rect.height) * refHeight, 0, refHeight)
      const minW = Math.max(1, (minScreenPx / rect.width) * refWidth)
      const minH = Math.max(1, (minScreenPx / rect.height) * refHeight)
      return { x, y, minW, minH }
    }

    const emitBox = (x1: number, y1: number, x2: number, y2: number) => {
      const nextX1 = Math.round(clampRange(Math.min(x1, x2), 0, refWidth))
      const nextY1 = Math.round(clampRange(Math.min(y1, y2), 0, refHeight))
      const nextX2 = Math.round(clampRange(Math.max(x1, x2), 0, refWidth))
      const nextY2 = Math.round(clampRange(Math.max(y1, y2), 0, refHeight))
      if (nextX2 <= nextX1 || nextY2 <= nextY1) return

      onSelectionPreviewChange({
        imageId,
        box: [nextX1, nextY1, nextX2, nextY2],
        leftPercent: clampPercent(((nextX1 + nextX2) / 2 / refWidth) * 100),
        topPercent: clampPercent((nextY1 / refHeight) * 100),
      })
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const coords = getPointerCoords(moveEvent.clientX, moveEvent.clientY)
      if (!coords) return

      if (corner === 'top-left') {
        const nextX1 = clampRange(coords.x, 0, anchorX - coords.minW)
        const nextY1 = clampRange(coords.y, 0, anchorY - coords.minH)
        emitBox(nextX1, nextY1, anchorX, anchorY)
        return
      }

      const nextX2 = clampRange(coords.x, anchorX + coords.minW, refWidth)
      const nextY2 = clampRange(coords.y, anchorY + coords.minH, refHeight)
      emitBox(anchorX, anchorY, nextX2, nextY2)
    }

    const clearListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', clearListeners)
      window.removeEventListener('pointercancel', clearListeners)
      try {
        pointerTarget.releasePointerCapture(pointerId)
      } catch {
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', clearListeners)
    window.addEventListener('pointercancel', clearListeners)
  }

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (!selectionModeEnabled || !onSelectionDraftReady) {
      onClearSelection?.()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const pointerTarget = event.currentTarget
    try {
      pointerTarget.setPointerCapture(event.pointerId)
    } catch {
    }

    const overlayElement = overlayRef.current
    const overlayRect = overlayElement?.getBoundingClientRect()
    if (!overlayRect || overlayRect.width <= 0 || overlayRect.height <= 0) {
      return
    }
    const pointerId = event.pointerId

    const resolveOverlayRect = () => {
      const activeRect = overlayRef.current?.getBoundingClientRect()
      if (activeRect && activeRect.width > 0 && activeRect.height > 0) {
        return activeRect
      }
      return overlayRect
    }

    const startX = clampRange(event.clientX - overlayRect.left, 0, overlayRect.width)
    const startY = clampRange(event.clientY - overlayRect.top, 0, overlayRect.height)
    setSelectionDraft({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    })

    const finalizeSelection = (clientX: number, clientY: number) => {
      const activeRect = resolveOverlayRect()
      const endX = clampRange(clientX - activeRect.left, 0, activeRect.width)
      const endY = clampRange(clientY - activeRect.top, 0, activeRect.height)
      const leftPx = Math.min(startX, endX)
      const topPx = Math.min(startY, endY)
      const widthPx = Math.abs(endX - startX)
      const heightPx = Math.abs(endY - startY)

      setSelectionDraft(null)
      if (widthPx < 12 || heightPx < 12) return

      const x1 = clampRange((leftPx / activeRect.width) * refWidth, 0, refWidth)
      const y1 = clampRange((topPx / activeRect.height) * refHeight, 0, refHeight)
      const x2 = clampRange(((leftPx + widthPx) / activeRect.width) * refWidth, 0, refWidth)
      const y2 = clampRange(((topPx + heightPx) / activeRect.height) * refHeight, 0, refHeight)
      if (x2 <= x1 || y2 <= y1) return

      onSelectionDraftReady({
        imageId,
        box: [
          Math.round(x1),
          Math.round(y1),
          Math.round(x2),
          Math.round(y2),
        ],
        leftPercent: clampPercent(((x1 + x2) / 2 / refWidth) * 100),
        topPercent: clampPercent((y1 / refHeight) * 100),
      })
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const activeRect = resolveOverlayRect()
      const nextX = clampRange(moveEvent.clientX - activeRect.left, 0, activeRect.width)
      const nextY = clampRange(moveEvent.clientY - activeRect.top, 0, activeRect.height)
      setSelectionDraft({
        startX,
        startY,
        currentX: nextX,
        currentY: nextY,
      })
    }

    const clearPointerListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      try {
        pointerTarget.releasePointerCapture(pointerId)
      } catch {
      }
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      clearPointerListeners()
      finalizeSelection(upEvent.clientX, upEvent.clientY)
    }

    const handlePointerCancel = () => {
      clearPointerListeners()
      setSelectionDraft(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
  }

  return (
    <div
      ref={overlayRef}
      data-ocr-overlay-interactive="true"
      onPointerDown={handleOverlayPointerDown}
      className={cn(
        'absolute inset-0 z-10',
        (editable || Boolean(onOpenQuickEditor) || selectionModeEnabled)
          ? 'pointer-events-auto'
          : 'pointer-events-none',
        selectionModeEnabled && 'cursor-crosshair touch-none'
      )}
    >
      {selectionModeEnabled && (
        <div className="pointer-events-none absolute inset-0 z-[5] bg-black/35" />
      )}
      {selectionPreviewData && (
        <>
          <div
            className="pointer-events-none absolute z-[38] rounded-[4px] border border-primary bg-primary/20 ring-1 ring-primary/60"
            style={{
              left: selectionPreviewData.left,
              top: selectionPreviewData.top,
              width: selectionPreviewData.width,
              height: selectionPreviewData.height,
            }}
          />
          {onSelectionPreviewChange && (
            <>
              <div
                className="absolute z-[39] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md touch-none cursor-nwse-resize"
                style={{
                  left: `${clampPercent((selectionPreviewData.x1 / refWidth) * 100)}%`,
                  top: `${clampPercent((selectionPreviewData.y1 / refHeight) * 100)}%`,
                }}
                onPointerDown={(event) => handleResizeSelectionPreview('top-left', event)}
                aria-label="Redimensionar canto superior esquerdo"
                role="button"
              />
              <div
                className="absolute z-[39] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md touch-none cursor-nwse-resize"
                style={{
                  left: `${clampPercent((selectionPreviewData.x2 / refWidth) * 100)}%`,
                  top: `${clampPercent((selectionPreviewData.y2 / refHeight) * 100)}%`,
                }}
                onPointerDown={(event) => handleResizeSelectionPreview('bottom-right', event)}
                aria-label="Redimensionar canto inferior direito"
                role="button"
              />
            </>
          )}
        </>
      )}
      {selectionDraft && (
        <div
          className="pointer-events-none absolute z-40 rounded-[4px] border border-primary/80 bg-primary/20"
          style={{
            left: `${Math.min(selectionDraft.startX, selectionDraft.currentX)}px`,
            top: `${Math.min(selectionDraft.startY, selectionDraft.currentY)}px`,
            width: `${Math.abs(selectionDraft.currentX - selectionDraft.startX)}px`,
            height: `${Math.abs(selectionDraft.currentY - selectionDraft.startY)}px`,
          }}
        />
      )}
      {items.map((item) => {
        const [x1, y1, x2, y2] = item.box
        const boxWidth = x2 - x1
        const boxHeight = y2 - y1
        if (boxWidth <= 0 || boxHeight <= 0) return null

        const insetX = (boxWidth * safeBoxInsetPercent) / 100
        const insetY = (boxHeight * safeBoxInsetPercent) / 100

        let adjustedX1 = x1 + insetX
        let adjustedY1 = y1 + insetY
        let adjustedX2 = x2 - insetX
        let adjustedY2 = y2 - insetY

        adjustedX1 = clampRange(adjustedX1, 0, refWidth)
        adjustedX2 = clampRange(adjustedX2, 0, refWidth)
        adjustedY1 = clampRange(adjustedY1, 0, refHeight)
        adjustedY2 = clampRange(adjustedY2, 0, refHeight)

        if (adjustedX2 - adjustedX1 < 2 || adjustedY2 - adjustedY1 < 2) {
          adjustedX1 = x1
          adjustedY1 = y1
          adjustedX2 = x2
          adjustedY2 = y2
        }

        const adjustedWidth = adjustedX2 - adjustedX1
        const adjustedHeight = adjustedY2 - adjustedY1
        if (adjustedWidth <= 0 || adjustedHeight <= 0) return null

        const override = itemOverrides[item.id]
        const offsetX = override?.dx ?? 0
        const offsetY = override?.dy ?? 0
        const itemFontScale = clampRange(
          override?.fontScale ?? OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT,
          OCR_OVERLAY_ITEM_FONT_SCALE_MIN,
          OCR_OVERLAY_ITEM_FONT_SCALE_MAX
        )
        const itemSizeScale = clampRange(
          override?.sizeScale ?? OCR_OVERLAY_ITEM_SIZE_DEFAULT,
          OCR_OVERLAY_ITEM_SIZE_MIN,
          OCR_OVERLAY_ITEM_SIZE_MAX
        )
        const itemWidthScale = clampRange(
          override?.widthScale ?? OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
        )
        const itemHeightScale = clampRange(
          override?.heightScale ?? OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
        )
        const itemDensity = clampRange(
          override?.density ?? OCR_OVERLAY_ITEM_DENSITY_DEFAULT,
          OCR_OVERLAY_ITEM_DENSITY_MIN,
          OCR_OVERLAY_ITEM_DENSITY_MAX
        )
        const shape = override?.shape ?? globalShape

        let movedX1 = adjustedX1 + offsetX
        let movedX2 = adjustedX2 + offsetX
        let movedY1 = adjustedY1 + offsetY
        let movedY2 = adjustedY2 + offsetY

        if (movedX1 < 0) {
          const shift = -movedX1
          movedX1 += shift
          movedX2 += shift
        }
        if (movedX2 > refWidth) {
          const shift = movedX2 - refWidth
          movedX1 -= shift
          movedX2 -= shift
        }
        if (movedY1 < 0) {
          const shift = -movedY1
          movedY1 += shift
          movedY2 += shift
        }
        if (movedY2 > refHeight) {
          const shift = movedY2 - refHeight
          movedY1 -= shift
          movedY2 -= shift
        }

        movedX1 = clampRange(movedX1, 0, refWidth)
        movedY1 = clampRange(movedY1, 0, refHeight)
        movedX2 = clampRange(movedX2, 0, refWidth)
        movedY2 = clampRange(movedY2, 0, refHeight)

        let movedWidth = movedX2 - movedX1
        let movedHeight = movedY2 - movedY1
        if (movedWidth <= 0 || movedHeight <= 0) return null

        const centerX = movedX1 + movedWidth / 2
        const centerY = movedY1 + movedHeight / 2
        movedWidth = movedWidth * itemSizeScale * itemWidthScale
        movedHeight = movedHeight * itemSizeScale * itemHeightScale
        movedX1 = centerX - movedWidth / 2
        movedX2 = centerX + movedWidth / 2
        movedY1 = centerY - movedHeight / 2
        movedY2 = centerY + movedHeight / 2

        if (movedX1 < 0) {
          const shift = -movedX1
          movedX1 += shift
          movedX2 += shift
        }
        if (movedX2 > refWidth) {
          const shift = movedX2 - refWidth
          movedX1 -= shift
          movedX2 -= shift
        }
        if (movedY1 < 0) {
          const shift = -movedY1
          movedY1 += shift
          movedY2 += shift
        }
        if (movedY2 > refHeight) {
          const shift = movedY2 - refHeight
          movedY1 -= shift
          movedY2 -= shift
        }

        movedX1 = clampRange(movedX1, 0, refWidth)
        movedY1 = clampRange(movedY1, 0, refHeight)
        movedX2 = clampRange(movedX2, 0, refWidth)
        movedY2 = clampRange(movedY2, 0, refHeight)
        movedWidth = movedX2 - movedX1
        movedHeight = movedY2 - movedY1
        if (movedWidth <= 0 || movedHeight <= 0) return null

        const left = clampPercent((movedX1 / refWidth) * 100)
        const top = clampPercent((movedY1 / refHeight) * 100)
        const width = clampPercent((movedWidth / refWidth) * 100)
        const height = clampPercent((movedHeight / refHeight) * 100)
        const hasTranslatedText = item.translatedText.trim().length > 0
        const hasOcrText = item.ocrText.trim().length > 0
        const originalTextValue = item.ocrText || item.translatedText
        const translatedTextValue = (
          showTranslatingPlaceholder
          && hasOcrText
          && !hasTranslatedText
        )
          ? 'Traduzindo...'
          : (item.translatedText || item.ocrText)
        const textValue = textMode === 'original'
          ? originalTextValue
          : translatedTextValue
        const displayedWidth = Math.max(1, movedWidth * ratioX)
        const displayedHeight = Math.max(1, movedHeight * ratioY)
        const baseFontPxUnscaled = movedHeight * 0.23 * Math.min(ratioX, ratioY) * OCR_OVERLAY_DEFAULT_FONT_SCALE
        const baseFontPx = movedHeight * 0.23 * Math.min(ratioX, ratioY) * safeFontScale
        const compactText = textValue.replace(/\s+/g, ' ').trim()
        const explicitLineCount = Math.max(1, textValue.split('\n').length)
        const approxCharsPerLine = Math.max(1, Math.floor(displayedWidth / Math.max(1, baseFontPxUnscaled * 0.56)))
        const longestWordLength = compactText
          .split(/\s+/)
          .reduce((max, token) => Math.max(max, token.length), 1)
        const estimatedLineCount = Math.max(
          explicitLineCount,
          Math.ceil(Math.max(1, compactText.length) / approxCharsPerLine)
        )
        const maxFontByHeight = displayedHeight / Math.max(1, estimatedLineCount * 1.2)
        const maxFontByWidth = displayedWidth / Math.max(2, longestWordLength * 0.62)
        const fitFontSize = Math.min(baseFontPx, maxFontByHeight, maxFontByWidth)
        const fontSize = clampRange(fitFontSize * itemFontScale, 2, 120)
        const sampledColors = itemColors[item.id]
        const effectiveDensity = clampRange(
          safeOverlayDensity * itemDensity,
          OCR_OVERLAY_DENSITY_MIN,
          OCR_OVERLAY_DENSITY_MAX * OCR_OVERLAY_ITEM_DENSITY_MAX
        )
        const baseAlpha = sampledColors?.baseAlpha ?? 0.88
        const backgroundAlpha = clampRange(baseAlpha * effectiveDensity * safeOverlayOpacity, 0.08, 0.98)
        const backgroundColor = sampledColors
          ? `rgba(${sampledColors.red}, ${sampledColors.green}, ${sampledColors.blue}, ${backgroundAlpha})`
          : `rgba(255, 255, 255, ${backgroundAlpha})`
        const borderColor = sampledColors?.borderColor ?? 'rgba(255,255,255,0)'
        const textColor = sampledColors?.textColor ?? 'rgba(15,23,42,0.96)'
        const isSelected = editable && selectedItemId === item.id
        const isDragEnabledForItem = editable && dragEnabledItemId === item.id
        const showResizeHandles = Boolean(
          editable
          && isSelected
          && onResizeItem
          && !selectionModeEnabled
          && !selectionPreviewData
        )

        const handleResizePointerDown = (
          corner: 'top-left' | 'bottom-right',
          event: React.PointerEvent<HTMLDivElement>
        ) => {
          if (!onResizeItem) return
          event.preventDefault()
          event.stopPropagation()

          const pointerTarget = event.currentTarget
          try {
            pointerTarget.setPointerCapture(event.pointerId)
          } catch {
          }

          const pointerId = event.pointerId
          const minScreenPx = 18
          const anchorX = corner === 'top-left' ? movedX2 : movedX1
          const anchorY = corner === 'top-left' ? movedY2 : movedY1
          const baseWidth = Math.max(1, adjustedWidth)
          const baseHeight = Math.max(1, adjustedHeight)
          const baseCenterX = adjustedX1 + adjustedWidth / 2
          const baseCenterY = adjustedY1 + adjustedHeight / 2

          const getOverlayRect = () => {
            const rect = overlayRef.current?.getBoundingClientRect()
            if (!rect || rect.width <= 0 || rect.height <= 0) return null
            return rect
          }

          const handlePointerMove = (moveEvent: PointerEvent) => {
            const rect = getOverlayRect()
            if (!rect) return

            const pointerPxX = clampRange(moveEvent.clientX - rect.left, 0, rect.width)
            const pointerPxY = clampRange(moveEvent.clientY - rect.top, 0, rect.height)
            const pointerX = clampRange((pointerPxX / rect.width) * refWidth, 0, refWidth)
            const pointerY = clampRange((pointerPxY / rect.height) * refHeight, 0, refHeight)
            const minWidth = Math.max(1, (minScreenPx / rect.width) * refWidth)
            const minHeight = Math.max(1, (minScreenPx / rect.height) * refHeight)

            let targetWidth: number
            let targetHeight: number
            if (corner === 'top-left') {
              targetWidth = clampRange(anchorX - pointerX, minWidth, refWidth)
              targetHeight = clampRange(anchorY - pointerY, minHeight, refHeight)
            } else {
              targetWidth = clampRange(pointerX - anchorX, minWidth, refWidth)
              targetHeight = clampRange(pointerY - anchorY, minHeight, refHeight)
            }

            const nextWidthScale = clampRange(
              targetWidth / Math.max(1, baseWidth * itemSizeScale),
              OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
              OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
            )
            const nextHeightScale = clampRange(
              targetHeight / Math.max(1, baseHeight * itemSizeScale),
              OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
              OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
            )
            const nextWidth = baseWidth * itemSizeScale * nextWidthScale
            const nextHeight = baseHeight * itemSizeScale * nextHeightScale

            let nextX1 = corner === 'top-left' ? anchorX - nextWidth : anchorX
            let nextY1 = corner === 'top-left' ? anchorY - nextHeight : anchorY
            let nextX2 = corner === 'top-left' ? anchorX : anchorX + nextWidth
            let nextY2 = corner === 'top-left' ? anchorY : anchorY + nextHeight

            if (nextX1 < 0) {
              const shift = -nextX1
              nextX1 += shift
              nextX2 += shift
            }
            if (nextX2 > refWidth) {
              const shift = nextX2 - refWidth
              nextX1 -= shift
              nextX2 -= shift
            }
            if (nextY1 < 0) {
              const shift = -nextY1
              nextY1 += shift
              nextY2 += shift
            }
            if (nextY2 > refHeight) {
              const shift = nextY2 - refHeight
              nextY1 -= shift
              nextY2 -= shift
            }

            nextX1 = clampRange(nextX1, 0, refWidth)
            nextX2 = clampRange(nextX2, 0, refWidth)
            nextY1 = clampRange(nextY1, 0, refHeight)
            nextY2 = clampRange(nextY2, 0, refHeight)

            const nextCenterX = (nextX1 + nextX2) / 2
            const nextCenterY = (nextY1 + nextY2) / 2
            const nextDx = clampRange(nextCenterX - baseCenterX, -5000, 5000)
            const nextDy = clampRange(nextCenterY - baseCenterY, -5000, 5000)

            onResizeItem(imageId, item.id, {
              dx: nextDx,
              dy: nextDy,
              widthScale: nextWidthScale,
              heightScale: nextHeightScale,
            })
          }

          const clearListeners = () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', clearListeners)
            window.removeEventListener('pointercancel', clearListeners)
            try {
              pointerTarget.releasePointerCapture(pointerId)
            } catch {
            }
          }

          window.addEventListener('pointermove', handlePointerMove)
          window.addEventListener('pointerup', clearListeners)
          window.addEventListener('pointercancel', clearListeners)
        }

        const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
          if (selectionModeEnabled) return
          if (!editable && !onOpenQuickEditor) return

          if (onOpenQuickEditor) {
            const now = Date.now()
            const previousTap = lastTapRef.current
            const isSameItem = previousTap?.itemId === item.id
            const isQuickDoubleTap = Boolean(
              previousTap
                && isSameItem
                && (now - previousTap.at) <= OCR_OVERLAY_QUICK_EDITOR_DOUBLE_TAP_MS
                && Math.abs(event.clientX - previousTap.x) <= OCR_OVERLAY_QUICK_EDITOR_TAP_MOVE_PX
                && Math.abs(event.clientY - previousTap.y) <= OCR_OVERLAY_QUICK_EDITOR_TAP_MOVE_PX
            )

            if (isQuickDoubleTap) {
              lastTapRef.current = null
              event.preventDefault()
              event.stopPropagation()
              onOpenQuickEditor({
                imageId,
                itemId: item.id,
                leftPercent: clampPercent(left + width / 2),
                topPercent: clampPercent(top),
              })
              return
            }

            lastTapRef.current = {
              itemId: item.id,
              at: now,
              x: event.clientX,
              y: event.clientY,
            }
          }

          if (!editable || !onMoveItem) return
          if (dragEnabledItemId !== item.id) return

          event.preventDefault()
          event.stopPropagation()

          const pointerTarget = event.currentTarget
          const pointerId = event.pointerId
          try {
            pointerTarget.setPointerCapture(pointerId)
          } catch {
          }

          onSelectItem?.(imageId, item.id)

          const startClientX = event.clientX
          const startClientY = event.clientY
          const startDx = offsetX
          const startDy = offsetY
          const renderedRect = overlayRef.current?.getBoundingClientRect()
          const renderedWidth = Math.max(1, renderedRect?.width ?? displayedWidth)
          const renderedHeight = Math.max(1, renderedRect?.height ?? displayedHeight)

          const handlePointerMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault()
            const deltaClientX = moveEvent.clientX - startClientX
            const deltaClientY = moveEvent.clientY - startClientY
            const nextDx = startDx + (deltaClientX * refWidth) / renderedWidth
            const nextDy = startDy + (deltaClientY * refHeight) / renderedHeight
            onMoveItem(imageId, item.id, nextDx, nextDy)
          }

          const clearListeners = () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', clearListeners)
            window.removeEventListener('pointercancel', clearListeners)
            try {
              pointerTarget.releasePointerCapture(pointerId)
            } catch {
            }
          }

          window.addEventListener('pointermove', handlePointerMove)
          window.addEventListener('pointerup', clearListeners)
          window.addEventListener('pointercancel', clearListeners)
        }

        return (
          <Fragment key={item.id}>
            <div
              data-ocr-overlay-interactive="true"
              data-ocr-overlay-item-key={`${imageId}:${item.id}`}
              onPointerDown={handlePointerDown}
              className={cn(
                'absolute z-20 flex items-center justify-center overflow-hidden px-1 text-center font-semibold select-none',
                shape === 'oval' ? 'rounded-[999px]' : 'rounded-[4px]',
                (selectionModeEnabled || Boolean(selectionPreviewData))
                  ? 'pointer-events-none'
                  : editable
                    ? isDragEnabledForItem
                      ? 'cursor-grab active:cursor-grabbing pointer-events-auto touch-none'
                      : 'cursor-pointer pointer-events-auto'
                    : onOpenQuickEditor
                      ? 'cursor-pointer pointer-events-auto'
                      : 'pointer-events-none',
                isSelected && 'ring-2 ring-primary/60'
              )}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                backgroundColor,
                borderColor: 'transparent',
                borderWidth: 0,
                filter: 'none',
                backdropFilter: 'none',
              }}
            >
              <span
                className="w-full overflow-hidden whitespace-pre-wrap break-words"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.12,
                  color: textColor,
                  fontFamily: fontFamilyCss,
                  textShadow: 'none',
                  filter: 'none',
                  WebkitTextStroke: '0 transparent',
                }}
              >
                {textValue}
              </span>
            </div>
            {showResizeHandles && (
              <>
                <div
                  data-ocr-overlay-interactive="true"
                  data-ocr-overlay-item-key={`${imageId}:${item.id}`}
                  className="absolute z-[41] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md touch-none cursor-nwse-resize"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                  }}
                  onPointerDown={(event) => handleResizePointerDown('top-left', event)}
                  aria-label="Redimensionar balão pelo canto superior esquerdo"
                  role="button"
                />
                <div
                  data-ocr-overlay-interactive="true"
                  data-ocr-overlay-item-key={`${imageId}:${item.id}`}
                  className="absolute z-[41] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md touch-none cursor-nwse-resize"
                  style={{
                    left: `${clampPercent(left + width)}%`,
                    top: `${clampPercent(top + height)}%`,
                  }}
                  onPointerDown={(event) => handleResizePointerDown('bottom-right', event)}
                  aria-label="Redimensionar balão pelo canto inferior direito"
                  role="button"
                />
              </>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export function SectionReader({ sectionId }: SectionReaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const libraryPageParam = searchParams.get('page')
  const libraryPage = libraryPageParam ? Number.parseInt(libraryPageParam, 10) : NaN
  const backToLibraryHref = Number.isFinite(libraryPage) && libraryPage > 1
    ? `/inicio/secoes?page=${libraryPage}`
    : '/inicio/secoes'

  const [section, setSection] = useState<SectionDetail | null>(null)
  const [isLoadingSection, setIsLoadingSection] = useState(true)
  const [isUpdatingPublicAccess, setIsUpdatingPublicAccess] = useState(false)
  const [copiedShareLink, setCopiedShareLink] = useState(false)
  const [isPublicSharingExpanded, setIsPublicSharingExpanded] = useState(false)
  const [isDeletingSection, setIsDeletingSection] = useState(false)
  const [isRenamingSection, setIsRenamingSection] = useState(false)
  const [isEditingSectionName, setIsEditingSectionName] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [limitModalState, setLimitModalState] = useState<LimitModalState | null>(null)
  const [isPollingStatus, setIsPollingStatus] = useState(false)
  const [isRealtimeStatusConnected, setIsRealtimeStatusConnected] = useState(false)
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [queueActionLoading, setQueueActionLoading] = useState<'queue' | 'reprocess' | null>(null)
  const [userRole, setUserRole] = useState<number | null>(null)
  const [isAutoProcessingEnabled, setIsAutoProcessingEnabled] = useState(false)

  const [readPages, setReadPages] = useState<Set<number>>(new Set())
  const [readingMode, setReadingMode] = useState(false)
  const [readingViewMode, setReadingViewMode] = useState<'paginated' | 'scroll'>('paginated')
  const [suggestedSections, setSuggestedSections] = useState<SectionListItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsScrollRef = useRef<HTMLDivElement | null>(null)
  const [suggestionsCanScrollLeft, setSuggestionsCanScrollLeft] = useState(false)
  const [suggestionsCanScrollRight, setSuggestionsCanScrollRight] = useState(true)
  const SECTION_GRID_INITIAL_PAGES = 20
  const SECTION_GRID_LOAD_MORE_BATCH = 20
  const [sectionGridVisibleCount, setSectionGridVisibleCount] = useState(SECTION_GRID_INITIAL_PAGES)
  const [revealedScrollImageIds, setRevealedScrollImageIds] = useState<Set<number>>(new Set())
  const scrollImageObserverRef = useRef<IntersectionObserver | null>(null)
  const [isOverlayFontPopoverOpen, setIsOverlayFontPopoverOpen] = useState(false)
  const [currentReadingPage, setCurrentReadingPage] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, boolean>>({})
  const [isReadingImageLoading, setIsReadingImageLoading] = useState(false)
  const [sectionCategoryDraft, setSectionCategoryDraft] = useState('')
  const [sectionCategoryOptions, setSectionCategoryOptions] = useState<string[]>([])
  const [sectionCategoryQuery, setSectionCategoryQuery] = useState('')
  const [isSectionCategoryPopoverOpen, setIsSectionCategoryPopoverOpen] = useState(false)
  const [sectionCategoryPopoverWidth, setSectionCategoryPopoverWidth] = useState<number | null>(null)
  const [isSectionCategoryLoading, setIsSectionCategoryLoading] = useState(false)
  const [isSectionCategorySaving, setIsSectionCategorySaving] = useState(false)
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState('')
  const [isStatsExpanded, setIsStatsExpanded] = useState(false)
  const [isStatsLoading, setIsStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [sectionStats, setSectionStats] = useState<{
    totalPages: number
    selectedPages: number
    translatedPages: number
    ocrCompletedPages: number
    completedPages: number
    pagesWithElapsedMs: number
    totalElapsedMinutes: number
    avgElapsedSecondsPerPage: number
    totalDetections: number
    providerLang: string | null
    costModel: string | null
    estimatedInputTokens: number
    estimatedOutputTokens: number
    estimatedInputCostUsd: number | null
    estimatedOutputCostUsd: number | null
    estimatedTotalCostUsd: number | null
    generatedAt: string | null
  } | null>(null)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)
  const [ocrOverlayFontFamily, setOcrOverlayFontFamily] = useState<OcrOverlayFontFamily>(OCR_OVERLAY_DEFAULT_FONT_FAMILY)
  const [ocrOverlayFontScale, setOcrOverlayFontScale] = useState(OCR_OVERLAY_DEFAULT_FONT_SCALE)
  const [ocrOverlayTextMode, setOcrOverlayTextMode] = useState<OcrOverlayTextMode>('translated')
  const [ocrOverlayBoxInsetPercent, setOcrOverlayBoxInsetPercent] = useState(OCR_OVERLAY_DEFAULT_BOX_INSET)
  const [ocrOverlayDensity, setOcrOverlayDensity] = useState(OCR_OVERLAY_DENSITY_DEFAULT)
  const [ocrOverlayOpacity, setOcrOverlayOpacity] = useState(OCR_OVERLAY_OPACITY_DEFAULT)
  const [ocrOverlayGlobalShape, setOcrOverlayGlobalShape] = useState<OcrOverlayShape>(OCR_OVERLAY_DEFAULT_SHAPE)
  const [sectionCategoryOverlayPreferences, setSectionCategoryOverlayPreferences] =
    useState<SectionCategoryOverlayPreferences | null>(null)
  const ocrOverlayEditMode = true
  const [ocrOverlayOverridesByImageId, setOcrOverlayOverridesByImageId] = useState<Record<number, Record<number, OcrOverlayItemOverride>>>({})
  const [selectedOverlayTarget, setSelectedOverlayTarget] = useState<{ imageId: number; itemId: number } | null>(null)
  const [overlayQuickEditorState, setOverlayQuickEditorState] = useState<{
    imageId: number
    itemId: number
    leftPercent: number
    topPercent: number
  } | null>(null)
  const [overlayDragEnabledTarget, setOverlayDragEnabledTarget] = useState<{ imageId: number; itemId: number } | null>(null)
  const [overlayQuickEditorPlacement, setOverlayQuickEditorPlacement] = useState<{
    imageId: number
    itemId: number
    side: 'top' | 'bottom'
    align: 'start' | 'center' | 'end'
  } | null>(null)
  const [ocrOverlayColorsByImageId, setOcrOverlayColorsByImageId] = useState<Record<number, Record<number, OcrOverlayItemColors>>>({})
  const [ocrOverlayColorLoadingByImageId, setOcrOverlayColorLoadingByImageId] = useState<Record<number, boolean>>({})
  const [ocrOverlayByImageId, setOcrOverlayByImageId] = useState<Record<number, OcrOverlayItem[]>>({})
  const [ocrOverlayManualItemsByImageId, setOcrOverlayManualItemsByImageId] = useState<Record<number, OcrOverlayItem[]>>({})
  const [ocrOverlayHiddenItemIdsByImageId, setOcrOverlayHiddenItemIdsByImageId] = useState<Record<number, number[]>>({})
  const [ocrOverlayLoadingByImageId, setOcrOverlayLoadingByImageId] = useState<Record<number, boolean>>({})
  const [ocrOverlayTranslateQueue, setOcrOverlayTranslateQueue] = useState<number[]>([])
  const [ocrOverlayCreatingSelectionByImageId, setOcrOverlayCreatingSelectionByImageId] = useState<Record<number, boolean>>({})
  const [ocrOverlayErrorByImageId, setOcrOverlayErrorByImageId] = useState<Record<number, string>>({})
  const [isOverlaySelectionMode, setIsOverlaySelectionMode] = useState(false)
  const [overlaySelectionDraft, setOverlaySelectionDraft] = useState<{
    imageId: number
    box: [number, number, number, number]
    leftPercent: number
    topPercent: number
  } | null>(null)
  const [overlaySelectionSourceLang, setOverlaySelectionSourceLang] = useState(OCR_OVERLAY_SELECTION_SOURCE_DEFAULT)
  const [overlaySelectionTargetLang, setOverlaySelectionTargetLang] = useState(OCR_OVERLAY_SELECTION_TARGET_DEFAULT)
  const [isOverlayStateReady, setIsOverlayStateReady] = useState(false)
  const [imageNaturalSizeById, setImageNaturalSizeById] = useState<Record<number, ImageNaturalSize>>({})
  const [isTourOpen, setIsTourOpen] = useState(false)
  const readProgressLastSyncedDoneRef = useRef<boolean | null>(null)
  const overlayStateSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayStateLastSavedRef = useRef('')
  const overlayStateLoadedFromServerRef = useRef(false)
  const overlayCategoryDefaultsAppliedRef = useRef(false)
  const sectionStatusSocketRef = useRef<Socket | null>(null)
  const sectionCategoryLastSavedRef = useRef('')
  const sectionCategorySaveRequestRef = useRef(0)
  const sectionCategorySkipCloseCommitRef = useRef(false)
  const sectionCategoryTriggerRef = useRef<HTMLButtonElement | null>(null)
  const ocrOverlayTranslateWorkerBusyRef = useRef(false)
  const sectionNameSyncedRef = useRef('')
  const sectionNameInputRef = useRef<HTMLInputElement | null>(null)
  const readingTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const readingSwipeLockedRef = useRef(false)
  const readingInteractionZoneRef = useRef<HTMLDivElement | null>(null)
  const autoQueueAttemptedRef = useRef(false)
  const autoReprocessAttemptedRef = useRef(false)
  const autoReprocessAcceptedRef = useRef(false)

  const handleUnauthorized = useCallback(() => {
    const params = new URLSearchParams()
    params.set('expired', '1')
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : `/inicio/secoes/${sectionId}`
    if (currentPath.startsWith('/')) {
      params.set('redirect', currentPath)
    }
    router.replace(`/login?${params.toString()}`)
  }, [router, sectionId])

  useEffect(() => {
    let cancelled = false
    void readAutoProcessingEnabledPreference().then((enabled) => {
      if (cancelled) return
      setIsAutoProcessingEnabled(enabled)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const markImageAsLoaded = useCallback((url: string) => {
    setLoadedImageUrls((prev) => {
      if (prev[url]) return prev
      return {
        ...prev,
        [url]: true,
      }
    })
  }, [])

  const updateImageNaturalSize = useCallback((imageId: number, width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return
    }

    setImageNaturalSizeById((prev) => {
      const current = prev[imageId]
      if (current && current.width === width && current.height === height) {
        return prev
      }

      return {
        ...prev,
        [imageId]: { width, height },
      }
    })
  }, [])

  const fetchSection = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false

    if (silent) {
      setIsPollingStatus(true)
    } else {
      setIsLoadingSection(true)
    }

    try {
      const response = await fetch(`/api/sections/${sectionId}`, { cache: 'no-store' })
      const data = await response.json()

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível carregar a seção.'))
      }

      setSection(data as SectionDetail)
      setLastStatusSyncAt(Date.now())
      if (!silent) {
        setError('')
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar seção.')
      }
    } finally {
      if (silent) {
        setIsPollingStatus(false)
      } else {
        setIsLoadingSection(false)
      }
    }
  }, [handleUnauthorized, sectionId])

  const fetchSectionStats = useCallback(async () => {
    setIsStatsLoading(true)
    setStatsError('')

    try {
      const response = await fetch(`/api/sections/${sectionId}/stats`, { cache: 'no-store' })
      const data = (await response.json().catch(() => ({}))) as SectionStatsResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível carregar estatísticas da seção.'))
      }

      setSectionStats({
        totalPages: Math.max(0, toFiniteNumber(data.total_pages) ?? 0),
        selectedPages: Math.max(0, toFiniteNumber(data.selected_pages) ?? 0),
        translatedPages: Math.max(0, toFiniteNumber(data.translated_pages) ?? 0),
        ocrCompletedPages: Math.max(0, toFiniteNumber(data.ocr_completed_pages) ?? 0),
        completedPages: Math.max(0, toFiniteNumber(data.completed_pages) ?? 0),
        pagesWithElapsedMs: Math.max(0, toFiniteNumber(data.pages_with_elapsed_ms) ?? 0),
        totalElapsedMinutes: Math.max(0, toFiniteNumber(data.total_elapsed_minutes) ?? 0),
        avgElapsedSecondsPerPage: Math.max(0, toFiniteNumber(data.avg_elapsed_seconds_per_page) ?? 0),
        totalDetections: Math.max(0, toFiniteNumber(data.total_detections) ?? 0),
        providerLang: toStringValue(data.provider_lang),
        costModel: toStringValue(data.cost_model),
        estimatedInputTokens: Math.max(0, toFiniteNumber(data.estimated_input_tokens) ?? 0),
        estimatedOutputTokens: Math.max(0, toFiniteNumber(data.estimated_output_tokens) ?? 0),
        estimatedInputCostUsd: toFiniteNumber(data.estimated_input_cost_usd),
        estimatedOutputCostUsd: toFiniteNumber(data.estimated_output_cost_usd),
        estimatedTotalCostUsd: toFiniteNumber(data.estimated_total_cost_usd),
        generatedAt: typeof data.generated_at === 'string' ? data.generated_at : null,
      })
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas da seção.')
    } finally {
      setIsStatsLoading(false)
    }
  }, [handleUnauthorized, sectionId])

  useEffect(() => {
    void fetchSection()
  }, [fetchSection])

  const forcedPollingEndAtRef = useRef<number>(0)
  const prevProcessingRef = useRef(false)

  const triggerForcedPolling = useCallback((durationMs = 90_000) => {
    forcedPollingEndAtRef.current = Date.now() + durationMs
  }, [])

  // Derivados a partir dos status individuais das imagens (processing_images_count e
  // queued_images_count NÃO chegam via WebSocket — só na rota de listagem)
  const derivedProcessingCount = useMemo(
    () => (
      section?.images ?? []
    ).filter((img) => img.selected_for_processing && img.translation_status === 'processing').length,
    [section?.images]
  )
  const derivedQueuedCount = useMemo(
    () => (
      section?.images ?? []
    ).filter((img) => (
      img.selected_for_processing
      && (img.translation_status === 'queued' || img.translation_status === 'pending')
    )).length,
    [section?.images]
  )

  useEffect(() => {
    const isProcessing = derivedProcessingCount > 0 || derivedQueuedCount > 0
    const isForcedPolling = Date.now() < forcedPollingEndAtRef.current
    const shouldPoll = isProcessing || isForcedPolling

    // Quando o processamento termina, faz um fetch final para garantir o estado atualizado
    if (prevProcessingRef.current && !isProcessing && !isForcedPolling) {
      const timeout = setTimeout(() => void fetchSection({ silent: true }), 1500)
      prevProcessingRef.current = false
      return () => clearTimeout(timeout)
    }

    prevProcessingRef.current = isProcessing

    if (!shouldPoll) return

    const interval = setInterval(() => {
      void fetchSection({ silent: true })
    }, 4000)

    return () => clearInterval(interval)
  }, [fetchSection, derivedProcessingCount, derivedQueuedCount])

  useEffect(() => {
    setIsStatsExpanded(false)
    setIsStatsLoading(false)
    setStatsError('')
    setSectionStats(null)
  }, [sectionId])

  useEffect(() => {
    if (!isStatsExpanded) return
    void fetchSectionStats()
  }, [fetchSectionStats, isStatsExpanded])

  useEffect(() => {
    if (!section?.id) return
    if (sectionStats) return
    void fetchSectionStats()
  }, [fetchSectionStats, section?.id, sectionStats])

  useEffect(() => {
    let cancelled = false

    const connectRealtime = async () => {
      try {
        const authResponse = await fetch('/api/realtime/sections-auth', { cache: 'no-store' })
        const authPayload = (await authResponse.json().catch(() => ({}))) as SectionRealtimeAuthResponse

        if (cancelled) return

        if (authResponse.status === 401) {
          handleUnauthorized()
          return
        }

        if (!authResponse.ok) {
          setIsRealtimeStatusConnected(false)
          return
        }

        const socketBaseUrl = typeof authPayload.socket_url === 'string'
          ? authPayload.socket_url.trim()
          : ''
        const namespace = typeof authPayload.namespace === 'string'
          ? authPayload.namespace.trim()
          : '/sections-status'
        const token = typeof authPayload.token === 'string'
          ? authPayload.token.trim()
          : ''

        if (!socketBaseUrl || !token) {
          setIsRealtimeStatusConnected(false)
          return
        }

        const socket = io(`${socketBaseUrl}${namespace}`, {
          transports: ['websocket'],
          auth: { token },
          query: { token },
          withCredentials: true,
          reconnection: true,
        })

        sectionStatusSocketRef.current = socket

        socket.on('connect', () => {
          if (cancelled) return
          setIsRealtimeStatusConnected(true)
          socket.emit('section:subscribe', { sectionId })
        })

        socket.on('disconnect', () => {
          if (cancelled) return
          setIsRealtimeStatusConnected(false)
        })

        socket.on('connect_error', () => {
          if (cancelled) return
          setIsRealtimeStatusConnected(false)
        })

        socket.on('section:update', (payload: unknown) => {
          if (cancelled || !payload || typeof payload !== 'object') return

          const root = payload as { sectionId?: unknown; data?: unknown }
          const incomingSectionId = toFiniteNumber(root.sectionId)
          if (incomingSectionId !== null && incomingSectionId !== sectionId) return

          const detail = root.data as SectionDetail | undefined
          if (!detail || typeof detail !== 'object') return

          setSection(detail)
          setLastStatusSyncAt(Date.now())
          setIsPollingStatus(false)
        })
      } catch {
        if (cancelled) return
        setIsRealtimeStatusConnected(false)
      }
    }

    void connectRealtime()

    return () => {
      cancelled = true

      const socket = sectionStatusSocketRef.current
      if (!socket) return

      socket.emit('section:unsubscribe', { sectionId })
      socket.disconnect()
      sectionStatusSocketRef.current = null
    }
  }, [handleUnauthorized, sectionId])

  useEffect(() => {
    if (overlayStateSaveDebounceRef.current !== null) {
      clearTimeout(overlayStateSaveDebounceRef.current)
      overlayStateSaveDebounceRef.current = null
    }

    overlayStateLastSavedRef.current = ''
    setIsOverlayStateReady(false)
    setOcrOverlayByImageId({})
    setOcrOverlayManualItemsByImageId({})
    setOcrOverlayHiddenItemIdsByImageId({})
    setOcrOverlayLoadingByImageId({})
    setOcrOverlayTranslateQueue([])
    setOcrOverlayCreatingSelectionByImageId({})
    setOcrOverlayErrorByImageId({})
    setOcrOverlayColorsByImageId({})
    setOcrOverlayColorLoadingByImageId({})
    setOcrOverlayOverridesByImageId({})
    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
    setIsOverlaySelectionMode(false)
    setOverlaySelectionDraft(null)
    setOcrOverlayFontFamily(OCR_OVERLAY_DEFAULT_FONT_FAMILY)
    setSectionCategoryDraft('')
    setSectionCategoryOptions([])
    setSectionCategoryQuery('')
    setIsSectionCategoryPopoverOpen(false)
    setSectionCategoryPopoverWidth(null)
    setIsSectionCategoryLoading(false)
    setIsSectionCategorySaving(false)
    setIsDeleteCategoryDialogOpen(false)
    setCategoryToDelete('')
    setIsDeletingCategory(false)
    sectionCategoryLastSavedRef.current = ''
    sectionCategorySaveRequestRef.current = 0
    sectionCategorySkipCloseCommitRef.current = false
    ocrOverlayTranslateWorkerBusyRef.current = false
    setImageNaturalSizeById({})
    setOcrOverlayFontScale(OCR_OVERLAY_DEFAULT_FONT_SCALE)
    setOcrOverlayBoxInsetPercent(OCR_OVERLAY_DEFAULT_BOX_INSET)
    setOcrOverlayDensity(OCR_OVERLAY_DENSITY_DEFAULT)
    setOcrOverlayOpacity(OCR_OVERLAY_OPACITY_DEFAULT)
    setOcrOverlayGlobalShape(OCR_OVERLAY_DEFAULT_SHAPE)
    setSectionCategoryOverlayPreferences(null)
    readProgressLastSyncedDoneRef.current = null
    overlayStateLoadedFromServerRef.current = false
    overlayCategoryDefaultsAppliedRef.current = false
  }, [sectionId])

  useEffect(() => {
    let cancelled = false

    const loadOverlayState = async () => {
      const defaultSnapshot: OcrOverlayStateSnapshot = {
        fontFamily: OCR_OVERLAY_DEFAULT_FONT_FAMILY,
        fontScale: OCR_OVERLAY_DEFAULT_FONT_SCALE,
        boxInsetPercent: OCR_OVERLAY_DEFAULT_BOX_INSET,
        density: OCR_OVERLAY_DENSITY_DEFAULT,
        overlayOpacity: OCR_OVERLAY_OPACITY_DEFAULT,
        globalShape: OCR_OVERLAY_DEFAULT_SHAPE,
        overridesByImageId: {},
        manualItemsByImageId: {},
        hiddenItemIdsByImageId: {},
      }
      overlayStateLastSavedRef.current = JSON.stringify(buildOverlayStatePayload(defaultSnapshot))
      overlayStateLoadedFromServerRef.current = false

      try {
        const response = await fetch(`/api/sections/${sectionId}/ocr-overlay-state`, { cache: 'no-store' })
        const data = (await response.json()) as OcrOverlayStateResponse

        if (cancelled) return

        if (response.status === 401) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          return
        }

        const parsed = parseOverlayStateSnapshot(data.state)
        if (!parsed) return

        overlayStateLoadedFromServerRef.current = true
        setOcrOverlayFontFamily(parsed.fontFamily)
        setOcrOverlayFontScale(parsed.fontScale)
        setOcrOverlayBoxInsetPercent(parsed.boxInsetPercent)
        setOcrOverlayDensity(parsed.density)
        setOcrOverlayOpacity(parsed.overlayOpacity)
        setOcrOverlayGlobalShape(parsed.globalShape)
        setOcrOverlayOverridesByImageId(parsed.overridesByImageId)
        setOcrOverlayManualItemsByImageId(parsed.manualItemsByImageId)
        setOcrOverlayHiddenItemIdsByImageId(parsed.hiddenItemIdsByImageId)
        setSelectedOverlayTarget(null)
        setOverlayQuickEditorState(null)
        setOverlayDragEnabledTarget(null)
        overlayStateLastSavedRef.current = JSON.stringify(buildOverlayStatePayload(parsed))
      } catch {
      } finally {
        if (!cancelled) {
          setIsOverlayStateReady(true)
        }
      }
    }

    void loadOverlayState()

    return () => {
      cancelled = true
    }
  }, [handleUnauthorized, sectionId])

  useEffect(() => {
    const trigger = sectionCategoryTriggerRef.current
    if (!trigger) return

    const updateWidth = () => {
      const width = Math.round(trigger.getBoundingClientRect().width)
      if (width > 0) {
        setSectionCategoryPopoverWidth((prev) => (prev === width ? prev : width))
      }
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(trigger)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [section?.id, isSectionCategoryPopoverOpen])

  useEffect(() => {
    let cancelled = false

    const loadSectionCategory = async () => {
      setIsSectionCategoryLoading(true)
      try {
        const response = await fetch(`/api/sections/${sectionId}/category`, { cache: 'no-store' })
        const data = (await response.json()) as SectionCategoryResponse

        if (cancelled) return

        if (response.status === 401) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          setSectionCategoryDraft('')
          setSectionCategoryOptions([])
          sectionCategoryLastSavedRef.current = ''
          return
        }

        const nextCategory = normalizeSectionCategoryValue(data.category)
        const nextOptions = normalizeSectionCategoryOptions(data.categories)
        const nextCategoryPreferences = normalizeSectionCategoryOverlayPreferences(
          data.category_preferences
        )

        setSectionCategoryDraft(nextCategory)
        setSectionCategoryOptions(nextOptions)
        setSectionCategoryOverlayPreferences(nextCategoryPreferences)
        sectionCategoryLastSavedRef.current = nextCategory
      } catch {
        if (cancelled) return
        setSectionCategoryDraft('')
        setSectionCategoryOptions([])
        setSectionCategoryOverlayPreferences(null)
        sectionCategoryLastSavedRef.current = ''
      } finally {
        if (!cancelled) {
          setIsSectionCategoryLoading(false)
        }
      }
    }

    void loadSectionCategory()

    return () => {
      cancelled = true
    }
  }, [handleUnauthorized, sectionId])

  useEffect(() => {
    const fetchRoleAndPlan = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!response.ok) return

        const data = (await response.json()) as AuthMeLimitsResponse
        const mePayload = resolveAuthMePayload(data)
        const parsedRoleValue = toFiniteNumber(mePayload.role)
        const parsedRole = parsedRoleValue === null ? null : Math.floor(parsedRoleValue)
        setUserRole(parsedRole)
      } catch {
      }
    }
    void fetchRoleAndPlan()
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force
      if (force || !checkTourDone('tour-reader-v2')) {
        setIsTourOpen(true)
      }
    }
    window.addEventListener('open-page-tour', handler)
    return () => window.removeEventListener('open-page-tour', handler)
  }, [])

  useEffect(() => {
    if (!isOverlayStateReady) return
    if (!sectionCategoryOverlayPreferences) return
    if (overlayStateLoadedFromServerRef.current) return
    if (overlayCategoryDefaultsAppliedRef.current) return

    const categorySnapshot: OcrOverlayStateSnapshot = {
      fontFamily: sectionCategoryOverlayPreferences.font_family,
      fontScale: sectionCategoryOverlayPreferences.font_scale,
      boxInsetPercent: sectionCategoryOverlayPreferences.box_inset_percent,
      density: sectionCategoryOverlayPreferences.density,
      overlayOpacity: sectionCategoryOverlayPreferences.overlay_opacity,
      globalShape: sectionCategoryOverlayPreferences.global_shape,
      overridesByImageId: ocrOverlayOverridesByImageId,
      manualItemsByImageId: ocrOverlayManualItemsByImageId,
      hiddenItemIdsByImageId: ocrOverlayHiddenItemIdsByImageId,
    }

    setOcrOverlayFontFamily(categorySnapshot.fontFamily)
    setOcrOverlayFontScale(categorySnapshot.fontScale)
    setOcrOverlayBoxInsetPercent(categorySnapshot.boxInsetPercent)
    setOcrOverlayDensity(categorySnapshot.density)
    setOcrOverlayOpacity(categorySnapshot.overlayOpacity)
    setOcrOverlayGlobalShape(categorySnapshot.globalShape)
    overlayStateLastSavedRef.current = JSON.stringify(buildOverlayStatePayload(categorySnapshot))
    overlayCategoryDefaultsAppliedRef.current = true
  }, [
    isOverlayStateReady,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayManualItemsByImageId,
    ocrOverlayOverridesByImageId,
    sectionCategoryOverlayPreferences,
  ])

  useEffect(() => {
    const abortController = new AbortController()

    fetch(`/api/sections/${sectionId}/suggestions?limit=10`, {
      cache: 'no-store',
      signal: abortController.signal,
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        const root = (data && typeof data === 'object' ? data : null) as { data?: unknown } | null
        const list = Array.isArray(root?.data) ? (root.data as SectionListItem[]) : []
        setSuggestedSections(list)
      })
      .catch(() => {})

    return () => {
      abortController.abort()
    }
  }, [sectionId])

  useEffect(() => {
    if (readingMode) return
    setIsOverlaySelectionMode(false)
  }, [readingMode])

  const sectionImages = useMemo(() => {
    if (!section) return []
    return section.images.slice().sort((a, b) => a.order_index - b.order_index)
  }, [section])

  // Reset lazy-load counter and revealed images whenever a new section is opened
  useEffect(() => {
    setSectionGridVisibleCount(SECTION_GRID_INITIAL_PAGES)
    setRevealedScrollImageIds(new Set())
  }, [sectionId])

  // IntersectionObserver — revela src da imagem só quando entra na viewport
  useEffect(() => {
    scrollImageObserverRef.current = new IntersectionObserver(
      (entries) => {
        const newIds: number[] = []
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = Number((entry.target as HTMLElement).dataset.scrollImageId)
            if (id) newIds.push(id)
            scrollImageObserverRef.current?.unobserve(entry.target)
          }
        })
        if (newIds.length > 0) {
          setRevealedScrollImageIds((prev) => {
            const next = new Set(prev)
            newIds.forEach((id) => next.add(id))
            return next
          })
        }
      },
      { rootMargin: '300px 0px' }
    )
    return () => {
      scrollImageObserverRef.current?.disconnect()
    }
  }, [])

  const pageEndSuggestions = useMemo(
    () => suggestedSections.filter((item) => item.id !== sectionId).slice(0, 10),
    [sectionId, suggestedSections]
  )

  useEffect(() => {
    const serverName = section?.name ?? ''
    setSectionNameDraft((current) => {
      const lastSynced = sectionNameSyncedRef.current
      sectionNameSyncedRef.current = serverName

      if (!current || current === lastSynced) {
        return serverName
      }

      return current
    })
  }, [section?.name])

  useEffect(() => {
    if (!isEditingSectionName) return

    const focusTimer = window.setTimeout(() => {
      sectionNameInputRef.current?.focus()
      sectionNameInputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [isEditingSectionName])

  useEffect(() => {
    if (sectionImages.length === 0) {
      setCurrentReadingPage(0)
      return
    }

    if (currentReadingPage > sectionImages.length - 1) {
      setCurrentReadingPage(sectionImages.length - 1)
    }
  }, [currentReadingPage, sectionImages])

  useEffect(() => {
    if (readingViewMode !== 'paginated') return
    if (!selectedOverlayTarget) return
    const imageOnCurrentPage = sectionImages[currentReadingPage] ?? null
    if (!imageOnCurrentPage || selectedOverlayTarget.imageId !== imageOnCurrentPage.id) {
      setSelectedOverlayTarget(null)
      setOverlayQuickEditorState(null)
      setOverlayDragEnabledTarget(null)
    }
  }, [currentReadingPage, readingViewMode, sectionImages, selectedOverlayTarget])

  useEffect(() => {
    if (readingViewMode !== 'paginated') return
    if (!overlayQuickEditorState) return
    const imageOnCurrentPage = sectionImages[currentReadingPage] ?? null
    if (!imageOnCurrentPage || overlayQuickEditorState.imageId !== imageOnCurrentPage.id) {
      setOverlayQuickEditorState(null)
      setOverlayDragEnabledTarget(null)
    }
  }, [currentReadingPage, overlayQuickEditorState, readingViewMode, sectionImages])

  useEffect(() => {
    if (!overlayQuickEditorState) {
      setOverlayQuickEditorPlacement((prev) => (prev ? null : prev))
      return
    }

    setOverlayQuickEditorPlacement((prev) => {
      if (
        prev
        && prev.imageId === overlayQuickEditorState.imageId
        && prev.itemId === overlayQuickEditorState.itemId
      ) {
        return prev
      }

      const nextPlacement = resolveQuickEditorPlacement(overlayQuickEditorState)
      return {
        imageId: overlayQuickEditorState.imageId,
        itemId: overlayQuickEditorState.itemId,
        side: nextPlacement.side,
        align: nextPlacement.align,
      }
    })
  }, [overlayQuickEditorState])

  useEffect(() => {
    if (!isOverlayStateReady) return

    const snapshot: OcrOverlayStateSnapshot = {
      fontFamily: ocrOverlayFontFamily,
      fontScale: ocrOverlayFontScale,
      boxInsetPercent: ocrOverlayBoxInsetPercent,
      density: ocrOverlayDensity,
      overlayOpacity: ocrOverlayOpacity,
      globalShape: ocrOverlayGlobalShape,
      overridesByImageId: ocrOverlayOverridesByImageId,
      manualItemsByImageId: ocrOverlayManualItemsByImageId,
      hiddenItemIdsByImageId: ocrOverlayHiddenItemIdsByImageId,
    }
    const payload = buildOverlayStatePayload(snapshot)
    const serializedPayload = JSON.stringify(payload)

    if (serializedPayload === overlayStateLastSavedRef.current) {
      return
    }

    if (overlayStateSaveDebounceRef.current !== null) {
      clearTimeout(overlayStateSaveDebounceRef.current)
    }

    overlayStateSaveDebounceRef.current = setTimeout(() => {
      overlayStateSaveDebounceRef.current = null
      const serializedToPersist = serializedPayload

      void (async () => {
        try {
          const response = await fetch(`/api/sections/${sectionId}/ocr-overlay-state`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ state: payload }),
          })

          if (response.status === 401) {
            handleUnauthorized()
            return
          }

          if (!response.ok) {
            return
          }

          overlayStateLastSavedRef.current = serializedToPersist
        } catch {
        }
      })()
    }, 700)

    return () => {
      if (overlayStateSaveDebounceRef.current !== null) {
        clearTimeout(overlayStateSaveDebounceRef.current)
      }
    }
  }, [
    handleUnauthorized,
    isOverlayStateReady,
    ocrOverlayBoxInsetPercent,
    ocrOverlayDensity,
    ocrOverlayFontFamily,
    ocrOverlayFontScale,
    ocrOverlayGlobalShape,
    ocrOverlayOpacity,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayManualItemsByImageId,
    ocrOverlayOverridesByImageId,
    sectionId,
  ])

  useEffect(() => {
    return () => {
      if (overlayStateSaveDebounceRef.current !== null) {
        clearTimeout(overlayStateSaveDebounceRef.current)
      }
    }
  }, [])

  // Carrega páginas lidas do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${READ_PAGES_LS_PREFIX}${sectionId}`)
      if (stored) {
        const ids = JSON.parse(stored) as number[]
        setReadPages(new Set(ids))
      }
    } catch {
    }
  }, [sectionId])

  // Marca a página atual como lida ao navegar no modo leitura paginada.
  useEffect(() => {
    if (!readingMode || readingViewMode !== 'paginated' || sectionImages.length === 0) return
    const image = sectionImages[currentReadingPage]
    if (!image) return
    setReadPages((prev) => {
      if (prev.has(image.id)) return prev
      const next = new Set(prev)
      next.add(image.id)
      try {
        localStorage.setItem(`${READ_PAGES_LS_PREFIX}${sectionId}`, JSON.stringify([...next]))
      } catch {
      }
      return next
    })
  }, [currentReadingPage, readingMode, readingViewMode, sectionImages, sectionId])

  // No modo scroll contínuo, marca como lida quando a página fica visível na área de leitura.
  useEffect(() => {
    if (!readingMode || readingViewMode !== 'scroll' || sectionImages.length === 0) return
    if (typeof IntersectionObserver === 'undefined') return

    const zone = readingInteractionZoneRef.current
    if (!zone) return

    const pageNodes = Array.from(zone.querySelectorAll<HTMLElement>('[data-reader-page-id]'))
    if (pageNodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisibleIds: number[] = []

        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.12) continue
          const rawId = entry.target.getAttribute('data-reader-page-id')
          const imageId = rawId ? Number.parseInt(rawId, 10) : NaN
          if (!Number.isFinite(imageId)) continue
          newlyVisibleIds.push(imageId)
        }

        if (newlyVisibleIds.length === 0) return

        setReadPages((prev) => {
          let changed = false
          const next = new Set(prev)

          for (const imageId of newlyVisibleIds) {
            if (next.has(imageId)) continue
            next.add(imageId)
            changed = true
          }

          if (!changed) return prev

          try {
            localStorage.setItem(`${READ_PAGES_LS_PREFIX}${sectionId}`, JSON.stringify([...next]))
          } catch {
          }

          return next
        })
      },
      {
        root: zone,
        // Páginas muito altas raramente alcançam ratio alto dentro do viewport.
        // Com limiar menor, marcamos como lida ao entrar de forma consistente no campo de visão.
        threshold: [0.12, 0.2, 0.35],
      }
    )

    pageNodes.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [readingMode, readingViewMode, sectionImages, sectionId])

  // Marca a seção como lida quando >= 70% das páginas e sincroniza local + Redis + eventos da biblioteca.
  useEffect(() => {
    if (sectionImages.length === 0) return
    const ratio = readPages.size / sectionImages.length
    const isDone = ratio >= SECTION_READ_THRESHOLD

    try {
      if (isDone) {
        localStorage.setItem(`${SECTION_READ_LS_PREFIX}${sectionId}`, 'done')
      } else {
        localStorage.removeItem(`${SECTION_READ_LS_PREFIX}${sectionId}`)
      }
    } catch {
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('section-read-progress-updated', {
            detail: { sectionId, done: isDone },
          })
        )
      } catch {
      }
    }

    if (readProgressLastSyncedDoneRef.current === isDone) {
      return
    }

    readProgressLastSyncedDoneRef.current = isDone
    void fetch(`/api/sections/${sectionId}/read-progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: isDone }),
    }).catch(() => {
      // Permite nova tentativa em próximos ciclos.
      readProgressLastSyncedDoneRef.current = null
    })
  }, [readPages, sectionImages, sectionId])

  const currentPage = sectionImages[currentReadingPage] ?? null
  const readingTranslatedAvailable = currentPage ? isImageTranslated(currentPage) : false
  const readingDisplayUrl = currentPage
    ? (
      readingTranslatedAvailable
        ? buildImageViewUrl(section!.id, currentPage.id, 'translated')
        : buildImageViewUrl(section!.id, currentPage.id, 'original')
    )
    : ''
  const shouldUseCurrentPageOcrOverlay = Boolean(
    currentPage
      && !readingTranslatedAvailable
  )
  const ocrOverlayQueuedImageIds = useMemo(
    () => new Set(ocrOverlayTranslateQueue),
    [ocrOverlayTranslateQueue]
  )
  const currentPageOverlayItems = currentPage
    ? filterOverlayItemsByHiddenIds(
      mergeOverlayItems(
        mergeOverlayItems(
          toOverlaySeedItems(currentPage),
          ocrOverlayByImageId[currentPage.id] ?? []
        ),
        ocrOverlayManualItemsByImageId[currentPage.id] ?? []
      ),
      ocrOverlayHiddenItemIdsByImageId[currentPage.id] ?? []
    )
    : []
  const currentPageOverlayLoading = currentPage
    ? Boolean(
      ocrOverlayLoadingByImageId[currentPage.id]
      || ocrOverlayCreatingSelectionByImageId[currentPage.id]
      || ocrOverlayQueuedImageIds.has(currentPage.id)
    )
    : false
  const overlayFontFamilyCss = OCR_OVERLAY_FONT_FAMILIES[ocrOverlayFontFamily].css
  const overlayDensityLabel = `${Math.round(ocrOverlayDensity * 100)}%`
  const overlayOpacityLabel = `${Math.round(ocrOverlayOpacity * 100)}%`
  const overlayFontPercentLabel = toRelativePercent(ocrOverlayFontScale, OCR_OVERLAY_DEFAULT_FONT_SCALE)
  const overlayBoxInsetLabel = `${toRelativePercent(ocrOverlayBoxInsetPercent, OCR_OVERLAY_DEFAULT_BOX_INSET)}%`
  const overlaySelectionEnabled = isOverlaySelectionMode && !overlaySelectionDraft
  const currentPageOverlayOverrides = currentPage ? (ocrOverlayOverridesByImageId[currentPage.id] ?? {}) : {}
  const currentPageOverlayColors = currentPage ? (ocrOverlayColorsByImageId[currentPage.id] ?? {}) : {}
  const overlaySelectionDraftForCurrentPage = (
    overlaySelectionDraft
    && currentPage
    && overlaySelectionDraft.imageId === currentPage.id
  )
    ? overlaySelectionDraft
    : null
  const selectedOverlayOnCurrentPage = (
    selectedOverlayTarget && currentPage && selectedOverlayTarget.imageId === currentPage.id
  )
    ? selectedOverlayTarget
    : null
  const selectedOverlayOverrides = selectedOverlayTarget
    ? (ocrOverlayOverridesByImageId[selectedOverlayTarget.imageId] ?? {})
    : {}
  const selectedOverlayShape: OcrOverlayShape = selectedOverlayTarget
    ? (selectedOverlayOverrides[selectedOverlayTarget.itemId]?.shape ?? ocrOverlayGlobalShape)
    : ocrOverlayGlobalShape
  const selectedOverlayItemFontScale = selectedOverlayTarget
    ? clampRange(
      selectedOverlayOverrides[selectedOverlayTarget.itemId]?.fontScale ?? OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT,
      OCR_OVERLAY_ITEM_FONT_SCALE_MIN,
      OCR_OVERLAY_ITEM_FONT_SCALE_MAX
    )
    : OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT
  const selectedOverlayItemFontLabel = `${Math.round(selectedOverlayItemFontScale * 100)}%`
  const selectedOverlayItemSizeScale = selectedOverlayTarget
    ? clampRange(
      selectedOverlayOverrides[selectedOverlayTarget.itemId]?.sizeScale ?? OCR_OVERLAY_ITEM_SIZE_DEFAULT,
      OCR_OVERLAY_ITEM_SIZE_MIN,
      OCR_OVERLAY_ITEM_SIZE_MAX
    )
    : OCR_OVERLAY_ITEM_SIZE_DEFAULT
  const selectedOverlayItemSizeLabel = `${Math.round(selectedOverlayItemSizeScale * 100)}%`
  const selectedOverlayItemDensity = selectedOverlayTarget
    ? clampRange(
      selectedOverlayOverrides[selectedOverlayTarget.itemId]?.density ?? OCR_OVERLAY_ITEM_DENSITY_DEFAULT,
      OCR_OVERLAY_ITEM_DENSITY_MIN,
      OCR_OVERLAY_ITEM_DENSITY_MAX
    )
    : OCR_OVERLAY_ITEM_DENSITY_DEFAULT
  const selectedOverlayItemDensityLabel = `${Math.round(selectedOverlayItemDensity * 100)}%`
  const selectedOverlayDragEnabled = Boolean(
    selectedOverlayTarget
    && overlayDragEnabledTarget
    && selectedOverlayTarget.imageId === overlayDragEnabledTarget.imageId
    && selectedOverlayTarget.itemId === overlayDragEnabledTarget.itemId
  )
  const overlayQuickEditorForCurrentPage = (
    overlayQuickEditorState
    && currentPage
    && overlayQuickEditorState.imageId === currentPage.id
  )
    ? overlayQuickEditorState
    : null
  const quickEditorPlacementForCurrentPage = (
    overlayQuickEditorForCurrentPage
    && overlayQuickEditorPlacement
    && overlayQuickEditorPlacement.imageId === overlayQuickEditorForCurrentPage.imageId
    && overlayQuickEditorPlacement.itemId === overlayQuickEditorForCurrentPage.itemId
  )
    ? {
      side: overlayQuickEditorPlacement.side,
      align: overlayQuickEditorPlacement.align,
    }
    : resolveQuickEditorPlacement(overlayQuickEditorForCurrentPage)

  const resolveImageOverlayReferenceSize = useCallback((image: SectionImage | null): ImageNaturalSize | null => {
    if (!image) return null

    const measured = imageNaturalSizeById[image.id]
    if (measured && measured.width > 0 && measured.height > 0) {
      return measured
    }

    const rawWidth = toFiniteNumber(image.translated_width)
    const rawHeight = toFiniteNumber(image.translated_height)
    if (rawWidth !== null && rawHeight !== null && rawWidth > 0 && rawHeight > 0) {
      return { width: rawWidth, height: rawHeight }
    }

    return null
  }, [imageNaturalSizeById])

  const currentPageOverlayReferenceSize = resolveImageOverlayReferenceSize(currentPage)

  const queueState = useMemo(() => {
    if (!section) return null
    return getSectionQueueState(section, section)
  }, [section])
  const hasAnyFailedTranslation = useMemo(() => {
    return sectionImages.some((image) => {
      const translationStatus = normalizeStatus(image.translation_status)

      return (
        FAILED_TRANSLATION_STATUSES.has(translationStatus)
        || Boolean(image.translation_error)
      )
    })
  }, [sectionImages])
  const isRecentlyCreatedSection = useMemo(() => {
    if (!section?.created_at) return false
    const createdAtMs = new Date(section.created_at).getTime()
    if (!Number.isFinite(createdAtMs)) return false
    return Date.now() - createdAtMs <= 5 * 60 * 1000
  }, [section?.created_at])
  const isSectionLoadingImagesInBackground = Boolean(
    section
    && sectionImages.length === 0
    && (queueState?.inQueueOrProcessing || isRecentlyCreatedSection)
  )
  const shouldPollSectionStatus = Boolean(
    queueState?.inQueueOrProcessing
    || isSectionLoadingImagesInBackground
  )
  const canShowReprocessButton = Boolean(
    !isAutoProcessingEnabled
    && section
    && !queueState?.inQueueOrProcessing
    && hasAnyFailedTranslation
  )
  const canShowProcessButton = Boolean(
    !isAutoProcessingEnabled
    && section
    && queueState?.canQueue
  )
  const latestJobSnapshot = useMemo(() => {
    if (!section?.jobs || section.jobs.length === 0) return null

    return section.jobs.reduce((latest, current) => {
      if (!latest) return current
      const latestId = toFiniteNumber(latest.id)
      const currentId = toFiniteNumber(current.id)
      if (currentId !== null && (latestId === null || currentId > latestId)) {
        return current
      }
      return latest
    }, section.jobs[0] ?? null)
  }, [section?.jobs])
  const queueSnapshot = section?.queue ?? null
  const latestJobQueueSnapshot = latestJobSnapshot?.queue ?? null
  const hasLiveQueueSnapshot = queueSnapshot !== null
  const queueActiveJobId = hasLiveQueueSnapshot
    ? toFiniteNumber(queueSnapshot?.active_job_id)
    : toFiniteNumber(latestJobSnapshot?.id)
  const queueActiveJobStatus = hasLiveQueueSnapshot
    ? toStringValue(queueSnapshot?.active_job_status)
    : toStringValue(latestJobSnapshot?.status)
  const queuePosition = hasLiveQueueSnapshot
    ? toFiniteNumber(queueSnapshot?.queue_position)
    : toFiniteNumber(latestJobQueueSnapshot?.queue_position)
  const queueJobsAhead = hasLiveQueueSnapshot
    ? toFiniteNumber(queueSnapshot?.jobs_ahead)
    : firstDefined(toFiniteNumber(latestJobQueueSnapshot?.jobs_ahead), 0)
  const queueEstimatedWaitSeconds = hasLiveQueueSnapshot
    ? toFiniteNumber(queueSnapshot?.estimated_wait_seconds)
    : firstDefined(toFiniteNumber(latestJobQueueSnapshot?.estimated_wait_seconds), 0)
  const queueEstimatedWaitMinutes = hasLiveQueueSnapshot
    ? toFiniteNumber(queueSnapshot?.estimated_wait_minutes)
    : firstDefined(toFiniteNumber(latestJobQueueSnapshot?.estimated_wait_minutes), 0)
  const queueEstimatedStartRaw = hasLiveQueueSnapshot
    ? toStringValue(queueSnapshot?.estimated_start_at)
    : firstDefined(
      toStringValue(latestJobQueueSnapshot?.estimated_start_at),
      toStringValue(latestJobSnapshot?.estimated_start_at)
    )
  const queueAverageMsPerImage = firstDefined(
    toFiniteNumber(queueSnapshot?.avg_ms_per_image_reference),
    toFiniteNumber(latestJobQueueSnapshot?.avg_ms_per_image_reference),
    toFiniteNumber(latestJobSnapshot?.avg_ms_per_image_snapshot)
  )
  const queueAveragePerImageLabel = queueAverageMsPerImage !== null
    ? `${(queueAverageMsPerImage / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} s`
    : '—'
  const queueEstimatedStartLabel = queueEstimatedStartRaw
    ? formatSectionDate(queueEstimatedStartRaw)
    : '—'
  const queueActiveJobLabel = queueActiveJobId !== null ? String(queueActiveJobId) : 'Nenhum'
  const queueStatusLabel = queueActiveJobStatus
    ? formatStatus(queueActiveJobStatus)
    : 'Sem job ativo'
  const queuePositionLabel = queuePosition !== null
    ? `#${queuePosition}`
    : queueActiveJobId === null ? 'Fora da fila' : '—'
  const queueDataOriginLabel = hasLiveQueueSnapshot
    ? 'Fonte: fila em tempo real'
    : latestJobSnapshot
      ? 'Fonte: último job da seção'
      : 'Fonte: indisponível'
  const hasQueueImageCounters = derivedProcessingCount > 0 || derivedQueuedCount > 0
  const hasQueueRuntimeSignals = Boolean(
    hasQueueImageCounters
    || queueActiveJobId !== null
    || queuePosition !== null
    || (queueJobsAhead ?? 0) > 0
  )
  const shouldShowQueueInProgressBadge = Boolean(
    queueState?.inQueueOrProcessing
    && hasQueueRuntimeSignals
  )
  const publicAccessEnabled = Boolean(section?.public_access?.enabled)
  const publicAccessKey = section?.public_access?.key ?? null
  const publicReaderPath = publicAccessKey ? buildPublicReaderPath(publicAccessKey) : null
  const publicReaderUrl = useMemo(() => {
    if (!publicReaderPath) return ''
    return buildPublicReaderUrl(publicAccessKey!)
  }, [publicAccessKey, publicReaderPath])
  const trimmedSectionNameDraft = sectionNameDraft.trim()
  const hasPendingSectionNameChange = Boolean(
    section && trimmedSectionNameDraft.length > 0 && trimmedSectionNameDraft !== section.name
  )

  useEffect(() => {
    setCopiedShareLink(false)
  }, [publicReaderUrl])

  const handleSelectOverlayItem = useCallback((imageId: number, itemId: number) => {
    setSelectedOverlayTarget({ imageId, itemId })
    setOverlayQuickEditorState(null)
    setOverlayQuickEditorPlacement(null)
    setOverlayDragEnabledTarget(null)
  }, [])

  const handleClearOverlaySelection = useCallback(() => {
    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayQuickEditorPlacement(null)
    setOverlayDragEnabledTarget(null)
  }, [])

  const handleDeleteSelectedOverlayItem = useCallback(() => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayManualItemsByImageId((prev) => {
      const imageItems = prev[imageId] ?? []
      const nextImageItems = removeOverlayItem(imageItems, itemId)
      if (nextImageItems.length === imageItems.length) return prev

      const next = { ...prev }
      if (nextImageItems.length === 0) {
        delete next[imageId]
      } else {
        next[imageId] = nextImageItems
      }
      return next
    })

    setOcrOverlayByImageId((prev) => {
      const imageItems = prev[imageId] ?? []
      const nextImageItems = removeOverlayItem(imageItems, itemId)
      if (nextImageItems.length === imageItems.length) return prev

      const next = { ...prev }
      next[imageId] = nextImageItems
      return next
    })

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId]
      if (!imageOverrides || !Object.prototype.hasOwnProperty.call(imageOverrides, itemId)) return prev

      const nextImageOverrides = { ...imageOverrides }
      delete nextImageOverrides[itemId]

      const next = { ...prev }
      if (Object.keys(nextImageOverrides).length === 0) {
        delete next[imageId]
      } else {
        next[imageId] = nextImageOverrides
      }
      return next
    })

    setOcrOverlayColorsByImageId((prev) => {
      const imageColors = prev[imageId]
      if (!imageColors || !Object.prototype.hasOwnProperty.call(imageColors, itemId)) return prev

      const nextImageColors = { ...imageColors }
      delete nextImageColors[itemId]

      const next = { ...prev }
      if (Object.keys(nextImageColors).length === 0) {
        delete next[imageId]
      } else {
        next[imageId] = nextImageColors
      }
      return next
    })

    setOcrOverlayHiddenItemIdsByImageId((prev) => {
      const imageHiddenIds = prev[imageId] ?? []
      if (imageHiddenIds.includes(itemId)) return prev

      return {
        ...prev,
        [imageId]: [...imageHiddenIds, itemId].sort((a, b) => a - b),
      }
    })

    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
  }, [selectedOverlayTarget])

  useEffect(() => {
    if (!selectedOverlayTarget && !overlayQuickEditorState) return

    const selectedOverlayItemKey = selectedOverlayTarget
      ? `${selectedOverlayTarget.imageId}:${selectedOverlayTarget.itemId}`
      : null

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target) return
      if (target.closest('[data-ocr-overlay-quick-editor="true"]')) return
      if (selectedOverlayItemKey && target.closest(`[data-ocr-overlay-item-key="${selectedOverlayItemKey}"]`)) return
      handleClearOverlaySelection()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    }
  }, [handleClearOverlaySelection, overlayQuickEditorState, selectedOverlayTarget])

  const handleMoveOverlayItem = useCallback((imageId: number, itemId: number, dx: number, dy: number) => {
    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            dx,
            dy,
          },
        },
      }
    })
  }, [])

  const handleResizeOverlayItem = useCallback((
    imageId: number,
    itemId: number,
    payload: { dx: number; dy: number; widthScale: number; heightScale: number }
  ) => {
    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            dx: clampRange(payload.dx, -5000, 5000),
            dy: clampRange(payload.dy, -5000, 5000),
            widthScale: clampRange(payload.widthScale, OCR_OVERLAY_ITEM_AXIS_SCALE_MIN, OCR_OVERLAY_ITEM_AXIS_SCALE_MAX),
            heightScale: clampRange(payload.heightScale, OCR_OVERLAY_ITEM_AXIS_SCALE_MIN, OCR_OVERLAY_ITEM_AXIS_SCALE_MAX),
          },
        },
      }
    })
  }, [])

  const handleSetSelectedOverlayShape = useCallback((shape: OcrOverlayShape) => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            shape,
          },
        },
      }
    })
  }, [selectedOverlayTarget])

  const handleAdjustSelectedOverlayItemFont = useCallback((delta: number) => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      const currentScale = clampRange(
        imageOverrides[itemId]?.fontScale ?? OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT,
        OCR_OVERLAY_ITEM_FONT_SCALE_MIN,
        OCR_OVERLAY_ITEM_FONT_SCALE_MAX
      )
      const nextScale = clampRange(
        currentScale + delta,
        OCR_OVERLAY_ITEM_FONT_SCALE_MIN,
        OCR_OVERLAY_ITEM_FONT_SCALE_MAX
      )

      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            fontScale: nextScale,
          },
        },
      }
    })
  }, [selectedOverlayTarget])

  const handleResetSelectedOverlayItemAdjustments = useCallback(() => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            fontScale: OCR_OVERLAY_ITEM_FONT_SCALE_DEFAULT,
            sizeScale: OCR_OVERLAY_ITEM_SIZE_DEFAULT,
            widthScale: OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
            heightScale: OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
            density: OCR_OVERLAY_ITEM_DENSITY_DEFAULT,
          },
        },
      }
    })
  }, [selectedOverlayTarget])

  const handleAdjustSelectedOverlayItemSize = useCallback((delta: number) => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      const currentScale = clampRange(
        imageOverrides[itemId]?.sizeScale ?? OCR_OVERLAY_ITEM_SIZE_DEFAULT,
        OCR_OVERLAY_ITEM_SIZE_MIN,
        OCR_OVERLAY_ITEM_SIZE_MAX
      )
      const nextScale = clampRange(
        currentScale + delta,
        OCR_OVERLAY_ITEM_SIZE_MIN,
        OCR_OVERLAY_ITEM_SIZE_MAX
      )

      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            sizeScale: nextScale,
          },
        },
      }
    })
  }, [selectedOverlayTarget])

  const handleAdjustSelectedOverlayItemDensity = useCallback((delta: number) => {
    if (!selectedOverlayTarget) return
    const { imageId, itemId } = selectedOverlayTarget

    setOcrOverlayOverridesByImageId((prev) => {
      const imageOverrides = prev[imageId] ?? {}
      const currentDensity = clampRange(
        imageOverrides[itemId]?.density ?? OCR_OVERLAY_ITEM_DENSITY_DEFAULT,
        OCR_OVERLAY_ITEM_DENSITY_MIN,
        OCR_OVERLAY_ITEM_DENSITY_MAX
      )
      const nextDensity = clampRange(
        currentDensity + delta,
        OCR_OVERLAY_ITEM_DENSITY_MIN,
        OCR_OVERLAY_ITEM_DENSITY_MAX
      )

      return {
        ...prev,
        [imageId]: {
          ...imageOverrides,
          [itemId]: {
            ...imageOverrides[itemId],
            density: nextDensity,
          },
        },
      }
    })
  }, [selectedOverlayTarget])

  const handleToggleSelectedOverlayDrag = useCallback(() => {
    if (!selectedOverlayTarget) return

    setOverlayDragEnabledTarget((prev) => {
      if (
        prev
        && prev.imageId === selectedOverlayTarget.imageId
        && prev.itemId === selectedOverlayTarget.itemId
      ) {
        return null
      }

      return {
        imageId: selectedOverlayTarget.imageId,
        itemId: selectedOverlayTarget.itemId,
      }
    })
  }, [selectedOverlayTarget])

  const handleOpenOverlayQuickEditor = useCallback((payload: {
    imageId: number
    itemId: number
    leftPercent: number
    topPercent: number
  }) => {
    const nextPlacement = resolveQuickEditorPlacement(payload)
    setSelectedOverlayTarget({ imageId: payload.imageId, itemId: payload.itemId })
    setOverlayQuickEditorPlacement({
      imageId: payload.imageId,
      itemId: payload.itemId,
      side: nextPlacement.side,
      align: nextPlacement.align,
    })
    setOverlayDragEnabledTarget(null)
    setOverlayQuickEditorState(payload)
  }, [])

  const handleStartOverlayQuickEditorDrag = useCallback((
    imageId: number,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const startState = overlayQuickEditorState
    if (!startState || startState.imageId !== imageId) return

    const host = document.querySelector(`[data-ocr-overlay-host="${imageId}"]`) as HTMLElement | null
    if (!host) return
    const hostRect = host.getBoundingClientRect()
    if (hostRect.width <= 0 || hostRect.height <= 0) return

    event.preventDefault()
    event.stopPropagation()

    const pointerTarget = event.currentTarget
    try {
      pointerTarget.setPointerCapture(event.pointerId)
    } catch {
    }

    const pointerId = event.pointerId
    let lastClientX = event.clientX
    let lastClientY = event.clientY

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()

      const deltaXPercent = ((moveEvent.clientX - lastClientX) / hostRect.width) * 100
      const deltaYPercent = ((moveEvent.clientY - lastClientY) / hostRect.height) * 100

      setOverlayQuickEditorState((prev) => {
        if (!prev || prev.imageId !== imageId) return prev
        return {
          ...prev,
          leftPercent: clampPercent(prev.leftPercent + deltaXPercent),
          topPercent: clampPercent(prev.topPercent + deltaYPercent),
        }
      })

      lastClientX = moveEvent.clientX
      lastClientY = moveEvent.clientY
    }

    const clearListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', clearListeners)
      window.removeEventListener('pointercancel', clearListeners)
      try {
        pointerTarget.releasePointerCapture(pointerId)
      } catch {
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', clearListeners)
    window.addEventListener('pointercancel', clearListeners)
  }, [overlayQuickEditorState])

  const handleOverlaySelectionDraftReady = useCallback((payload: {
    imageId: number
    box: [number, number, number, number]
    leftPercent: number
    topPercent: number
  }) => {
    const image = sectionImages.find((entry) => entry.id === payload.imageId)
    const nextSourceLang = normalizeOverlaySelectionLanguage(
      image?.source_lang?.trim() || section?.source_lang || OCR_OVERLAY_SELECTION_SOURCE_DEFAULT,
      OCR_OVERLAY_SELECTION_SOURCE_DEFAULT,
      OCR_OVERLAY_SELECTION_LANGUAGES
    )
    const nextTargetLang = normalizeOverlaySelectionLanguage(
      image?.target_lang?.trim() || section?.target_lang || OCR_OVERLAY_SELECTION_TARGET_DEFAULT,
      OCR_OVERLAY_SELECTION_TARGET_DEFAULT,
      OCR_OVERLAY_SELECTION_TARGET_LANGUAGES
    )

    setOverlaySelectionSourceLang(nextSourceLang)
    setOverlaySelectionTargetLang(nextTargetLang)
    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
    setOverlaySelectionDraft(payload)
  }, [section?.source_lang, section?.target_lang, sectionImages])

  const handleOverlaySelectionDraftChange = useCallback((payload: {
    imageId: number
    box: [number, number, number, number]
    leftPercent: number
    topPercent: number
  }) => {
    setOverlaySelectionDraft((prev) => {
      if (!prev || prev.imageId !== payload.imageId) return prev
      return {
        ...prev,
        box: payload.box,
        leftPercent: payload.leftPercent,
        topPercent: payload.topPercent,
      }
    })
  }, [])

  const handleCreateOverlaySelectionBox = useCallback(async (
    payload: {
      imageId: number
      box: [number, number, number, number]
      sourceLang?: string
      targetLang?: string
    }
  ) => {
    if (!section) return

    const image = sectionImages.find((entry) => entry.id === payload.imageId)
    if (!image) return
    if (isImageTranslated(image)) return

    const referenceSize = resolveImageOverlayReferenceSize(image)
    if (!referenceSize) {
      toast.error('Não foi possível preparar a área para OCR.')
      return
    }

    const existingItemIds = [
      ...toOverlaySeedItems(image).map((item) => item.id),
      ...(ocrOverlayByImageId[image.id] ?? []).map((item) => item.id),
      ...(ocrOverlayManualItemsByImageId[image.id] ?? []).map((item) => item.id),
      ...(ocrOverlayHiddenItemIdsByImageId[image.id] ?? []),
    ]
    const nextManualItemId = existingItemIds.reduce(
      (maxValue, currentValue) => Math.max(maxValue, currentValue),
      0
    ) + 1

    const pendingItem: OcrOverlayItem = {
      id: nextManualItemId,
      box: payload.box,
      ocrText: 'OCR...',
      translatedText: 'OCR...',
    }

    setSelectedOverlayTarget({ imageId: image.id, itemId: nextManualItemId })
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
    setOcrOverlayHiddenItemIdsByImageId((prev) => {
      const imageHiddenIds = prev[image.id] ?? []
      if (!imageHiddenIds.includes(nextManualItemId)) return prev

      const nextImageHiddenIds = imageHiddenIds.filter((itemId) => itemId !== nextManualItemId)
      const next = { ...prev }
      if (nextImageHiddenIds.length === 0) {
        delete next[image.id]
      } else {
        next[image.id] = nextImageHiddenIds
      }
      return next
    })
    setOcrOverlayCreatingSelectionByImageId((prev) => ({ ...prev, [image.id]: true }))
    setOcrOverlayManualItemsByImageId((prev) => {
      const imageItems = prev[image.id] ?? []
      return {
        ...prev,
        [image.id]: upsertOverlayItem(imageItems, pendingItem),
      }
    })
    setOcrOverlayByImageId((prev) => {
      const hiddenIds = ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
      const imageItems = prev[image.id] ?? filterOverlayItemsByHiddenIds(toOverlaySeedItems(image), hiddenIds)
      return {
        ...prev,
        [image.id]: upsertOverlayItem(imageItems, pendingItem),
      }
    })

    try {
      const sourceImageUrl = buildImageViewUrl(section.id, image.id, 'original')
      const croppedBlob = await cropImageAreaToBlob(sourceImageUrl, referenceSize, payload.box)
      const ocrFile = new File(
        [croppedBlob],
        `section-${section.id}-image-${image.id}-overlay-${nextManualItemId}.png`,
        { type: 'image/png' }
      )

      const ocrFormData = new FormData()
      ocrFormData.append('file', ocrFile)

      const ocrQueueResponse = await fetch('/api/ocr-image/queue', {
        method: 'POST',
        body: ocrFormData,
      })
      const ocrQueueData = (await ocrQueueResponse.json()) as OcrImageQueueResponse

      if (ocrQueueResponse.status === 401) {
        handleUnauthorized()
        throw new Error('Sessão expirada. Faça login novamente.')
      }
      if (!ocrQueueResponse.ok) {
        throw new Error(toErrorMessage(ocrQueueData, 'Falha ao enfileirar OCR da área selecionada.'))
      }

      const queueRedisPayload = asObjectRecord(ocrQueueData.redis) ?? {}
      const jobKey = toStringValue(ocrQueueData.job_id)
        ?? toStringValue(queueRedisPayload.job_key)
        ?? toStringValue((ocrQueueData as Record<string, unknown>).job_key)
      const queueKey = toStringValue(queueRedisPayload.queue_key)
        ?? toStringValue((ocrQueueData as Record<string, unknown>).queue_key)
      if (!jobKey) {
        throw new Error('A fila OCR não retornou job_key para polling.')
      }

      const pollStartedAt = Date.now()
      let finalJobPayload: Record<string, unknown> | null = null
      while (Date.now() - pollStartedAt <= OCR_QUEUE_POLL_TIMEOUT_MS) {
        const params = new URLSearchParams()
        params.set('job_key', jobKey)
        if (queueKey) {
          params.set('queue_key', queueKey)
        }

        const pollResponse = await fetch(`/api/ocr-image/job?${params.toString()}`, {
          cache: 'no-store',
        })
        const pollData = (await pollResponse.json()) as OcrImageJobPollResponse

        if (pollResponse.status === 401) {
          handleUnauthorized()
          throw new Error('Sessão expirada. Faça login novamente.')
        }

        if (pollResponse.ok) {
          const normalizedStatus = normalizeStatus(toStringValue(pollData.status))
          const jobPayload = asObjectRecord(pollData.job)

          if (normalizedStatus === 'done') {
            finalJobPayload = jobPayload
            break
          }

          if (normalizedStatus === 'failed' || normalizedStatus === 'timeout') {
            const errorMessage = toStringValue(jobPayload?.error_message)
              || toStringValue(pollData.message)
              || 'Falha no processamento OCR da área selecionada.'
            throw new Error(errorMessage)
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, OCR_QUEUE_POLL_INTERVAL_MS))
      }

      if (!finalJobPayload) {
        throw new Error('Timeout aguardando OCR da área selecionada na fila.')
      }

      const extractedText = toStringValue(finalJobPayload.extracted_text) ?? ''
      const baseText = extractedText || '[sem texto detectado]'

      let translatedText = baseText
      const sourceLang = normalizeOverlaySelectionLanguage(
        payload.sourceLang ?? image.source_lang?.trim() ?? section.source_lang ?? OCR_OVERLAY_SELECTION_SOURCE_DEFAULT,
        OCR_OVERLAY_SELECTION_SOURCE_DEFAULT,
        OCR_OVERLAY_SELECTION_LANGUAGES
      )
      const targetLang = normalizeOverlaySelectionLanguage(
        payload.targetLang ?? image.target_lang?.trim() ?? section.target_lang ?? OCR_OVERLAY_SELECTION_TARGET_DEFAULT,
        OCR_OVERLAY_SELECTION_TARGET_DEFAULT,
        OCR_OVERLAY_SELECTION_TARGET_LANGUAGES
      )
      const providerLang = resolveOcrOverlayProvider(section.provider_lang)
      const translateEndpoint = '/api/translate/text-batch'

      const translateResponse = await fetch(translateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_lang: sourceLang,
          target_lang: targetLang,
          provider_lang: providerLang,
          texts: [baseText],
        }),
      })
      const translateData = (await translateResponse.json()) as OcrBatchTranslateResponse

      if (translateResponse.status === 401) {
        handleUnauthorized()
        throw new Error('Sessão expirada. Faça login novamente.')
      }
      if (!translateResponse.ok) {
        throw new Error(toErrorMessage(translateData, 'Falha ao traduzir o texto OCR da área selecionada.'))
      }

      const translatedItems = Array.isArray(translateData.translations)
        ? translateData.translations
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
        : []
      if (translatedItems[0]) {
        translatedText = translatedItems[0]
      }

      const finalizedItem: OcrOverlayItem = {
        id: nextManualItemId,
        box: payload.box,
        ocrText: baseText,
        translatedText,
      }

      setOcrOverlayManualItemsByImageId((prev) => {
        const imageItems = prev[image.id] ?? []
        return {
          ...prev,
          [image.id]: upsertOverlayItem(imageItems, finalizedItem),
        }
      })
      setOcrOverlayByImageId((prev) => {
        const hiddenIds = ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
        const imageItems = prev[image.id] ?? filterOverlayItemsByHiddenIds(toOverlaySeedItems(image), hiddenIds)
        return {
          ...prev,
          [image.id]: upsertOverlayItem(imageItems, finalizedItem),
        }
      })
      setOcrOverlayErrorByImageId((prev) => {
        if (!prev[image.id]) return prev
        const next = { ...prev }
        delete next[image.id]
        return next
      })
    } catch (err) {
      setOcrOverlayManualItemsByImageId((prev) => {
        const imageItems = prev[image.id] ?? []
        const nextImageItems = removeOverlayItem(imageItems, nextManualItemId)
        if (nextImageItems.length === imageItems.length) return prev

        const next = { ...prev }
        if (nextImageItems.length === 0) {
          delete next[image.id]
        } else {
          next[image.id] = nextImageItems
        }
        return next
      })

      setOcrOverlayByImageId((prev) => {
        const imageItems = prev[image.id] ?? []
        const nextImageItems = removeOverlayItem(imageItems, nextManualItemId)
        if (nextImageItems.length === imageItems.length) return prev

        const next = { ...prev }
        next[image.id] = nextImageItems
        return next
      })

      const message = err instanceof Error ? err.message : 'Falha ao criar balão manual.'
      setOcrOverlayErrorByImageId((prev) => ({
        ...prev,
        [image.id]: message,
      }))
      toast.error(message)
    } finally {
      setOcrOverlayCreatingSelectionByImageId((prev) => ({ ...prev, [image.id]: false }))
    }
  }, [
    handleUnauthorized,
    ocrOverlayByImageId,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayManualItemsByImageId,
    resolveImageOverlayReferenceSize,
    section,
    sectionImages,
  ])

  const handleConfirmOverlaySelectionDraft = useCallback(() => {
    if (!overlaySelectionDraft) {
      setIsOverlaySelectionMode(false)
      return
    }

    const payload = {
      imageId: overlaySelectionDraft.imageId,
      box: overlaySelectionDraft.box,
      sourceLang: overlaySelectionSourceLang,
      targetLang: overlaySelectionTargetLang,
    }

    setOverlaySelectionDraft(null)
    setIsOverlaySelectionMode(false)
    void handleCreateOverlaySelectionBox(payload)
  }, [
    handleCreateOverlaySelectionBox,
    overlaySelectionDraft,
    overlaySelectionSourceLang,
    overlaySelectionTargetLang,
  ])

  const handleDiscardOverlaySelectionDraft = useCallback(() => {
    setOverlaySelectionDraft(null)
    setIsOverlaySelectionMode(false)
  }, [])

  const canTranslateOverlayForImage = useCallback((image: SectionImage) => {
    if (isImageTranslated(image)) return false

    const hiddenIds = ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
    const baseItems = filterOverlayItemsByHiddenIds(
      mergeOverlayItems(
        mergeOverlayItems(
          toOverlaySeedItems(image),
          ocrOverlayByImageId[image.id] ?? []
        ),
        ocrOverlayManualItemsByImageId[image.id] ?? []
      ),
      hiddenIds
    )

    if (baseItems.length === 0) return false
    if (!baseItems.some((item) => !item.translatedText)) return false
    if (ocrOverlayLoadingByImageId[image.id]) return false

    return true
  }, [
    ocrOverlayByImageId,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayLoadingByImageId,
    ocrOverlayManualItemsByImageId,
  ])

  const requestOverlayTranslationForImage = useCallback((image: SectionImage) => {
    if (!canTranslateOverlayForImage(image)) return

    setOcrOverlayTranslateQueue((prev) => (
      prev.includes(image.id)
        ? prev
        : [...prev, image.id]
    ))
  }, [canTranslateOverlayForImage])

  const ensureOverlayColorsForImage = useCallback(async (
    imageId: number,
    imageUrl: string,
    items: OcrOverlayItem[],
    referenceSize: ImageNaturalSize
  ) => {
    if (!imageUrl || items.length === 0 || referenceSize.width <= 0 || referenceSize.height <= 0) return
    if (ocrOverlayColorLoadingByImageId[imageId]) return

    const existing = ocrOverlayColorsByImageId[imageId]
    if (existing && items.every((item) => existing[item.id])) return

    setOcrOverlayColorLoadingByImageId((prev) => ({ ...prev, [imageId]: true }))

    try {
      const imageElement = await loadImageForSampling(imageUrl)
      const canvas = document.createElement('canvas')
      canvas.width = imageElement.naturalWidth
      canvas.height = imageElement.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height)

      const scaleX = canvas.width / referenceSize.width
      const scaleY = canvas.height / referenceSize.height
      const imageOverrides = ocrOverlayOverridesByImageId[imageId] ?? {}
      const nextProfiles: Record<number, OcrOverlayItemColors> = {}

      for (const item of items) {
        const [rawX1, rawY1, rawX2, rawY2] = item.box
        const override = imageOverrides[item.id]
        const insetX = (rawX2 - rawX1) * (ocrOverlayBoxInsetPercent / 100)
        const insetY = (rawY2 - rawY1) * (ocrOverlayBoxInsetPercent / 100)
        let x1 = rawX1 + insetX + (override?.dx ?? 0)
        let y1 = rawY1 + insetY + (override?.dy ?? 0)
        let x2 = rawX2 - insetX + (override?.dx ?? 0)
        let y2 = rawY2 - insetY + (override?.dy ?? 0)

        x1 = clampRange(x1, 0, referenceSize.width)
        y1 = clampRange(y1, 0, referenceSize.height)
        x2 = clampRange(x2, 0, referenceSize.width)
        y2 = clampRange(y2, 0, referenceSize.height)
        if (x2 <= x1 || y2 <= y1) continue

        const itemSizeScale = clampRange(
          override?.sizeScale ?? OCR_OVERLAY_ITEM_SIZE_DEFAULT,
          OCR_OVERLAY_ITEM_SIZE_MIN,
          OCR_OVERLAY_ITEM_SIZE_MAX
        )
        const itemWidthScale = clampRange(
          override?.widthScale ?? OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
        )
        const itemHeightScale = clampRange(
          override?.heightScale ?? OCR_OVERLAY_ITEM_AXIS_SCALE_DEFAULT,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MIN,
          OCR_OVERLAY_ITEM_AXIS_SCALE_MAX
        )

        let boxW = x2 - x1
        let boxH = y2 - y1
        const centerX = x1 + boxW / 2
        const centerY = y1 + boxH / 2

        boxW = boxW * itemSizeScale * itemWidthScale
        boxH = boxH * itemSizeScale * itemHeightScale
        x1 = centerX - boxW / 2
        y1 = centerY - boxH / 2
        x2 = centerX + boxW / 2
        y2 = centerY + boxH / 2

        if (x1 < 0) {
          const shift = -x1
          x1 += shift
          x2 += shift
        }
        if (x2 > referenceSize.width) {
          const shift = x2 - referenceSize.width
          x1 -= shift
          x2 -= shift
        }
        if (y1 < 0) {
          const shift = -y1
          y1 += shift
          y2 += shift
        }
        if (y2 > referenceSize.height) {
          const shift = y2 - referenceSize.height
          y1 -= shift
          y2 -= shift
        }

        x1 = clampRange(x1, 0, referenceSize.width)
        y1 = clampRange(y1, 0, referenceSize.height)
        x2 = clampRange(x2, 0, referenceSize.width)
        y2 = clampRange(y2, 0, referenceSize.height)
        if (x2 <= x1 || y2 <= y1) continue

        boxW = x2 - x1
        boxH = y2 - y1
        const innerX = x1 + boxW * 0.18
        const innerY = y1 + boxH * 0.18
        const innerW = Math.max(1, boxW * 0.64)
        const innerH = Math.max(1, boxH * 0.64)

        const sampled = sampleAverageColor(
          context,
          innerX * scaleX,
          innerY * scaleY,
          innerW * scaleX,
          innerH * scaleY
        )

        nextProfiles[item.id] = toOverlayColorProfile(sampled.red, sampled.green, sampled.blue)
      }

      setOcrOverlayColorsByImageId((prev) => ({
        ...prev,
        [imageId]: {
          ...(prev[imageId] ?? {}),
          ...nextProfiles,
        },
      }))
    } catch {
    } finally {
      setOcrOverlayColorLoadingByImageId((prev) => ({ ...prev, [imageId]: false }))
    }
  }, [
    ocrOverlayBoxInsetPercent,
    ocrOverlayColorLoadingByImageId,
    ocrOverlayColorsByImageId,
    ocrOverlayOverridesByImageId,
  ])

  const translateOcrBatchForImage = useCallback(async (image: SectionImage) => {
    const seedItems = toOverlaySeedItems(image)
    const currentItems = ocrOverlayByImageId[image.id] ?? []
    const manualItems = ocrOverlayManualItemsByImageId[image.id] ?? []
    const hiddenIds = ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
    const baseItems = filterOverlayItemsByHiddenIds(
      mergeOverlayItems(
        mergeOverlayItems(seedItems, currentItems),
        manualItems
      ),
      hiddenIds
    )

    if (baseItems.length === 0) {
      setOcrOverlayByImageId((prev) => (
        Object.prototype.hasOwnProperty.call(prev, image.id)
          ? prev
          : { ...prev, [image.id]: [] }
      ))
      return
    }

    const sourceLang = image.source_lang?.trim() || section?.source_lang || 'auto'
    const targetLang = image.target_lang?.trim() || section?.target_lang || 'pt-BR'
    const providerLang = resolveOcrOverlayProvider(section?.provider_lang)
    const translateEndpoint = '/api/translate/text-batch'
    const pendingItems = baseItems.filter((item) => !item.translatedText)

    if (pendingItems.length === 0) {
      setOcrOverlayByImageId((prev) => ({ ...prev, [image.id]: baseItems }))
      setOcrOverlayErrorByImageId((prev) => {
        if (!prev[image.id]) return prev
        const next = { ...prev }
        delete next[image.id]
        return next
      })
      return
    }

    setOcrOverlayLoadingByImageId((prev) => ({ ...prev, [image.id]: true }))
    setOcrOverlayErrorByImageId((prev) => {
      if (!prev[image.id]) return prev
      const next = { ...prev }
      delete next[image.id]
      return next
    })

    try {
      const response = await fetch(translateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_lang: sourceLang,
          target_lang: targetLang,
          provider_lang: providerLang,
          texts: pendingItems.map((item) => item.ocrText),
        }),
      })
      const data = (await response.json()) as OcrBatchTranslateResponse

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível traduzir os textos OCR em lote.'))
      }

      const translatedItems = Array.isArray(data.translations)
        ? data.translations.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        : []

      let translatedCursor = 0
      const mergedItems = baseItems.map((item) => {
        if (item.translatedText) return item
        const translatedText = translatedItems[translatedCursor] || item.ocrText
        translatedCursor += 1
        return {
          ...item,
          translatedText,
        }
      })

      setOcrOverlayByImageId((prev) => ({ ...prev, [image.id]: mergedItems }))
      setOcrOverlayManualItemsByImageId((prev) => {
        const imageManualItems = prev[image.id]
        if (!imageManualItems || imageManualItems.length === 0) return prev

        const nextImageManualItems = imageManualItems.map((manualItem) => {
          const mergedItem = mergedItems.find((item) => item.id === manualItem.id)
          return mergedItem ?? manualItem
        })

        return {
          ...prev,
          [image.id]: nextImageManualItems,
        }
      })
    } catch (err) {
      const fallbackItems = baseItems.map((item) => ({
        ...item,
        translatedText: item.translatedText || item.ocrText,
      }))

      setOcrOverlayByImageId((prev) => ({ ...prev, [image.id]: fallbackItems }))
      setOcrOverlayManualItemsByImageId((prev) => {
        const imageManualItems = prev[image.id]
        if (!imageManualItems || imageManualItems.length === 0) return prev

        const nextImageManualItems = imageManualItems.map((manualItem) => {
          const fallbackItem = fallbackItems.find((item) => item.id === manualItem.id)
          return fallbackItem ?? manualItem
        })

        return {
          ...prev,
          [image.id]: nextImageManualItems,
        }
      })
      setOcrOverlayErrorByImageId((prev) => ({
        ...prev,
        [image.id]: err instanceof Error ? err.message : 'Falha ao traduzir OCR.',
      }))
    } finally {
      setOcrOverlayLoadingByImageId((prev) => ({ ...prev, [image.id]: false }))
    }
  }, [
    ocrOverlayByImageId,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayManualItemsByImageId,
    section?.provider_lang,
    section?.source_lang,
    section?.target_lang,
  ])

  useEffect(() => {
    if (!readingMode || !currentPage) return
    if (!shouldUseCurrentPageOcrOverlay) return

    requestOverlayTranslationForImage(currentPage)
  }, [
    currentPage,
    readingMode,
    requestOverlayTranslationForImage,
    shouldUseCurrentPageOcrOverlay,
  ])

  useEffect(() => {
    if (ocrOverlayTranslateWorkerBusyRef.current) return
    if (ocrOverlayTranslateQueue.length === 0) return

    const nextImageId = ocrOverlayTranslateQueue[0]
    setOcrOverlayTranslateQueue((prev) => prev.slice(1))

    const nextImage = sectionImages.find((image) => image.id === nextImageId)
    if (!nextImage) return
    if (!canTranslateOverlayForImage(nextImage)) return

    ocrOverlayTranslateWorkerBusyRef.current = true
    void (async () => {
      try {
        await translateOcrBatchForImage(nextImage)
      } finally {
        ocrOverlayTranslateWorkerBusyRef.current = false
      }
    })()
  }, [
    canTranslateOverlayForImage,
    ocrOverlayTranslateQueue,
    sectionImages,
    translateOcrBatchForImage,
  ])

  useEffect(() => {
    if (!readingMode || !currentPage || !shouldUseCurrentPageOcrOverlay) return
    if (currentPageOverlayItems.length === 0 || !currentPageOverlayReferenceSize) return

    void ensureOverlayColorsForImage(
      currentPage.id,
      readingDisplayUrl,
      currentPageOverlayItems,
      currentPageOverlayReferenceSize
    )
  }, [
    currentPage,
    currentPageOverlayItems,
    currentPageOverlayReferenceSize,
    ensureOverlayColorsForImage,
    readingDisplayUrl,
    readingMode,
    shouldUseCurrentPageOcrOverlay,
  ])

  useEffect(() => {
    if (!section) return

    sectionImages.forEach((image) => {
      if (isImageTranslated(image)) return
      if (!isImageOcrReady(image)) return
      const items = filterOverlayItemsByHiddenIds(
        mergeOverlayItems(
          mergeOverlayItems(
            toOverlaySeedItems(image),
            ocrOverlayByImageId[image.id] ?? []
          ),
          ocrOverlayManualItemsByImageId[image.id] ?? []
        ),
        ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
      )
      if (items.length === 0) return

      const referenceSize = resolveImageOverlayReferenceSize(image)
      if (!referenceSize) return

      const sourceUrl = buildImageViewUrl(section.id, image.id, 'original')
      void ensureOverlayColorsForImage(
        image.id,
        sourceUrl,
        items,
        referenceSize
      )
    })
  }, [
    ensureOverlayColorsForImage,
    ocrOverlayByImageId,
    ocrOverlayHiddenItemIdsByImageId,
    ocrOverlayManualItemsByImageId,
    resolveImageOverlayReferenceSize,
    section,
    sectionImages,
  ])

  useEffect(() => {
    if (!readingMode || !readingDisplayUrl) {
      setIsReadingImageLoading(false)
      return
    }

    setIsReadingImageLoading(!loadedImageUrls[readingDisplayUrl])
  }, [loadedImageUrls, readingDisplayUrl, readingMode])

  useEffect(() => {
    if (!readingMode || !section || sectionImages.length === 0) return

    const adjacentIndexes: number[] = []
    for (let offset = 1; offset <= READING_PRELOAD_RADIUS; offset++) {
      adjacentIndexes.push(currentReadingPage - offset, currentReadingPage + offset)
    }

    adjacentIndexes.forEach((pageIndex) => {
      const adjacentImage = sectionImages[pageIndex]
      if (!adjacentImage) return

      const adjacentUrl = isImageTranslated(adjacentImage)
        ? buildImageViewUrl(section.id, adjacentImage.id, 'translated')
        : buildImageViewUrl(section.id, adjacentImage.id, 'original')

      if (loadedImageUrls[adjacentUrl]) return

      const preloadImage = new Image()
      preloadImage.src = adjacentUrl
      preloadImage.onload = () => markImageAsLoaded(adjacentUrl)
      preloadImage.onerror = () => markImageAsLoaded(adjacentUrl)
    })
  }, [
    currentReadingPage,
    loadedImageUrls,
    markImageAsLoaded,
    readingMode,
    section,
    sectionImages,
  ])

  useEffect(() => {
    autoQueueAttemptedRef.current = false
    autoReprocessAttemptedRef.current = false
    autoReprocessAcceptedRef.current = false
  }, [sectionId])

  const handleQueueSection = useCallback(async (options?: QueueActionOptions): Promise<boolean> => {
    if (!section) return false

    setError('')
    if (!options?.silent) {
      setSuccess('')
    }
    setQueueActionLoading('queue')

    try {
      const response = await fetch(`/api/sections/${section.id}/queue?v2=true`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (response.status === 401) {
        handleUnauthorized()
        return false
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível processar a seção.'))
      }

      if (!options?.silent) {
        setSuccess(toErrorMessage(data, 'Seção enviada para processamento com sucesso.'))
      }
      triggerForcedPolling()
      await fetchSection({ silent: true })
      return true
    } catch (err) {
      const fallbackMessage = options?.automatic
        ? 'Erro ao iniciar processamento automático da seção.'
        : 'Erro ao processar seção.'
      setError(err instanceof Error ? err.message : fallbackMessage)
      return false
    } finally {
      setQueueActionLoading(null)
    }
  }, [fetchSection, handleUnauthorized, section, triggerForcedPolling])

  const handleReprocessSection = useCallback(async (options?: QueueActionOptions): Promise<boolean> => {
    if (!section) return false

    setError('')
    if (!options?.silent) {
      setSuccess('')
    }
    setQueueActionLoading('reprocess')

    const providerLang = resolveOcrOverlayProvider(section.provider_lang)

    try {
      const response = await fetch(
        `/api/sections/${section.id}/reprocess?v2=true&provider_lang=${encodeURIComponent(providerLang)}`,
        { method: 'POST' }
      )
      const data = await response.json().catch(() => ({}))

      if (response.status === 401) {
        handleUnauthorized()
        return false
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível reprocessar a seção.'))
      }

      if (!options?.silent) {
        setSuccess(toErrorMessage(data, 'Reprocessamento iniciado com sucesso.'))
      }
      triggerForcedPolling()
      await fetchSection({ silent: true })
      return true
    } catch (err) {
      const fallbackMessage = options?.automatic
        ? 'Erro ao iniciar reprocessamento automático da seção.'
        : 'Erro ao reprocessar seção.'
      setError(err instanceof Error ? err.message : fallbackMessage)
      return false
    } finally {
      setQueueActionLoading(null)
    }
  }, [fetchSection, handleUnauthorized, section, triggerForcedPolling])

  useEffect(() => {
    if (!isAutoProcessingEnabled) return
    if (!section || isLoadingSection) return
    if (queueActionLoading !== null) return
    if (queueState?.inQueueOrProcessing) return

    if (hasAnyFailedTranslation) {
      if (!autoReprocessAttemptedRef.current) {
        autoReprocessAttemptedRef.current = true
        void (async () => {
          const ok = await handleReprocessSection({ silent: true, automatic: true })
          if (ok) {
            autoReprocessAcceptedRef.current = true
            return
          }
        })()
        return
      }
      return
    }

    if (queueState?.canQueue && !autoQueueAttemptedRef.current) {
      autoQueueAttemptedRef.current = true
      void handleQueueSection({ silent: true, automatic: true })
    }
  }, [
    handleQueueSection,
    handleReprocessSection,
    hasAnyFailedTranslation,
    isLoadingSection,
    queueActionLoading,
    queueState?.canQueue,
    queueState?.inQueueOrProcessing,
    isAutoProcessingEnabled,
    section,
  ])

  const handleUpdatePublicAccess = async (enabled: boolean, regenerateKey = false) => {
    if (!section) return

    setError('')
    setSuccess('')
    setIsUpdatingPublicAccess(true)
    setCopiedShareLink(false)

    try {
      const response = await fetch(`/api/sections/${section.id}/public-access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          regenerate_key: regenerateKey,
        }),
      })
      const data = (await response.json()) as SectionPublicAccessResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível atualizar o acesso público da seção.'))
      }

      if (data.public_access) {
        setSection((prev) => (
          prev
            ? {
              ...prev,
              public_access: data.public_access,
            }
            : prev
        ))
      }

      setSuccess(
        enabled
          ? (regenerateKey ? 'Link público regenerado com sucesso.' : 'Acesso público habilitado com sucesso.')
          : 'Acesso público revogado com sucesso.'
      )

      await fetchSection({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar acesso público.')
    } finally {
      setIsUpdatingPublicAccess(false)
    }
  }

  const handleCopyPublicLink = async () => {
    if (!publicReaderUrl) return

    try {
      await navigator.clipboard.writeText(publicReaderUrl)
      setCopiedShareLink(true)
      setSuccess('Link público copiado.')
    } catch {
      setError('Não foi possível copiar o link público.')
    }
  }

  const handleDeleteSection = async () => {
    if (!section) return

    setError('')
    setSuccess('')
    setIsDeletingSection(true)

    try {
      const response = await fetch(`/api/sections/${section.id}`, {
        method: 'DELETE',
      })
      const data = (await response.json()) as DeleteSectionResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível remover a seção.'))
      }

      setIsDeleteDialogOpen(false)
      router.replace(backToLibraryHref)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover seção.')
    } finally {
      setIsDeletingSection(false)
    }
  }

  const handleStartSectionNameEdit = () => {
    if (!section) return
    setSectionNameDraft(section.name)
    sectionNameSyncedRef.current = section.name
    setIsEditingSectionName(true)
    setError('')
    setSuccess('')
  }

  const handleCancelSectionNameEdit = () => {
    if (section) {
      setSectionNameDraft(section.name)
      sectionNameSyncedRef.current = section.name
    }
    setIsEditingSectionName(false)
  }

  const handlePersistSectionCategory = useCallback(async (rawValue?: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(rawValue ?? sectionCategoryDraft)
    setSectionCategoryDraft(normalizedCategory)

    if (normalizedCategory === sectionCategoryLastSavedRef.current) return true

    setIsSectionCategorySaving(true)
    const requestId = sectionCategorySaveRequestRef.current + 1
    sectionCategorySaveRequestRef.current = requestId

    try {
      const response = await fetch(`/api/sections/${sectionId}/category`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: normalizedCategory || null,
        }),
      })
      const data = (await response.json()) as SectionCategoryResponse

      if (response.status === 401) {
        handleUnauthorized()
        return false
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível salvar a categoria.'))
      }

      if (requestId !== sectionCategorySaveRequestRef.current) return false

      const nextCategory = normalizeSectionCategoryValue(data.category)
      const nextOptions = normalizeSectionCategoryOptions(data.categories)
      const nextCategoryPreferences = normalizeSectionCategoryOverlayPreferences(
        data.category_preferences
      )
      setSectionCategoryDraft(nextCategory)
      setSectionCategoryOptions(nextOptions)
      setSectionCategoryOverlayPreferences(nextCategoryPreferences)
      setSectionCategoryQuery('')
      sectionCategoryLastSavedRef.current = nextCategory

      toast.success(data.message || 'Categoria salva com sucesso.')
      return true
    } catch (err) {
      if (requestId !== sectionCategorySaveRequestRef.current) return false
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar categoria.')
      return false
    } finally {
      if (requestId === sectionCategorySaveRequestRef.current) {
        setIsSectionCategorySaving(false)
      }
    }
  }, [handleUnauthorized, sectionCategoryDraft, sectionId])

  const filteredSectionCategoryOptions = useMemo(() => {
    const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
    if (!normalizedQuery) return sectionCategoryOptions

    const queryKey = toSectionCategoryKey(normalizedQuery)
    return sectionCategoryOptions.filter((category) => {
      return toSectionCategoryKey(category).includes(queryKey)
    })
  }, [sectionCategoryOptions, sectionCategoryQuery])

  const canCreateSectionCategoryFromQuery = useMemo(() => {
    const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
    if (!normalizedQuery) return false

    const queryKey = toSectionCategoryKey(normalizedQuery)
    return !sectionCategoryOptions.some((category) => toSectionCategoryKey(category) === queryKey)
  }, [sectionCategoryOptions, sectionCategoryQuery])

  const handleSelectSectionCategory = useCallback((category: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(category)
    sectionCategorySkipCloseCommitRef.current = true
    setSectionCategoryQuery('')
    setIsSectionCategoryPopoverOpen(false)
    void handlePersistSectionCategory(normalizedCategory)
  }, [handlePersistSectionCategory])

  const handleOpenDeleteCategoryDialog = useCallback((category: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(category)
    if (!normalizedCategory) return

    sectionCategorySkipCloseCommitRef.current = true
    setSectionCategoryQuery('')
    setIsSectionCategoryPopoverOpen(false)
    setCategoryToDelete(normalizedCategory)
    setIsDeleteCategoryDialogOpen(true)
  }, [])

  const handleDeleteCategory = useCallback(async () => {
    const normalizedCategory = normalizeSectionCategoryValue(categoryToDelete)
    if (!normalizedCategory) {
      setIsDeleteCategoryDialogOpen(false)
      return
    }

    setIsDeletingCategory(true)
    try {
      const response = await fetch(`/api/sections/${sectionId}/category`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: normalizedCategory }),
      })
      const data = (await response.json()) as SectionCategoryResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível excluir a categoria.'))
      }

      const nextCategory = normalizeSectionCategoryValue(data.category)
      const nextOptions = normalizeSectionCategoryOptions(data.categories)
      setSectionCategoryDraft(nextCategory)
      setSectionCategoryOptions(nextOptions)
      setSectionCategoryQuery('')
      sectionCategoryLastSavedRef.current = nextCategory
      setIsDeleteCategoryDialogOpen(false)
      setCategoryToDelete('')

      const deletedCountRaw = toFiniteNumber(data.deleted_sections_count)
      const deletedCount = deletedCountRaw === null ? 0 : Math.max(0, Math.floor(deletedCountRaw))
      toast.success(
        data.message
        || (deletedCount > 0
          ? `Categoria removida. ${deletedCount} seção(ões) ficaram sem categoria.`
          : 'Categoria removida com sucesso.')
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir categoria.')
    } finally {
      setIsDeletingCategory(false)
    }
  }, [categoryToDelete, handleUnauthorized, sectionId])

  const handleSectionCategoryPopoverChange = useCallback((open: boolean) => {
    if (!open) {
      if (sectionCategorySkipCloseCommitRef.current) {
        sectionCategorySkipCloseCommitRef.current = false
      } else {
        const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
        if (normalizedQuery) {
          void handlePersistSectionCategory(normalizedQuery)
        }
      }
      setSectionCategoryQuery('')
    } else {
      setSectionCategoryQuery(sectionCategoryDraft)
    }

    setIsSectionCategoryPopoverOpen(open)
  }, [handlePersistSectionCategory, sectionCategoryDraft, sectionCategoryQuery])

  const handleRenameSection = async () => {
    if (!section) return

    const trimmedName = sectionNameDraft.trim()
    if (!trimmedName) {
      setError('Informe o nome da seção.')
      return
    }

    if (trimmedName === section.name) {
      setIsEditingSectionName(false)
      return
    }

    setError('')
    setSuccess('')
    setIsRenamingSection(true)

    try {
      const response = await fetch(`/api/sections/${section.id}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      })
      const data = (await response.json()) as RenameSectionResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível atualizar o nome da seção.'))
      }

      setSection((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          name: data.name ?? trimmedName,
          status: data.status ?? prev.status,
          updated_at: data.updated_at ?? prev.updated_at,
        }
      })
      setSectionNameDraft(data.name ?? trimmedName)
      setSuccess(data.message || 'Nome da seção atualizado com sucesso.')
      setIsEditingSectionName(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar nome da seção.')
    } finally {
      setIsRenamingSection(false)
    }
  }

  const openReadingPage = (pageIndex: number) => {
    const categoryDefaultReadingMode = sectionCategoryOverlayPreferences?.default_reading_mode
    if (categoryDefaultReadingMode === 'paginated' || categoryDefaultReadingMode === 'scroll') {
      setReadingViewMode(categoryDefaultReadingMode)
    }
    setCurrentReadingPage(pageIndex)
    setZoom(100)
    setIsOverlaySelectionMode(false)
    setOverlaySelectionDraft(null)
    setIsOverlayFontPopoverOpen(false)
    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
    setReadingMode(true)
  }

  const closeReadingMode = () => {
    setIsOverlayFontPopoverOpen(false)
    setIsOverlaySelectionMode(false)
    setOverlaySelectionDraft(null)
    setSelectedOverlayTarget(null)
    setOverlayQuickEditorState(null)
    setOverlayDragEnabledTarget(null)
    setReadingMode(false)
  }

  const goToPreviousPage = () => {
    setCurrentReadingPage((prev) => Math.max(0, prev - 1))
  }

  const goToNextPage = () => {
    setCurrentReadingPage((prev) => Math.min(sectionImages.length - 1, prev + 1))
  }

  const handleReadingTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isOverlaySelectionMode) {
      readingTouchStartRef.current = null
      readingSwipeLockedRef.current = true
      return
    }

    const touchTarget = event.target instanceof HTMLElement ? event.target : null
    if (touchTarget?.closest('[data-ocr-overlay-interactive="true"]')) {
      readingTouchStartRef.current = null
      readingSwipeLockedRef.current = true
      return
    }

    if (event.touches.length !== 1) {
      readingTouchStartRef.current = null
      readingSwipeLockedRef.current = true
      return
    }

    const touch = event.touches[0]
    readingTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
    readingSwipeLockedRef.current = false
  }

  const handleReadingTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = readingTouchStartRef.current
    if (!start || readingSwipeLockedRef.current) return
    if (event.touches.length !== 1) {
      readingSwipeLockedRef.current = true
      return
    }

    const touch = event.touches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      readingSwipeLockedRef.current = true
    }
  }

  const handleReadingTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = readingTouchStartRef.current
    const swipeLocked = readingSwipeLockedRef.current

    readingTouchStartRef.current = null
    readingSwipeLockedRef.current = false

    if (!start || swipeLocked || event.changedTouches.length === 0) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    if (absDeltaX < SWIPE_TRIGGER_PX) return
    if (absDeltaX < absDeltaY * SWIPE_DIRECTION_RATIO) return

    if (deltaX < 0) {
      goToNextPage()
      return
    }

    goToPreviousPage()
  }

  useEffect(() => {
    if (!readingMode) return

    const zone = readingInteractionZoneRef.current
    if (!zone) return

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    const handleGesture = (event: Event) => {
      event.preventDefault()
    }

    zone.addEventListener('touchmove', handleTouchMove, { passive: false })
    zone.addEventListener('gesturestart', handleGesture as EventListener, { passive: false })
    zone.addEventListener('gesturechange', handleGesture as EventListener, { passive: false })
    zone.addEventListener('gestureend', handleGesture as EventListener, { passive: false })

    return () => {
      zone.removeEventListener('touchmove', handleTouchMove)
      zone.removeEventListener('gesturestart', handleGesture as EventListener)
      zone.removeEventListener('gesturechange', handleGesture as EventListener)
      zone.removeEventListener('gestureend', handleGesture as EventListener)
    }
  }, [currentReadingPage, readingMode, readingViewMode])

  if (readingMode && section && currentPage) {
    const translatedAvailable = readingTranslatedAvailable
    const displayUrl = readingDisplayUrl

    const statusA = normalizeStatus(currentPage.status)
    const statusB = normalizeStatus(currentPage.translation_status)
    const isCurrentProcessing = !translatedAvailable && (PROCESSING_STATUSES.has(statusA) || PROCESSING_STATUSES.has(statusB))

    return (
      <div className="fixed inset-0 bg-background z-70 flex flex-col">
        <div className="flex-none bg-card border-b border-border p-2 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeReadingMode}
                className="h-8 px-2 sm:h-9 sm:px-3"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline ml-2">Fechar</span>
              </Button>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReadingViewMode((prev) => prev === 'paginated' ? 'scroll' : 'paginated')}
                  className={cn('h-8 w-8 p-0 sm:h-9 sm:w-9', readingViewMode === 'scroll' && 'bg-muted text-foreground')}
                  aria-label={readingViewMode === 'paginated' ? 'Alternar para scroll contínuo' : 'Alternar para paginação'}
                  title={readingViewMode === 'paginated' ? 'Scroll contínuo' : 'Paginação'}
                >
                  <Rows3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom((value) => Math.max(25, value - 10))}
                  className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[11px] w-9 text-center sm:text-xs sm:w-10">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom((value) => Math.min(300, value + 10))}
                  className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                {shouldUseCurrentPageOcrOverlay && (
                  <Popover
                    open={isOverlayFontPopoverOpen}
                    onOpenChange={setIsOverlayFontPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 min-w-12 gap-1 border-primary/40 bg-primary/12 px-2 text-primary hover:bg-primary/20 hover:text-primary sm:h-9 sm:min-w-14 sm:px-2.5',
                          isOverlayFontPopoverOpen && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        )}
                        aria-label="Abrir ajuste de fonte do overlay OCR"
                      >
                        <span className="text-[11px] font-semibold leading-none">Aa</span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOverlayFontPopoverOpen && 'rotate-180')} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="end"
                      sideOffset={8}
                      className="z-[10000] w-56 p-2.5"
                    >
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-muted-foreground">Tamanho da fonte</p>
                        <div className="flex items-center justify-between gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => setOcrOverlayFontScale((value) => (
                              clampRange(value - OCR_OVERLAY_FONT_SCALE_STEP, OCR_OVERLAY_FONT_SCALE_MIN, OCR_OVERLAY_FONT_SCALE_MAX)
                            ))}
                            disabled={ocrOverlayFontScale <= OCR_OVERLAY_FONT_SCALE_MIN}
                            aria-label="Diminuir fonte do overlay OCR"
                          >
                            -
                          </Button>
                          <span className="min-w-[64px] text-center text-sm font-semibold text-foreground">
                            {overlayFontPercentLabel}%
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={() => setOcrOverlayFontScale((value) => (
                              clampRange(value + OCR_OVERLAY_FONT_SCALE_STEP, OCR_OVERLAY_FONT_SCALE_MIN, OCR_OVERLAY_FONT_SCALE_MAX)
                            ))}
                            disabled={ocrOverlayFontScale >= OCR_OVERLAY_FONT_SCALE_MAX}
                            aria-label="Aumentar fonte do overlay OCR"
                          >
                            +
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Tipo de fonte</p>
                          <Select
                            value={ocrOverlayFontFamily}
                            onValueChange={(value) => setOcrOverlayFontFamily(value as OcrOverlayFontFamily)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Fonte" />
                            </SelectTrigger>
                            <SelectContent className="z-[10001]">
                              {Object.entries(OCR_OVERLAY_FONT_FAMILIES).map(([fontKey, fontConfig]) => (
                                <SelectItem
                                  key={fontKey}
                                  value={fontKey}
                                  className="text-xs"
                                  style={{ fontFamily: fontConfig.css }}
                                >
                                  {fontConfig.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Texto exibido</p>
                          <div className="grid grid-cols-2 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={ocrOverlayTextMode === 'translated' ? 'default' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() => setOcrOverlayTextMode('translated')}
                            >
                              Traduzido
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={ocrOverlayTextMode === 'original' ? 'default' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() => setOcrOverlayTextMode('original')}
                            >
                              Original
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Densidade</p>
                          <div className="flex items-center justify-between gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => setOcrOverlayDensity((value) => (
                                clampRange(value - OCR_OVERLAY_DENSITY_STEP, OCR_OVERLAY_DENSITY_MIN, OCR_OVERLAY_DENSITY_MAX)
                              ))}
                              disabled={ocrOverlayDensity <= OCR_OVERLAY_DENSITY_MIN}
                              aria-label="Diminuir densidade do overlay OCR"
                            >
                              -
                            </Button>
                            <span className="min-w-[64px] text-center text-sm font-semibold text-foreground">
                              {overlayDensityLabel}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => setOcrOverlayDensity((value) => (
                                clampRange(value + OCR_OVERLAY_DENSITY_STEP, OCR_OVERLAY_DENSITY_MIN, OCR_OVERLAY_DENSITY_MAX)
                              ))}
                              disabled={ocrOverlayDensity >= OCR_OVERLAY_DENSITY_MAX}
                              aria-label="Aumentar densidade do overlay OCR"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Opacidade</p>
                          <div className="flex items-center justify-between gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => setOcrOverlayOpacity((value) => (
                                clampRange(value - 0.05, OCR_OVERLAY_OPACITY_MIN, OCR_OVERLAY_OPACITY_MAX)
                              ))}
                              disabled={ocrOverlayOpacity <= OCR_OVERLAY_OPACITY_MIN}
                              aria-label="Diminuir opacidade do overlay OCR"
                            >
                              -
                            </Button>
                            <span className="min-w-[64px] text-center text-sm font-semibold text-foreground">
                              {overlayOpacityLabel}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => setOcrOverlayOpacity((value) => (
                                clampRange(value + 0.05, OCR_OVERLAY_OPACITY_MIN, OCR_OVERLAY_OPACITY_MAX)
                              ))}
                              disabled={ocrOverlayOpacity >= OCR_OVERLAY_OPACITY_MAX}
                              aria-label="Aumentar opacidade do overlay OCR"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Formato global</p>
                          <div className="grid grid-cols-2 gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={ocrOverlayGlobalShape === 'rect' ? 'default' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() => setOcrOverlayGlobalShape('rect')}
                            >
                              Retângulo
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={ocrOverlayGlobalShape === 'oval' ? 'default' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() => setOcrOverlayGlobalShape('oval')}
                            >
                              Oval
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">Seleção de área</p>
                          <Button
                            type="button"
                            size="sm"
                            variant={isOverlaySelectionMode ? 'default' : 'outline'}
                            className="h-8 w-full text-xs"
                            onClick={() => {
                              setIsOverlayFontPopoverOpen(false)
                              setOverlaySelectionDraft(null)
                              setIsOverlaySelectionMode((value) => {
                                setSelectedOverlayTarget(null)
                                setOverlayQuickEditorState(null)
                                setOverlayDragEnabledTarget(null)
                                return !value
                              })
                            }}
                          >
                            {isOverlaySelectionMode ? 'Seleção ligada' : 'Selecionar área'}
                          </Button>
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            Esta opção seleciona a área que deseja traduzir manualmente.
                          </p>
                        </div>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          2x no balão para editar. Ative "Arrastar" no menu para mover.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1 sm:justify-center sm:gap-2">
              {translatedAvailable && (
                <span className="text-[10px] sm:text-xs bg-green-500/20 text-green-500 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Traduzida
                </span>
              )}
              {shouldUseCurrentPageOcrOverlay && !translatedAvailable && (
                <span className="text-[10px] sm:text-xs bg-blue-500/15 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  <span className="sm:hidden">
                    {currentPageOverlayLoading
                      ? 'OCR...'
                      : currentPageOverlayItems.length > 0
                        ? 'Overlay OCR'
                        : 'Sem boxes'}
                  </span>
                  <span className="hidden sm:inline">
                    {currentPageOverlayLoading
                      ? 'Carregando boxes...'
                      : currentPageOverlayItems.length > 0
                        ? 'Overlay OCR ativo'
                        : 'Sem boxes OCR'}
                  </span>
                </span>
              )}
              {isOverlaySelectionMode && shouldUseCurrentPageOcrOverlay && (
                <span className="text-[10px] sm:text-xs rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-primary">
                  Selecione arrastando
                </span>
              )}
              {isCurrentProcessing && (
                <span className="text-[10px] sm:text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processando
                </span>
              )}
            </div>
          </div>
        </div>

        {readingViewMode === 'paginated' ? (
          <>
            <div
              ref={readingInteractionZoneRef}
              className="relative flex-1 overflow-auto bg-muted/30"
              onTouchStart={handleReadingTouchStart}
              onTouchMove={handleReadingTouchMove}
              onTouchEnd={handleReadingTouchEnd}
              style={{ touchAction: 'pan-y' }}
            >
              {isOverlaySelectionMode && (
                <div className="pointer-events-none absolute inset-0 z-[1] bg-black/25" />
              )}
              <div className="min-h-full flex items-center justify-center p-2 sm:p-4">
                <div
                  className="relative w-full min-h-[280px] sm:min-h-[420px]"
                  style={{
                    maxWidth: `${Math.min(zoom * 6, 1200)}px`,
                  }}
                >
                  {isReadingImageLoading && (
                    <div className="absolute inset-0 z-10">
                      <Skeleton className="h-full w-full rounded-md" />
                    </div>
                  )}

                  <div
                    className="relative mx-auto w-full"
                    data-ocr-overlay-host={currentPage.id}
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <img
                      key={displayUrl}
                      src={displayUrl}
                      alt={`Página ${currentPage.order_index + 1}`}
                      className={cn(
                        'w-full h-auto block mx-auto transition-opacity duration-200',
                        isReadingImageLoading ? 'opacity-0' : 'opacity-100'
                      )}
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      onLoad={(event) => {
                        markImageAsLoaded(displayUrl)
                        const nextReferenceSize = {
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        }
                        updateImageNaturalSize(
                          currentPage.id,
                          nextReferenceSize.width,
                          nextReferenceSize.height
                        )

                        if (
                          shouldUseCurrentPageOcrOverlay
                          && currentPageOverlayItems.length > 0
                          && nextReferenceSize.width > 0
                          && nextReferenceSize.height > 0
                        ) {
                          void ensureOverlayColorsForImage(
                            currentPage.id,
                            displayUrl,
                            currentPageOverlayItems,
                            nextReferenceSize
                          )
                        }
                      }}
                      onError={() => markImageAsLoaded(displayUrl)}
                    />

                    {shouldUseCurrentPageOcrOverlay && (currentPageOverlayItems.length > 0 || isOverlaySelectionMode) && (
                      <OcrTextOverlay
                        imageId={currentPage.id}
                        items={currentPageOverlayItems}
                        referenceSize={currentPageOverlayReferenceSize}
                        fontScale={ocrOverlayFontScale}
                        boxInsetPercent={ocrOverlayBoxInsetPercent}
                        overlayDensity={ocrOverlayDensity}
                        overlayOpacity={ocrOverlayOpacity}
                        globalShape={ocrOverlayGlobalShape}
                        fontFamilyCss={overlayFontFamilyCss}
                        visualScale={zoom / 100}
                        editable={ocrOverlayEditMode}
                        selectedItemId={selectedOverlayOnCurrentPage?.itemId ?? null}
                        itemOverrides={currentPageOverlayOverrides}
                        itemColors={currentPageOverlayColors}
                        onSelectItem={handleSelectOverlayItem}
                        onClearSelection={handleClearOverlaySelection}
                        onMoveItem={handleMoveOverlayItem}
                        onResizeItem={handleResizeOverlayItem}
                        onOpenQuickEditor={handleOpenOverlayQuickEditor}
                        dragEnabledItemId={(
                          overlayDragEnabledTarget && overlayDragEnabledTarget.imageId === currentPage.id
                            ? overlayDragEnabledTarget.itemId
                            : null
                        )}
                        selectionModeEnabled={overlaySelectionEnabled}
                        showTranslatingPlaceholder={currentPageOverlayLoading}
                        textMode={ocrOverlayTextMode}
                        onSelectionDraftReady={handleOverlaySelectionDraftReady}
                        selectionPreviewBox={overlaySelectionDraftForCurrentPage?.box ?? null}
                        onSelectionPreviewChange={handleOverlaySelectionDraftChange}
                      />
                    )}
                    {shouldUseCurrentPageOcrOverlay && currentPageOverlayLoading && currentPageOverlayItems.length === 0 && (
                      <div className="absolute right-2 top-2 z-20 rounded-full border border-blue-500/35 bg-blue-500/15 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-300">
                        Carregando boxes...
                      </div>
                    )}

                    {overlaySelectionDraftForCurrentPage && (
                      <Popover
                        open
                        onOpenChange={(open) => {
                          if (!open) handleDiscardOverlaySelectionDraft()
                        }}
                      >
                        <PopoverAnchor asChild>
                          <div
                            className="absolute z-30 h-0 w-0"
                            style={{
                              left: `${overlaySelectionDraftForCurrentPage.leftPercent}%`,
                              top: `${overlaySelectionDraftForCurrentPage.topPercent}%`,
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          side="top"
                          align="center"
                          sideOffset={10}
                          data-ocr-overlay-selection-confirm="true"
                          className="z-[9999] w-[300px] max-w-[92vw] p-2"
                          onOpenAutoFocus={(event) => event.preventDefault()}
                          onInteractOutside={(event) => {
                            if (isOverlaySelectionPopoverInternalTarget(event.target)) {
                              event.preventDefault()
                            }
                          }}
                          onFocusOutside={(event) => {
                            if (isOverlaySelectionPopoverInternalTarget(event.target)) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <div className="space-y-2">
                            <p className="text-[11px] font-medium text-foreground">Confirmar área selecionada?</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Entrada</p>
                                <Select
                                  value={overlaySelectionSourceLang}
                                  onValueChange={setOverlaySelectionSourceLang}
                                >
                                  <SelectTrigger data-ocr-overlay-selection-lang-select="true" className="h-7 px-2 text-[11px]">
                                    <SelectValue placeholder="Origem" />
                                  </SelectTrigger>
                                  <SelectContent data-ocr-overlay-selection-lang-select="true" className="z-[10050] max-h-52">
                                    {OCR_OVERLAY_SELECTION_LANGUAGES.map((language) => (
                                      <SelectItem key={`overlay-selection-source-${language.code}`} value={language.code}>
                                        {language.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Saída</p>
                                <Select
                                  value={overlaySelectionTargetLang}
                                  onValueChange={setOverlaySelectionTargetLang}
                                >
                                  <SelectTrigger data-ocr-overlay-selection-lang-select="true" className="h-7 px-2 text-[11px]">
                                    <SelectValue placeholder="Destino" />
                                  </SelectTrigger>
                                  <SelectContent data-ocr-overlay-selection-lang-select="true" className="z-[10050] max-h-52">
                                    {OCR_OVERLAY_SELECTION_TARGET_LANGUAGES.map((language) => (
                                      <SelectItem key={`overlay-selection-target-${language.code}`} value={language.code}>
                                        {language.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={handleDiscardOverlaySelectionDraft}
                              >
                                Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={handleConfirmOverlaySelectionDraft}
                              >
                                Confirmar
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    {overlayQuickEditorForCurrentPage && selectedOverlayOnCurrentPage && (
                      <Popover
                        open
                        onOpenChange={(open) => {
                          if (!open) handleClearOverlaySelection()
                        }}
                      >
                        <PopoverAnchor asChild>
                          <div
                            className="absolute z-30 h-0 w-0"
                            style={{
                              left: `${overlayQuickEditorForCurrentPage.leftPercent}%`,
                              top: `${overlayQuickEditorForCurrentPage.topPercent}%`,
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          side={quickEditorPlacementForCurrentPage.side}
                          align={quickEditorPlacementForCurrentPage.align}
                          sideOffset={10}
                          sticky="always"
                          updatePositionStrategy="always"
                          avoidCollisions={false}
                          data-ocr-overlay-quick-editor="true"
                          className="z-[9999] w-[230px] p-2 data-[state=open]:animate-none data-[state=closed]:animate-none"
                          onOpenAutoFocus={(event) => event.preventDefault()}
                          onInteractOutside={(event) => {
                            const target = event.target instanceof HTMLElement ? event.target : null
                            if (target?.closest('[data-ocr-overlay-interactive="true"]')) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className="min-w-0 flex-1 cursor-move touch-none rounded border border-border/70 bg-muted/40 px-2 py-1"
                                onPointerDown={(event) => handleStartOverlayQuickEditorDrag(selectedOverlayOnCurrentPage.imageId, event)}
                              >
                                <p className="truncate text-[11px] font-semibold text-foreground">
                                  Balão #{selectedOverlayOnCurrentPage.itemId}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={handleClearOverlaySelection}
                              >
                                Fechar
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Arrastar</span>
                              <Button
                                type="button"
                                size="sm"
                                variant={selectedOverlayDragEnabled ? 'default' : 'outline'}
                                className="h-6 px-2 text-[11px]"
                                onClick={handleToggleSelectedOverlayDrag}
                              >
                                {selectedOverlayDragEnabled ? 'Habilitado' : 'Desligado'}
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Tipo</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={selectedOverlayShape === 'rect' ? 'default' : 'outline'}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleSetSelectedOverlayShape('rect')}
                                >
                                  Ret
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={selectedOverlayShape === 'oval' ? 'default' : 'outline'}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleSetSelectedOverlayShape('oval')}
                                >
                                  Oval
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Fonte</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemFont(-OCR_OVERLAY_ITEM_FONT_SCALE_STEP)}
                                  disabled={selectedOverlayItemFontScale <= OCR_OVERLAY_ITEM_FONT_SCALE_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemFontLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemFont(OCR_OVERLAY_ITEM_FONT_SCALE_STEP)}
                                  disabled={selectedOverlayItemFontScale >= OCR_OVERLAY_ITEM_FONT_SCALE_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Tamanho</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemSize(-OCR_OVERLAY_ITEM_SIZE_STEP)}
                                  disabled={selectedOverlayItemSizeScale <= OCR_OVERLAY_ITEM_SIZE_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemSizeLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemSize(OCR_OVERLAY_ITEM_SIZE_STEP)}
                                  disabled={selectedOverlayItemSizeScale >= OCR_OVERLAY_ITEM_SIZE_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Densidade</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemDensity(-OCR_OVERLAY_ITEM_DENSITY_STEP)}
                                  disabled={selectedOverlayItemDensity <= OCR_OVERLAY_ITEM_DENSITY_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemDensityLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemDensity(OCR_OVERLAY_ITEM_DENSITY_STEP)}
                                  disabled={selectedOverlayItemDensity >= OCR_OVERLAY_ITEM_DENSITY_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => handleDeleteSelectedOverlayItem()}
                              >
                                Excluir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => handleResetSelectedOverlayItemAdjustments()}
                              >
                                Resetar
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {isCurrentProcessing && (
                    <div className="absolute inset-0 z-20 bg-background/75 flex items-center justify-center">
                      <div className="text-center px-4">
                        <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin mx-auto text-primary mb-3" />
                        <p className="text-foreground font-medium text-sm sm:text-base">Processando página...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentReadingPage === sectionImages.length - 1 && suggestedSections.length > 0 && (
              <div className="flex-none border-t border-border bg-card/95 px-3 py-2">
                {!showSuggestions ? (
                  /* pílula minimizada */
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(true)}
                      className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70"
                    >
                      {suggestedSections[0].cover?.image_id ? (
                        <img
                          src={buildImageViewUrl(suggestedSections[0].id, suggestedSections[0].cover.image_id, 'original')}
                          alt=""
                          className="h-7 w-5 rounded object-cover shrink-0"
                          loading="lazy" decoding="async"
                        />
                      ) : (
                        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary leading-none mb-0.5">Próximo</p>
                        <p className="truncate text-[11px] font-semibold text-foreground">{suggestedSections[0].name}</p>
                      </div>
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                    <Link
                      href={`/inicio/secoes/${suggestedSections[0].id}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                ) : (
                  /* expandido */
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground shrink-0">Lendo</span>
                        <span className="truncate text-[10px] font-semibold text-foreground">{section?.name ?? '—'}</span>
                      </div>
                      <button type="button" onClick={() => setShowSuggestions(false)} className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Link
                      href={`/inicio/secoes/${suggestedSections[0].id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors group"
                    >
                      {suggestedSections[0].cover?.image_id ? (
                        <img src={buildImageViewUrl(suggestedSections[0].id, suggestedSections[0].cover.image_id, 'original')} alt="" className="h-9 w-7 rounded object-cover shrink-0" loading="lazy" decoding="async" />
                      ) : (
                        <div className="h-9 w-7 rounded bg-muted shrink-0 flex items-center justify-center">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Próximo</p>
                        <p className="truncate text-xs font-semibold text-foreground">{suggestedSections[0].name}</p>
                      </div>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </Link>
                    {suggestedSections.length > 1 && (
                      <div className="border-t border-border">
                        <div className="flex gap-0 overflow-x-auto snap-x snap-mandatory scrollbar-none divide-x divide-border">
                          {suggestedSections.map((s, idx) => {
                            const coverUrl = s.cover?.image_id ? buildImageViewUrl(s.id, s.cover.image_id, 'original') : null
                            return (
                              <Link key={s.id} href={`/inicio/secoes/${s.id}`} className="group relative shrink-0 snap-start w-20 overflow-hidden block">
                                <div className="relative aspect-3/4 w-full">
                                  {coverUrl ? (
                                    <img src={coverUrl} alt={s.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-muted"><BookOpen className="h-4 w-4 text-muted-foreground/20" /></div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                  <div className="absolute top-1 left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black/50 px-1">
                                    <span className="text-[9px] font-bold text-white/80">{idx + 1}</span>
                                  </div>
                                  <div className="absolute inset-x-0 bottom-0 p-1.5">
                                    <p className="text-[9px] font-semibold leading-tight text-white line-clamp-2">{s.name}</p>
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-none bg-card border-t border-border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={goToPreviousPage}
                  disabled={currentReadingPage === 0}
                  className="h-12 w-20 sm:w-24"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="hidden sm:inline ml-1">Ant.</span>
                </Button>

                <div className="flex-1 max-w-[180px] sm:max-w-[220px]">
                  <select
                    value={currentReadingPage}
                    onChange={(event) => setCurrentReadingPage(Number(event.target.value))}
                    className="w-full h-12 px-3 rounded-md border border-border bg-input text-foreground text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer text-center"
                    style={{
                      backgroundImage: `url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem',
                    }}
                  >
                    {sectionImages.map((image, idx) => (
                      <option key={image.id} value={idx}>
                        Página {image.order_index + 1}
                        {isImageTranslated(image) ? ' (Traduzida)' : ''}
                        {readPages.has(image.id) ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {currentReadingPage === sectionImages.length - 1 ? (
                  <Button
                    size="lg"
                    onClick={closeReadingMode}
                    className="h-12 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white min-w-[124px]"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span>Concluir</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={goToNextPage}
                    className="h-12 w-20 sm:w-24"
                  >
                    <span className="hidden sm:inline mr-1">Próx.</span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            ref={readingInteractionZoneRef}
            className="relative flex-1 overflow-auto bg-muted/30"
            style={{ touchAction: 'pan-y' }}
          >
            {isOverlaySelectionMode && (
              <div className="pointer-events-none absolute inset-0 z-[1] bg-black/25" />
            )}
            <div className="flex flex-col items-center p-2 sm:p-4">
              {sectionImages.map((image) => {
                const imgTranslated = isImageTranslated(image)
                const imgUrl = imgTranslated
                  ? buildImageViewUrl(section.id, image.id, 'translated')
                  : buildImageViewUrl(section.id, image.id, 'original')
                const statusA = normalizeStatus(image.status)
                const statusB = normalizeStatus(image.translation_status)
                const isProcessing = !imgTranslated && (PROCESSING_STATUSES.has(statusA) || PROCESSING_STATUSES.has(statusB))
                const shouldUseImageOcrOverlay = !imgTranslated
                const imageOverlayItems = filterOverlayItemsByHiddenIds(
                  mergeOverlayItems(
                    mergeOverlayItems(
                      toOverlaySeedItems(image),
                      ocrOverlayByImageId[image.id] ?? []
                    ),
                    ocrOverlayManualItemsByImageId[image.id] ?? []
                  ),
                  ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
                )
                const imageOverlayReferenceSize = resolveImageOverlayReferenceSize(image)
                const imageOverlayLoading = Boolean(
                  ocrOverlayLoadingByImageId[image.id]
                  || ocrOverlayCreatingSelectionByImageId[image.id]
                  || ocrOverlayQueuedImageIds.has(image.id)
                )
                const overlayQuickEditorForImage = (
                  overlayQuickEditorState && overlayQuickEditorState.imageId === image.id
                )
                  ? overlayQuickEditorState
                  : null
                const quickEditorPlacementForImage = (
                  overlayQuickEditorForImage
                  && overlayQuickEditorPlacement
                  && overlayQuickEditorPlacement.imageId === overlayQuickEditorForImage.imageId
                  && overlayQuickEditorPlacement.itemId === overlayQuickEditorForImage.itemId
                )
                  ? {
                    side: overlayQuickEditorPlacement.side,
                    align: overlayQuickEditorPlacement.align,
                  }
                  : resolveQuickEditorPlacement(overlayQuickEditorForImage)
                const selectedOverlayOnImage = (
                  selectedOverlayTarget && selectedOverlayTarget.imageId === image.id
                )
                  ? selectedOverlayTarget
                  : null
                const isRevealed = revealedScrollImageIds.has(image.id)
                return (
                  <div
                    key={image.id}
                    ref={(el) => {
                      if (el && !isRevealed) {
                        scrollImageObserverRef.current?.observe(el)
                      }
                    }}
                    className="relative"
                    data-reader-page-id={image.id}
                    data-ocr-overlay-host={image.id}
                    data-scroll-image-id={image.id}
                    style={{ width: `${zoom}%`, minWidth: '100px' }}
                  >
                    {!isRevealed && (
                      <div className="w-full bg-muted/40" style={{ aspectRatio: '3/4' }} />
                    )}
                    <img
                      src={isRevealed ? imgUrl : undefined}
                      alt={`Página ${image.order_index + 1}`}
                      className={cn('w-full h-auto block', !isRevealed && 'hidden')}
                      decoding="async"
                      onLoad={(event) => {
                        markImageAsLoaded(imgUrl)
                        const nextReferenceSize = {
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        }
                        updateImageNaturalSize(
                          image.id,
                          nextReferenceSize.width,
                          nextReferenceSize.height
                        )

                        if (!shouldUseImageOcrOverlay) return
                        const hiddenIds = ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
                        const hasSeedOverlay = filterOverlayItemsByHiddenIds(toOverlaySeedItems(image), hiddenIds).length > 0
                        const hasManualOverlay = filterOverlayItemsByHiddenIds(
                          ocrOverlayManualItemsByImageId[image.id] ?? [],
                          hiddenIds
                        ).length > 0
                        if (!hasSeedOverlay && !hasManualOverlay) {
                          return
                        }
                        requestOverlayTranslationForImage(image)

                        if (imageOverlayItems.length > 0) {
                          void ensureOverlayColorsForImage(
                            image.id,
                            imgUrl,
                            imageOverlayItems,
                            nextReferenceSize
                          )
                        }
                      }}
                    />
                    {shouldUseImageOcrOverlay && (imageOverlayItems.length > 0 || isOverlaySelectionMode) && (
                      <OcrTextOverlay
                        imageId={image.id}
                        items={imageOverlayItems}
                        referenceSize={imageOverlayReferenceSize}
                        fontScale={ocrOverlayFontScale}
                        boxInsetPercent={ocrOverlayBoxInsetPercent}
                        overlayDensity={ocrOverlayDensity}
                        overlayOpacity={ocrOverlayOpacity}
                        globalShape={ocrOverlayGlobalShape}
                        fontFamilyCss={overlayFontFamilyCss}
                        editable={ocrOverlayEditMode}
                        selectedItemId={selectedOverlayTarget?.imageId === image.id ? selectedOverlayTarget.itemId : null}
                        itemOverrides={ocrOverlayOverridesByImageId[image.id] ?? {}}
                        itemColors={ocrOverlayColorsByImageId[image.id] ?? {}}
                        onSelectItem={handleSelectOverlayItem}
                        onClearSelection={handleClearOverlaySelection}
                        onMoveItem={handleMoveOverlayItem}
                        onResizeItem={handleResizeOverlayItem}
                        onOpenQuickEditor={handleOpenOverlayQuickEditor}
                        dragEnabledItemId={(
                          overlayDragEnabledTarget && overlayDragEnabledTarget.imageId === image.id
                            ? overlayDragEnabledTarget.itemId
                            : null
                        )}
                        selectionModeEnabled={overlaySelectionEnabled}
                        showTranslatingPlaceholder={imageOverlayLoading}
                        textMode={ocrOverlayTextMode}
                        onSelectionDraftReady={handleOverlaySelectionDraftReady}
                        selectionPreviewBox={(
                          overlaySelectionDraft && overlaySelectionDraft.imageId === image.id
                            ? overlaySelectionDraft.box
                            : null
                        )}
                        onSelectionPreviewChange={handleOverlaySelectionDraftChange}
                      />
                    )}
                    {shouldUseImageOcrOverlay && imageOverlayLoading && imageOverlayItems.length === 0 && (
                      <div className="absolute right-2 top-2 rounded-full border border-blue-500/35 bg-blue-500/15 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-300">
                        Carregando boxes...
                      </div>
                    )}
                    {overlaySelectionDraft && overlaySelectionDraft.imageId === image.id && (
                      <Popover
                        open
                        onOpenChange={(open) => {
                          if (!open) handleDiscardOverlaySelectionDraft()
                        }}
                      >
                        <PopoverAnchor asChild>
                          <div
                            className="absolute z-30 h-0 w-0"
                            style={{
                              left: `${overlaySelectionDraft.leftPercent}%`,
                              top: `${overlaySelectionDraft.topPercent}%`,
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          side="top"
                          align="center"
                          sideOffset={10}
                          data-ocr-overlay-selection-confirm="true"
                          className="z-[9999] w-[300px] max-w-[92vw] p-2"
                          onOpenAutoFocus={(event) => event.preventDefault()}
                          onInteractOutside={(event) => {
                            if (isOverlaySelectionPopoverInternalTarget(event.target)) {
                              event.preventDefault()
                            }
                          }}
                          onFocusOutside={(event) => {
                            if (isOverlaySelectionPopoverInternalTarget(event.target)) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <div className="space-y-2">
                            <p className="text-[11px] font-medium text-foreground">Confirmar área selecionada?</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Entrada</p>
                                <Select
                                  value={overlaySelectionSourceLang}
                                  onValueChange={setOverlaySelectionSourceLang}
                                >
                                  <SelectTrigger data-ocr-overlay-selection-lang-select="true" className="h-7 px-2 text-[11px]">
                                    <SelectValue placeholder="Origem" />
                                  </SelectTrigger>
                                  <SelectContent data-ocr-overlay-selection-lang-select="true" className="z-[10050] max-h-52">
                                    {OCR_OVERLAY_SELECTION_LANGUAGES.map((language) => (
                                      <SelectItem key={`overlay-selection-source-scroll-${language.code}`} value={language.code}>
                                        {language.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground">Saída</p>
                                <Select
                                  value={overlaySelectionTargetLang}
                                  onValueChange={setOverlaySelectionTargetLang}
                                >
                                  <SelectTrigger data-ocr-overlay-selection-lang-select="true" className="h-7 px-2 text-[11px]">
                                    <SelectValue placeholder="Destino" />
                                  </SelectTrigger>
                                  <SelectContent data-ocr-overlay-selection-lang-select="true" className="z-[10050] max-h-52">
                                    {OCR_OVERLAY_SELECTION_TARGET_LANGUAGES.map((language) => (
                                      <SelectItem key={`overlay-selection-target-scroll-${language.code}`} value={language.code}>
                                        {language.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={handleDiscardOverlaySelectionDraft}
                              >
                                Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={handleConfirmOverlaySelectionDraft}
                              >
                                Confirmar
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {overlayQuickEditorForImage && selectedOverlayOnImage && (
                      <Popover
                        open
                        onOpenChange={(open) => {
                          if (!open) handleClearOverlaySelection()
                        }}
                      >
                        <PopoverAnchor asChild>
                          <div
                            className="absolute z-30 h-0 w-0"
                            style={{
                              left: `${overlayQuickEditorForImage.leftPercent}%`,
                              top: `${overlayQuickEditorForImage.topPercent}%`,
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          side={quickEditorPlacementForImage.side}
                          align={quickEditorPlacementForImage.align}
                          sideOffset={10}
                          sticky="always"
                          updatePositionStrategy="always"
                          avoidCollisions={false}
                          data-ocr-overlay-quick-editor="true"
                          className="z-[9999] w-[230px] p-2 data-[state=open]:animate-none data-[state=closed]:animate-none"
                          onOpenAutoFocus={(event) => event.preventDefault()}
                          onInteractOutside={(event) => {
                            const target = event.target instanceof HTMLElement ? event.target : null
                            if (target?.closest('[data-ocr-overlay-interactive="true"]')) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className="min-w-0 flex-1 cursor-move touch-none rounded border border-border/70 bg-muted/40 px-2 py-1"
                                onPointerDown={(event) => handleStartOverlayQuickEditorDrag(selectedOverlayOnImage.imageId, event)}
                              >
                                <p className="truncate text-[11px] font-semibold text-foreground">
                                  Balão #{selectedOverlayOnImage.itemId}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={handleClearOverlaySelection}
                              >
                                Fechar
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Arrastar</span>
                              <Button
                                type="button"
                                size="sm"
                                variant={selectedOverlayDragEnabled ? 'default' : 'outline'}
                                className="h-6 px-2 text-[11px]"
                                onClick={handleToggleSelectedOverlayDrag}
                              >
                                {selectedOverlayDragEnabled ? 'Habilitado' : 'Desligado'}
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Tipo</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={selectedOverlayShape === 'rect' ? 'default' : 'outline'}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleSetSelectedOverlayShape('rect')}
                                >
                                  Ret
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={selectedOverlayShape === 'oval' ? 'default' : 'outline'}
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleSetSelectedOverlayShape('oval')}
                                >
                                  Oval
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Fonte</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemFont(-OCR_OVERLAY_ITEM_FONT_SCALE_STEP)}
                                  disabled={selectedOverlayItemFontScale <= OCR_OVERLAY_ITEM_FONT_SCALE_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemFontLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemFont(OCR_OVERLAY_ITEM_FONT_SCALE_STEP)}
                                  disabled={selectedOverlayItemFontScale >= OCR_OVERLAY_ITEM_FONT_SCALE_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Tamanho</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemSize(-OCR_OVERLAY_ITEM_SIZE_STEP)}
                                  disabled={selectedOverlayItemSizeScale <= OCR_OVERLAY_ITEM_SIZE_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemSizeLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemSize(OCR_OVERLAY_ITEM_SIZE_STEP)}
                                  disabled={selectedOverlayItemSizeScale >= OCR_OVERLAY_ITEM_SIZE_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">Densidade</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemDensity(-OCR_OVERLAY_ITEM_DENSITY_STEP)}
                                  disabled={selectedOverlayItemDensity <= OCR_OVERLAY_ITEM_DENSITY_MIN}
                                >
                                  -
                                </Button>
                                <span className="min-w-[44px] text-center text-[11px] font-medium text-foreground">
                                  {selectedOverlayItemDensityLabel}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 text-[11px]"
                                  onClick={() => handleAdjustSelectedOverlayItemDensity(OCR_OVERLAY_ITEM_DENSITY_STEP)}
                                  disabled={selectedOverlayItemDensity >= OCR_OVERLAY_ITEM_DENSITY_MAX}
                                >
                                  +
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => handleDeleteSelectedOverlayItem()}
                              >
                                Excluir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => handleResetSelectedOverlayItemAdjustments()}
                              >
                                Resetar
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {shouldUseImageOcrOverlay && imageOverlayLoading && (
                      <div className="absolute right-2 top-2 rounded-full border border-blue-500/35 bg-blue-500/15 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-300">
                        OCR...
                      </div>
                    )}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-background/75 flex items-center justify-center">
                        <div className="text-center px-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                          <p className="text-foreground font-medium text-xs">Processando...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {sectionImages.length > 0 && (
              <div className="w-full pt-8 pb-4 flex flex-col items-center gap-4 border-t border-border mt-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Chegou ao fim da seção!</p>
                  {section?.name && (
                    <p className="text-xs text-muted-foreground truncate max-w-[20ch]" title={section.name}>
                      {section.name}
                    </p>
                  )}
                </div>

                {suggestedSections.length > 0 && (
                  <div className="w-full max-w-xl">
                    {!showSuggestions ? (
                      /* pílula minimizada */
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(true)}
                          className="flex flex-1 min-w-0 items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/70"
                        >
                          {suggestedSections[0].cover?.image_id ? (
                            <img
                              src={buildImageViewUrl(suggestedSections[0].id, suggestedSections[0].cover.image_id, 'original')}
                              alt=""
                              className="h-9 w-7 rounded-md object-cover shrink-0"
                              loading="lazy" decoding="async"
                            />
                          ) : (
                            <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-primary leading-none mb-0.5">Próximo</p>
                            <p className="truncate text-sm font-semibold text-foreground">{suggestedSections[0].name}</p>
                          </div>
                          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                        <Link
                          href={`/inicio/secoes/${suggestedSections[0].id}`}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm hover:scale-105 transition-transform"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Link>
                      </div>
                    ) : (
                      /* expandido */
                      <div className="overflow-hidden rounded-2xl border border-border">
                        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0">Lendo</span>
                            <span className="truncate text-xs font-semibold text-foreground">{section?.name ?? '—'}</span>
                          </div>
                          <button type="button" onClick={() => setShowSuggestions(false)} className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <Link
                          href={`/inicio/secoes/${suggestedSections[0].id}`}
                          className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors group"
                        >
                          {suggestedSections[0].cover?.image_id ? (
                            <img src={buildImageViewUrl(suggestedSections[0].id, suggestedSections[0].cover.image_id, 'original')} alt="" className="h-12 w-9 rounded-lg object-cover shrink-0 shadow-sm" loading="lazy" decoding="async" />
                          ) : (
                            <div className="h-12 w-9 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Próximo</p>
                            <p className="truncate text-sm font-bold text-foreground">{suggestedSections[0].name}</p>
                          </div>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
                            <ChevronRight className="h-5 w-5" />
                          </div>
                        </Link>
                        {suggestedSections.length > 1 && (
                          <div className="border-t border-border">
                            <div className="flex gap-0 overflow-x-auto snap-x snap-mandatory scrollbar-none divide-x divide-border">
                              {suggestedSections.map((s, idx) => {
                                const coverUrl = s.cover?.image_id ? buildImageViewUrl(s.id, s.cover.image_id, 'original') : null
                                return (
                                  <Link key={s.id} href={`/inicio/secoes/${s.id}`} className="group relative shrink-0 snap-start w-24 overflow-hidden block">
                                    <div className="relative aspect-3/4 w-full">
                                      {coverUrl ? (
                                        <img src={coverUrl} alt={s.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground/20" /></div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                      <div className="absolute top-1.5 left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black/50 px-1">
                                        <span className="text-[9px] font-bold text-white/80">{idx + 1}</span>
                                      </div>
                                      <div className="absolute inset-x-0 bottom-0 p-2">
                                        <p className="text-[10px] font-semibold leading-tight text-white line-clamp-2">{s.name}</p>
                                      </div>
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={closeReadingMode}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Concluir leitura
                </Button>
              </div>
              )}
            </div>
          </div>
        )}

        {isOverlaySelectionMode && (
          <div
            className={cn(
              'pointer-events-none fixed inset-x-0 z-[9998] flex justify-center px-3',
              readingViewMode === 'paginated'
                ? 'bottom-[92px] sm:bottom-[104px]'
                : 'bottom-4 sm:bottom-6'
            )}
          >
            <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-primary/40 bg-background/95 px-3 py-2.5 shadow-xl backdrop-blur">
              <p className="min-w-0 truncate text-[12px] font-medium text-foreground">Seleção ativa</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-3 text-xs"
                onClick={handleDiscardOverlaySelectionDraft}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-5">
        {(() => {
          const hasQueueActionButtons = canShowProcessButton || canShowReprocessButton
          return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={backToLibraryHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar para biblioteca</span>
              </Link>
            </Button>

            <div className="flex-1" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2 sm:px-3"
              title="Atualizar"
              onClick={() => void fetchSection()}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>

            {canShowProcessButton && (
              <Button
                type="button"
                size="sm"
                className="px-2 sm:px-3"
                title="Processar seção"
                disabled={queueActionLoading !== null}
                onClick={() => void handleQueueSection()}
              >
                {queueActionLoading === 'queue'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Play className="h-4 w-4" />}
                <span>
                  {queueActionLoading === 'queue' ? 'Processando...' : 'Processar'}
                </span>
              </Button>
            )}

            {canShowReprocessButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
                title="Reprocessar seção"
                disabled={queueActionLoading !== null}
                onClick={() => void handleReprocessSection()}
              >
                {queueActionLoading === 'reprocess'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RotateCcw className="h-4 w-4" />}
                <span>
                  {queueActionLoading === 'reprocess' ? 'Reprocessando...' : 'Reprocessar'}
                </span>
              </Button>
            )}

            {sectionImages.length > 0 && (
              <Button
                data-tour="reading-btn"
                type="button"
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
                title="Modo Leitura"
                onClick={() => openReadingPage(0)}
              >
                <BookOpen className="h-4 w-4" />
                <span className={cn(hasQueueActionButtons ? 'hidden sm:inline' : 'inline')}>
                  Modo Leitura
                </span>
              </Button>
            )}

          </div>
        </div>
          )
        })()}
      </Card>

      {error && (
        <Card className="p-3 text-sm text-destructive bg-destructive/10 border-destructive/30">
          {error}
        </Card>
      )}

      {success && (
        <Card className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30">
          {success}
        </Card>
      )}

      {isLoadingSection ? (
        <Card className="p-8">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando seção...
          </div>
        </Card>
      ) : !section ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar a seção.
        </Card>
      ) : (
        <>
          <Card data-tour="section-info" className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{section.name}</h1>
                  <p className="text-sm text-muted-foreground">Seção #{section.id}</p>
                  <div className="mt-2 max-w-sm space-y-1.5">
                    <label htmlFor="section-category-select" className="text-xs font-medium text-muted-foreground">
                      Categoria
                    </label>
                    <Popover
                      open={isSectionCategoryPopoverOpen}
                      onOpenChange={handleSectionCategoryPopoverChange}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          ref={sectionCategoryTriggerRef}
                          id="section-category-select"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={isSectionCategoryPopoverOpen}
                          className="h-9 w-full justify-between gap-2 px-3 text-left text-sm font-normal"
                          disabled={isSectionCategoryLoading || isSectionCategorySaving}
                        >
                          <span className={cn('truncate', !sectionCategoryDraft && 'text-muted-foreground')}>
                            {sectionCategoryDraft || 'Selecione ou crie uma categoria'}
                          </span>
                          {isSectionCategoryLoading || isSectionCategorySaving ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        className="max-w-[calc(100vw-1rem)] p-0"
                        style={
                          sectionCategoryPopoverWidth
                            ? { width: `${sectionCategoryPopoverWidth}px` }
                            : undefined
                        }
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            value={sectionCategoryQuery}
                            onValueChange={setSectionCategoryQuery}
                            placeholder="Buscar ou criar categoria..."
                            maxLength={SECTION_CATEGORY_MAX_LENGTH}
                            autoFocus
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return
                              if (!canCreateSectionCategoryFromQuery) return
                              event.preventDefault()
                              const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
                              if (!normalizedQuery) return
                              handleSelectSectionCategory(normalizedQuery)
                            }}
                          />
                          <CommandList className="max-h-56">
                            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            {filteredSectionCategoryOptions.map((category) => {
                              const isActive = toSectionCategoryKey(category) === toSectionCategoryKey(sectionCategoryDraft)
                              return (
                                <CommandItem
                                  key={category}
                                  value={category}
                                  onSelect={() => handleSelectSectionCategory(category)}
                                  className="group text-sm"
                                >
                                  <Check className={cn('h-4 w-4 shrink-0', isActive ? 'opacity-100' : 'opacity-0')} />
                                  <span className="min-w-0 flex-1 truncate">{category}</span>
                                  <button
                                    type="button"
                                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-muted-foreground/80 transition hover:border-border hover:bg-muted hover:text-destructive"
                                    onPointerDown={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                    }}
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      handleOpenDeleteCategoryDialog(category)
                                    }}
                                    aria-label={`Excluir categoria ${category}`}
                                    title={`Excluir categoria ${category}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </CommandItem>
                              )
                            })}
                            {canCreateSectionCategoryFromQuery && (
                              <CommandItem
                                value={`create:${sectionCategoryQuery}`}
                                onSelect={() => {
                                  const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
                                  if (!normalizedQuery) return
                                  handleSelectSectionCategory(normalizedQuery)
                                }}
                                className="text-sm"
                              >
                                <span className="truncate">
                                  Criar categoria "{normalizeSectionCategoryValue(sectionCategoryQuery)}"
                                </span>
                              </CommandItem>
                            )}
                            {sectionCategoryDraft && (
                              <CommandItem
                                value="clear-category"
                                onSelect={() => handleSelectSectionCategory('')}
                                className="text-sm text-muted-foreground"
                              >
                                Remover categoria
                              </CommandItem>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-[11px] text-muted-foreground">
                      Digite para filtrar. Se não existir, selecione "Criar categoria". Ao fechar, salva automaticamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant={isEditingSectionName ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      if (isEditingSectionName) {
                        handleCancelSectionNameEdit()
                        return
                      }
                      handleStartSectionNameEdit()
                    }}
                    disabled={isRenamingSection}
                    aria-label={isEditingSectionName ? 'Fechar edição de nome' : 'Editar nome da seção'}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-destructive/25 text-destructive/70 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeletingSection}
                    aria-label="Excluir seção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isEditingSectionName && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4 space-y-3">
                  <label className="text-sm font-medium text-foreground" htmlFor="section-name-update">
                    Alterar nome da seção
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <Input
                      ref={sectionNameInputRef}
                      id="section-name-update"
                      value={sectionNameDraft}
                      onChange={(event) => setSectionNameDraft(event.target.value)}
                      placeholder="Ex: Capítulo 57 - Parte 2"
                      disabled={isRenamingSection}
                      className="h-10"
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        void handleRenameSection()
                      }}
                    />
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelSectionNameEdit}
                        disabled={isRenamingSection}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleRenameSection()}
                        disabled={isRenamingSection || !hasPendingSectionNameChange}
                        className="min-w-[124px]"
                      >
                        {isRenamingSection ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{formatStatus(section.status)}</Badge>
              <Badge variant="outline">{formatStatus(section.internal_status)}</Badge>
              {(() => {
                const priorityInfo = getSectionPriorityInfo(section.priority)
                return (
                  <Badge
                    variant="outline"
                    className={cn(priorityInfo.tier === 'admin' && 'border-primary/50 text-primary')}
                  >
                    {priorityInfo.badgeLabel}
                  </Badge>
                )
              })()}
              <Badge variant="outline">{section.source_lang} → {section.target_lang}</Badge>
              {derivedQueuedCount > 0 && (
                <Badge variant="outline">Fila {derivedQueuedCount}</Badge>
              )}
              {derivedProcessingCount > 0 && (
                <Badge variant="outline">Processando {derivedProcessingCount}</Badge>
              )}
              <Badge variant="outline">{formatProviderLabel(section.provider_lang)}</Badge>
              {sectionStats?.estimatedTotalCostUsd !== null && sectionStats?.estimatedTotalCostUsd !== undefined && (
                <Badge variant="secondary">
                  Custo est.: {sectionStats.estimatedTotalCostUsd.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 6,
                    maximumFractionDigits: 6,
                  })}
                </Badge>
              )}
              {queueState?.completed && (
                <Badge variant="secondary">Concluída</Badge>
              )}
              {shouldShowQueueInProgressBadge && (
                <Badge variant="outline">Em fila/processando</Badge>
              )}
              {shouldPollSectionStatus && (
                <Badge variant="outline" className="gap-1">
                  {isRealtimeStatusConnected ? (
                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Loader2 className={cn('h-3 w-3', isPollingStatus && 'animate-spin')} />
                  )}
                  {isRealtimeStatusConnected ? 'Tempo real (WebSocket)' : 'Monitorando status'}
                </Badge>
              )}
            </div>

            {!queueState?.completed && shouldShowQueueInProgressBadge && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                {queueActiveJobId !== null ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {queueStatusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {queuePosition !== null && (
                        <span>Posição na fila: <span className="font-medium text-foreground">#{queuePosition}</span></span>
                      )}
                      {(queueJobsAhead ?? 0) > 0 && (
                        <span>À frente: <span className="font-medium text-foreground">{queueJobsAhead}</span></span>
                      )}
                      {(queueEstimatedWaitMinutes ?? 0) > 0 && (
                        <span>Espera: <span className="font-medium text-foreground">~{queueEstimatedWaitMinutes} min</span></span>
                      )}
                      {queueEstimatedStartLabel !== '—' && (
                        <span>Início estimado: <span className="font-medium text-foreground">{queueEstimatedStartLabel}</span></span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Criada em {formatSectionDate(section.created_at)} • Atualizada em {formatSectionDate(section.updated_at)}
                {' • '}
                {shouldPollSectionStatus
                  ? (
                    isRealtimeStatusConnected
                      ? 'Atualização em tempo real (WebSocket)'
                      : 'Aguardando reconexão do WebSocket'
                  )
                  : 'Sem monitoramento ativo'}
                {lastStatusSyncAt
                  ? ` • ${new Date(lastStatusSyncAt).toLocaleTimeString('pt-BR')}`
                  : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isStatsExpanded) {
                      setIsStatsLoading(true)
                    }
                    setIsStatsExpanded((prev) => !prev)
                  }}
                  className="h-7 px-2 text-xs"
                  disabled={isStatsLoading}
                >
                  {isStatsLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <BarChart3 className="h-3.5 w-3.5" />}
                  {isStatsExpanded ? 'Ocultar estatísticas' : 'Estatísticas'}
                </Button>
              </div>
            </div>

            {isStatsExpanded && (
              <div className="relative rounded-lg border border-border bg-muted/20 p-3">
                {isStatsLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Carregando...
                    </div>
                  </div>
                )}
                {statsError && !isStatsLoading ? (
                  <p className="text-xs text-destructive">{statsError}</p>
                ) : null}
                {isStatsLoading && !sectionStats && (
                  <div className="space-y-2 animate-pulse">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-1">
                          <div className="h-2.5 w-20 rounded bg-muted-foreground/20" />
                          <div className="h-4 w-12 rounded bg-muted-foreground/20" />
                        </div>
                      ))}
                    </div>
                    <div className="h-2.5 w-48 rounded bg-muted-foreground/15" />
                  </div>
                )}
                {sectionStats ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Páginas traduzidas</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sectionStats.completedPages.toLocaleString('pt-BR')}
                          <span className="text-muted-foreground font-normal"> / {sectionStats.totalPages.toLocaleString('pt-BR')}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Tempo total</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sectionStats.totalElapsedMinutes.toLocaleString('pt-BR', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} min
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Tempo por página</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sectionStats.avgElapsedSecondsPerPage.toLocaleString('pt-BR', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} s
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide">Balões detectados</p>
                        <p className="text-sm font-semibold text-foreground">
                          {sectionStats.totalDetections.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>OCR concluído: <span className="font-medium text-foreground">{sectionStats.ocrCompletedPages.toLocaleString('pt-BR')}</span></span>
                      <span>Páginas processadas: <span className="font-medium text-foreground">{sectionStats.completedPages.toLocaleString('pt-BR')}</span></span>
                      <span>Com tempo registrado: <span className="font-medium text-foreground">{sectionStats.pagesWithElapsedMs.toLocaleString('pt-BR')}</span></span>
                      {sectionStats.estimatedTotalCostUsd !== null
                        ? (
                          <span>
                            Custo estimado: <span className="font-medium text-foreground">
                              {sectionStats.estimatedTotalCostUsd.toLocaleString('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 6,
                                maximumFractionDigits: 6,
                              })}
                            </span>
                            {sectionStats.costModel ? ` (${sectionStats.costModel})` : ''}
                          </span>
                        )
                        : null}
                      {sectionStats.estimatedTotalCostUsd !== null
                        ? (
                          <span>
                            Tokens (in/out): <span className="font-medium text-foreground">
                              {sectionStats.estimatedInputTokens.toLocaleString('pt-BR')} / {sectionStats.estimatedOutputTokens.toLocaleString('pt-BR')}
                            </span>
                          </span>
                        )
                        : null}
                      {sectionStats.generatedAt
                        ? <span>Atualizado: <span className="font-medium text-foreground">{formatSectionDate(sectionStats.generatedAt)}</span></span>
                        : null}
                    </div>
                  </div>
                ) : null}
                {!isStatsLoading && !statsError && sectionStats && sectionStats.pagesWithElapsedMs === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Ainda não há tempo de processamento consolidado para calcular média por página.
                  </p>
                )}
              </div>
            )}
          </Card>

          {userRole === 4 && (
          <Card className="overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 p-3 sm:p-4 hover:bg-muted/40 transition-colors text-left"
              onClick={() => setIsPublicSharingExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground truncate">Compartilhamento público</span>
                <Badge variant={publicAccessEnabled ? 'secondary' : 'outline'} className="shrink-0">
                  {publicAccessEnabled ? 'Ativo' : 'Desativado'}
                </Badge>
              </div>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', isPublicSharingExpanded && 'rotate-180')}
              />
            </button>

            {isPublicSharingExpanded && (
              <div className="border-t border-border p-3 sm:p-4 space-y-3">
                {publicAccessEnabled && publicReaderUrl ? (
                  <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Link de leitura pública</p>
                    <p className="text-xs font-mono break-all">{publicReaderUrl}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Acesso público revogado. Habilite para gerar um link compartilhável.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {!publicAccessEnabled ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleUpdatePublicAccess(true)}
                      disabled={isUpdatingPublicAccess}
                    >
                      {isUpdatingPublicAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                      Habilitar público
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCopyPublicLink()}
                        disabled={isUpdatingPublicAccess || !publicReaderUrl}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedShareLink ? 'Copiado' : 'Copiar link'}
                      </Button>

                      {publicReaderPath && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={publicReaderPath} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </Link>
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleUpdatePublicAccess(true, true)}
                        disabled={isUpdatingPublicAccess}
                      >
                        {isUpdatingPublicAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Regenerar
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleUpdatePublicAccess(false)}
                        disabled={isUpdatingPublicAccess}
                      >
                        {isUpdatingPublicAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Revogar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
          )}

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Páginas da seção</h2>
            </div>

            {sectionImages.length === 0 ? (
              isSectionLoadingImagesInBackground ? (
                <div className="flex items-start gap-2 rounded-md border border-blue-500/25 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
                  <div className="space-y-1">
                    <p className="font-medium">Carregando dados da seção...</p>
                    <p className="text-xs text-blue-700/90 dark:text-blue-300/90">
                      O upload foi recebido e as páginas estão sendo preparadas em background. Isso pode levar alguns segundos.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem páginas cadastradas nesta seção.</p>
              )
            ) : (
              <>
                <div data-tour="images-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sectionImages.slice(0, sectionGridVisibleCount).map((image, idx) => {
                  const translatedAvailable = isImageTranslated(image)
                  const originalViewUrl = buildImageViewUrl(section.id, image.id, 'original')
                  const translatedViewUrl = buildImageViewUrl(section.id, image.id, 'translated')
                  const previewUrl = translatedAvailable ? translatedViewUrl : originalViewUrl
                  const isPreviewLoaded = Boolean(loadedImageUrls[previewUrl])
                  const shouldUseImageOcrOverlay = !translatedAvailable
                  const imageOverlayItems = filterOverlayItemsByHiddenIds(
                    mergeOverlayItems(
                      mergeOverlayItems(
                        toOverlaySeedItems(image),
                        ocrOverlayByImageId[image.id] ?? []
                      ),
                      ocrOverlayManualItemsByImageId[image.id] ?? []
                    ),
                    ocrOverlayHiddenItemIdsByImageId[image.id] ?? []
                  )
                  const imageOverlayReferenceSize = resolveImageOverlayReferenceSize(image)
                  const imageOverlayLoading = Boolean(
                    ocrOverlayLoadingByImageId[image.id]
                    || ocrOverlayCreatingSelectionByImageId[image.id]
                    || ocrOverlayQueuedImageIds.has(image.id)
                  )

                  return (
                    <article
                      key={image.id}
                      className="rounded-md border border-border p-2 space-y-2"
                    >
                      <div className="relative min-h-[180px] overflow-hidden rounded-md border border-border bg-muted/30">
                        {!isPreviewLoaded && (
                          <Skeleton className="absolute inset-0 rounded-none" />
                        )}
                        <img
                          src={previewUrl}
                          alt={`Página ${image.order_index + 1} - ${section.name}`}
                          className={cn(
                            'block h-auto w-full transition-opacity duration-200',
                            isPreviewLoaded ? 'opacity-100' : 'opacity-0'
                          )}
                          loading="lazy"
                          decoding="async"
                          onLoad={(event) => {
                            markImageAsLoaded(previewUrl)
                            const nextReferenceSize = {
                              width: event.currentTarget.naturalWidth,
                              height: event.currentTarget.naturalHeight,
                            }
                            updateImageNaturalSize(
                              image.id,
                              nextReferenceSize.width,
                              nextReferenceSize.height
                            )

                            if (!shouldUseImageOcrOverlay) return

                            if (imageOverlayItems.length > 0) {
                              void ensureOverlayColorsForImage(
                                image.id,
                                previewUrl,
                                imageOverlayItems,
                                nextReferenceSize
                              )
                            }
                          }}
                          onError={() => markImageAsLoaded(previewUrl)}
                        />
                        {shouldUseImageOcrOverlay && imageOverlayItems.length > 0 && (
                          <OcrTextOverlay
                            imageId={image.id}
                            items={imageOverlayItems}
                            referenceSize={imageOverlayReferenceSize}
                            fontScale={ocrOverlayFontScale}
                            boxInsetPercent={ocrOverlayBoxInsetPercent}
                            overlayDensity={ocrOverlayDensity}
                            overlayOpacity={ocrOverlayOpacity}
                            globalShape={ocrOverlayGlobalShape}
                            fontFamilyCss={overlayFontFamilyCss}
                            editable={false}
                            itemOverrides={ocrOverlayOverridesByImageId[image.id] ?? {}}
                            itemColors={ocrOverlayColorsByImageId[image.id] ?? {}}
                            showTranslatingPlaceholder={imageOverlayLoading}
                            textMode={ocrOverlayTextMode}
                          />
                        )}
                        {shouldUseImageOcrOverlay && imageOverlayLoading && (
                          <div className="absolute right-2 top-2 rounded-full border border-blue-500/35 bg-blue-500/15 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-300">
                            OCR...
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openReadingPage(idx)}
                          className="absolute inset-0"
                          aria-label={`Ler página ${image.order_index + 1}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground truncate" title={image.original_name}>
                          Pág. {image.order_index + 1}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {!translatedAvailable && (
                            <Badge variant="outline">{formatStatus(image.status)}</Badge>
                          )}
                          <Badge variant={translatedAvailable ? 'secondary' : 'outline'}>
                            {translatedAvailable ? 'Traduzida' : formatStatus(image.translation_status)}
                          </Badge>
                          {readPages.has(image.id) && (
                            <Badge variant="outline" className="border-green-500/60 text-green-600 dark:text-green-400">
                              Lida
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* <Button size="sm" className="w-full" onClick={() => openReadingPage(idx)}>
                        <BookOpen className="h-4 w-4" />
                        Ler
                      </Button> */}
                    </article>
                  )
                  })}
                </div>
                {sectionGridVisibleCount < sectionImages.length && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {sectionGridVisibleCount} de {sectionImages.length} páginas
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 min-w-[220px] px-4"
                      onClick={() => {
                        setSectionGridVisibleCount((value) => (
                          Math.min(value + SECTION_GRID_LOAD_MORE_BATCH, sectionImages.length)
                        ))
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                      Carregar mais
                    </Button>
                    <div className="h-px w-full max-w-sm bg-border/80" />
                  </div>
                )}
              </>
            )}
          </Card>

          {pageEndSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <span className="text-[11px] text-muted-foreground">Lendo agora</span>
                  <span className="truncate text-[11px] font-semibold text-foreground">{section?.name ?? '—'}</span>
                </div>
                <Link
                  href={`/inicio/secoes/${pageEndSuggestions[0].id}?page=${libraryPage}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 active:scale-[0.98]"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Próximo</p>
                    <p className="truncate text-sm font-bold text-foreground">{pageEndSuggestions[0].name}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">Mais sugestões</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{pageEndSuggestions.length} mangás</span>
                </div>

                <div className="relative">
                  <div
                    ref={suggestionsScrollRef}
                    onScroll={() => {
                      const el = suggestionsScrollRef.current
                      if (!el) return
                      setSuggestionsCanScrollLeft(el.scrollLeft > 4)
                      setSuggestionsCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
                    }}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none divide-x divide-border"
                  >
                    {pageEndSuggestions.map((suggestion, idx) => {
                      const coverUrl = suggestion.cover?.image_id
                        ? buildImageViewUrl(suggestion.id, suggestion.cover.image_id, 'original')
                        : null
                      return (
                        <Link
                          key={suggestion.id}
                          href={`/inicio/secoes/${suggestion.id}?page=${libraryPage}`}
                          className="group relative shrink-0 snap-start w-40 sm:w-48 overflow-hidden block"
                        >
                          <div className="relative aspect-3/4 w-full">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={suggestion.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-muted">
                                <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <div className="absolute top-2 left-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/50 px-1.5 backdrop-blur-sm">
                              <span className="text-[10px] font-bold tabular-nums text-white/80">{idx + 1}</span>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-3">
                              <p className="text-xs font-semibold leading-snug text-white line-clamp-2 drop-shadow">
                                {suggestion.name}
                              </p>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {suggestionsCanScrollLeft && (
                    <button
                      type="button"
                      onClick={() => suggestionsScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}

                  {suggestionsCanScrollRight && (
                    <button
                      type="button"
                      onClick={() => suggestionsScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:bg-black/80"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(limitModalState)}
        onOpenChange={(open) => {
          if (!open) {
            setLimitModalState(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{limitModalState?.title ?? 'Limite atingido'}</DialogTitle>
            <DialogDescription>{limitModalState?.description ?? ''}</DialogDescription>
          </DialogHeader>
          {limitModalState?.details && (
            <p className="text-xs text-muted-foreground">{limitModalState.details}</p>
          )}
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="text-sm font-medium text-foreground">Quer continuar traduzindo agora?</p>
            <p className="text-xs text-muted-foreground">
              Ajuste os limites locais da instância para continuar sem pausa.
            </p>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setLimitModalState(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteCategoryDialogOpen}
        onOpenChange={(open) => {
          if (isDeletingCategory) return
          setIsDeleteCategoryDialogOpen(open)
          if (!open) {
            setCategoryToDelete('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{categoryToDelete}" será excluída.
              Todas as seções vinculadas a essa categoria ficarão sem categoria.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCategory}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteCategory()
              }}
              disabled={isDeletingCategory}
            >
              {isDeletingCategory ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                'Deletar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingSection) {
            setIsDeleteDialogOpen(open)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir seção</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai remover a seção "{section?.name ?? `#${sectionId}`}" e todos os vínculos dela.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSection}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSection()
              }}
              disabled={isDeletingSection}
            >
              {isDeletingSection ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar exclusão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SpotlightTour
        storageKey="tour-reader-v2"
        open={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={READER_TOUR_STEPS}
      />
    </div>
  )
}

const READER_TOUR_STEPS: TourStep[] = [
  {
    title: 'Página da seção',
    description: 'Bem-vindo! Aqui você gerencia as páginas deste capítulo — seleciona quais traduzir, acompanha o progresso e lê o resultado. Siga os passos para conhecer cada recurso.',
  },
  {
    title: 'Informações da seção',
    description: 'Veja o nome, status atual, idiomas e outros detalhes. As badges mostram em tempo real se há páginas na fila, sendo processadas ou com erro.',
    selector: 'section-info',
    tooltipSide: 'bottom',
  },
  {
    title: 'Visualize as páginas',
    description: 'As páginas da seção ficam listadas aqui com status e preview. Toque em qualquer página para abrir no leitor.',
    selector: 'images-grid',
    tooltipSide: 'top',
  },
  {
    title: 'Modo de leitura',
    description: 'Após a tradução, toque aqui para ler as páginas como um leitor de mangá. Você pode navegar por toque ou teclado, fazer zoom, e alternar entre paginação e scroll contínuo.',
    selector: 'reading-btn',
    tooltipSide: 'bottom',
  },
]

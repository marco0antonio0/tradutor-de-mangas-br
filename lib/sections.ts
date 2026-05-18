export interface SectionCover {
  image_id: number
  mime: string
  view_url: string
  download_url: string
}

export interface SectionPublicAccess {
  enabled: boolean
  key: string | null
  url: string | null
}

export interface SectionListItem {
  id: number
  name: string
  category?: string | null
  category_id?: number | null
  priority: number
  status: string
  internal_status: string
  source_lang: string
  target_lang: string
  include_logs: boolean
  provider_lang?: string | null
  images_count: number
  selected_images_count: number
  queued_images_count: number
  processing_images_count: number
  cover?: SectionCover | null
  public_access?: SectionPublicAccess | null
  created_at: string
  updated_at: string
}

export interface SectionListPaginationMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
  from: number | null
  to: number | null
}

export interface SectionListPaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}

export interface SectionListResponseEnvelope {
  data?: unknown
  meta?: unknown
  links?: unknown
  items?: unknown
  results?: unknown
  sections?: unknown
  message?: string
  error?: string
}

export interface ResolvedSectionListResponse {
  sections: SectionListItem[]
  meta: SectionListPaginationMeta | null
  links: SectionListPaginationLinks | null
}

function asRecordObject(value: unknown) {
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

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return fallback
  return Math.max(1, Math.floor(parsed))
}

function toNonNegativeInteger(value: unknown, fallback: number) {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return fallback
  return Math.max(0, Math.floor(parsed))
}

function normalizePaginationLinks(value: unknown) {
  if (Array.isArray(value)) {
    const firstLink = value.find((item) => {
      const link = asRecordObject(item)
      return link && typeof link.label === 'string' && /first/i.test(link.label)
    })
    const lastLink = value.find((item) => {
      const link = asRecordObject(item)
      return link && typeof link.label === 'string' && /last/i.test(link.label)
    })
    const prevLink = value.find((item) => {
      const link = asRecordObject(item)
      return link && typeof link.label === 'string' && /previous|prev/i.test(link.label)
    })
    const nextLink = value.find((item) => {
      const link = asRecordObject(item)
      return link && typeof link.label === 'string' && /next/i.test(link.label)
    })

    const firstLinkRecord = asRecordObject(firstLink)
    const lastLinkRecord = asRecordObject(lastLink)
    const prevLinkRecord = asRecordObject(prevLink)
    const nextLinkRecord = asRecordObject(nextLink)

    return {
      first: typeof firstLinkRecord?.url === 'string' ? firstLinkRecord.url : null,
      last: typeof lastLinkRecord?.url === 'string' ? lastLinkRecord.url : null,
      prev: typeof prevLinkRecord?.url === 'string' ? prevLinkRecord.url : null,
      next: typeof nextLinkRecord?.url === 'string' ? nextLinkRecord.url : null,
    }
  }

  const root = asRecordObject(value)
  if (!root) return null

  const first = typeof root.first === 'string' ? root.first : null
  const last = typeof root.last === 'string' ? root.last : null
  const prev = typeof root.prev === 'string' ? root.prev : null
  const next = typeof root.next === 'string' ? root.next : null

  return {
    first,
    last,
    prev,
    next,
  }
}

function normalizePaginationMeta(
  value: unknown,
  fallback: { currentPage: number; perPage: number; total: number }
) {
  const root = asRecordObject(value)

  const currentPage = toPositiveInteger(root?.current_page ?? root?.page, fallback.currentPage)
  const perPage = toPositiveInteger(root?.per_page ?? root?.perPage, fallback.perPage)
  const total = toNonNegativeInteger(root?.total ?? root?.total_items, fallback.total)
  const lastPageFromMeta = toPositiveInteger(
    root?.last_page ?? root?.total_pages,
    Math.max(1, Math.ceil(total / perPage))
  )

  const fromValue = toFiniteNumber(root?.from)
  const toValue = toFiniteNumber(root?.to)

  return {
    current_page: currentPage,
    per_page: perPage,
    total,
    last_page: Math.max(1, lastPageFromMeta),
    from: fromValue === null ? null : Math.max(0, Math.floor(fromValue)),
    to: toValue === null ? null : Math.max(0, Math.floor(toValue)),
  }
}

export function resolveSectionListResponse(
  payload: unknown,
  fallbackPageSize: number
): ResolvedSectionListResponse {
  if (Array.isArray(payload)) {
    const sections = payload as SectionListItem[]
    const perPage = toPositiveInteger(fallbackPageSize, sections.length || 1)
    const total = sections.length
    const lastPage = Math.max(1, Math.ceil(total / perPage))

    return {
      sections,
      meta: {
        current_page: 1,
        per_page: perPage,
        total,
        last_page: lastPage,
        from: total === 0 ? null : 1,
        to: total === 0 ? null : total,
      },
      links: null,
    }
  }

  const root = asRecordObject(payload)
  if (!root) {
    return {
      sections: [],
      meta: null,
      links: null,
    }
  }

  const sectionsSource =
    root.data ?? root.items ?? root.results ?? root.sections ?? []
  const sections = Array.isArray(sectionsSource) ? (sectionsSource as SectionListItem[]) : []
  const meta = normalizePaginationMeta(root.meta, {
    currentPage: 1,
    perPage: fallbackPageSize,
    total: sections.length,
  })

  return {
    sections,
    meta,
    links: normalizePaginationLinks(root.links),
  }
}

export interface SectionImageOcrItem {
  id: number
  section_image_id: number
  det_id: number
  cls_name: string
  conf: number
  box: [number, number, number, number]
  ocr_text: string | null
  ocr_error: string | null
  translated_text: string | null
  translation_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface SectionImageOcr {
  total_boxes: number
  translated_boxes: number
  has_boxes: boolean
  items: SectionImageOcrItem[]
}

export interface SectionImage {
  id: number
  order_index: number
  original_name: string
  mime: string
  size_bytes: number
  status: string
  translation_status: string
  selected_for_processing: boolean
  translation_error: string | null
  translated_mime?: string | null
  translated_size_bytes?: number | null
  translated_width?: number | null
  translated_height?: number | null
  detections_count?: number | null
  elapsed_ms?: number | null
  source_lang?: string | null
  target_lang?: string | null
  slowest_stage?: string | null
  has_logs?: boolean
  ocr_cache_url?: string | null
  ocr?: SectionImageOcr | null
  original_url: string
  translated_url: string | null
}

export interface SectionQueueSnapshot {
  active_job_id: number | null
  active_job_status: string | null
  queue_position: number | null
  jobs_ahead: number
  estimated_wait_seconds: number
  estimated_wait_minutes: number
  estimated_start_at: string | null
  avg_ms_per_image_reference: number | null
}

export interface SectionJobQueueSnapshot {
  queue_position?: number | null
  jobs_ahead?: number | null
  estimated_wait_seconds?: number | null
  estimated_wait_minutes?: number | null
  estimated_start_at?: string | null
  avg_ms_per_image_reference?: number | null
}

export interface SectionJobSnapshot {
  id?: number | null
  status?: string | null
  avg_ms_per_image_snapshot?: number | null
  estimated_start_at?: string | null
  queue?: SectionJobQueueSnapshot | null
}

export interface SectionDetail extends SectionListItem {
  queue?: SectionQueueSnapshot | null
  images: SectionImage[]
  jobs: SectionJobSnapshot[]
}

export interface PublicSectionImage {
  id: number
  order_index: number
  original_name: string
  mime: string
  size_bytes: number
  status: string
  translation_status: string
  translated_mime: string | null
  translated_size_bytes: number | null
  translated_width: number | null
  translated_height: number | null
  original_url: string
  translated_url: string | null
}

export interface PublicSectionDetail {
  id: number
  name: string
  status: string
  source_lang: string
  target_lang: string
  created_at: string
  updated_at: string
  shared_key: string
  images: PublicSectionImage[]
}

export interface QueueResponse {
  message?: string
}

export interface QueueState {
  canQueue: boolean
  inQueueOrProcessing: boolean
  completed: boolean
}

const QUEUE_OR_PROCESSING_STATUSES = new Set([
  'queued',
  'queue',
  'em_fila',
  'na_fila',
  'processing',
  'processando',
  'in_progress',
  'running',
  'em_andamento',
  'translating',
  'traduzindo',
])

const COMPLETED_SECTION_STATUSES = new Set([
  'completed',
  'done',
  'finished',
  'success',
  'sucesso',
  'concluido',
  'concluida',
  'all_done',
])

const TRANSLATED_IMAGE_STATUSES = new Set([
  'translated',
  'done',
  'completed',
  'success',
  'sucesso',
  'concluido',
  'concluida',
])

export function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

export function formatStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return 'desconhecido'
  return normalized.replace(/_/g, ' ')
}

export function formatSectionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

export type SectionPriorityTier = 'low' | 'high_essential' | 'high_impulso' | 'high_elite' | 'admin' | 'custom'

export interface SectionPriorityInfo {
  value: number
  tier: SectionPriorityTier
  badgeLabel: string
  description: string
}

function toPriorityNumber(priority: number | null | undefined) {
  if (typeof priority === 'number' && Number.isFinite(priority)) {
    return Math.max(0, Math.floor(priority))
  }
  return 0
}

export function getSectionPriorityInfo(priority: number | null | undefined): SectionPriorityInfo {
  const value = toPriorityNumber(priority)

  if (value === 10) {
    return {
      value,
      tier: 'admin',
      badgeLabel: 'P10 - Admin',
      description: 'Prioridade admin',
    }
  }

  if (value === 7) {
    return {
      value,
      tier: 'high_impulso',
      badgeLabel: 'P7 - Maxima (Impulso)',
      description: 'Prioridade maxima (Plano Impulso)',
    }
  }

  if (value === 8) {
    return {
      value,
      tier: 'high_elite',
      badgeLabel: 'P8 - Ultra (Elite)',
      description: 'Prioridade ultra (Plano Elite)',
    }
  }

  if (value === 5) {
    return {
      value,
      tier: 'high_essential',
      badgeLabel: 'P5 - Alta (Essencial)',
      description: 'Prioridade alta (Plano Essencial)',
    }
  }

  if (value === 2) {
    return {
      value,
      tier: 'low',
      badgeLabel: 'P2 - Baixa',
      description: 'Prioridade baixa',
    }
  }

  return {
    value,
    tier: 'custom',
    badgeLabel: 'P' + value + ' - Personalizada',
    description: 'Prioridade personalizada (P' + value + ')',
  }
}

export function toErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const maybeMessage = (payload as { message?: string; error?: string }).message
      || (payload as { message?: string; error?: string }).error
    if (maybeMessage) return maybeMessage
  }
  return fallback
}

export function isImageTranslated(image: SectionImage) {
  const translationStatus = normalizeStatus(image.translation_status)
  return Boolean(image.translated_url) || TRANSLATED_IMAGE_STATUSES.has(translationStatus)
}

export function buildImageViewUrl(sectionId: number, imageId: number, kind: 'original' | 'translated') {
  return `/api/sections/${sectionId}/images/${imageId}/${kind}/view`
}

export function buildPublicImageViewUrl(
  sharedKey: string,
  imageId: number,
  kind: 'original' | 'translated'
) {
  return `/api/public/sections/${encodeURIComponent(sharedKey)}/images/${imageId}/${kind}/view`
}

export function buildPublicReaderPath(sharedKey: string) {
  return `/publico/secoes/${encodeURIComponent(sharedKey)}`
}

export function buildPublicReaderUrl(sharedKey: string) {
  const path = buildPublicReaderPath(sharedKey)
  const configuredBaseUrl = 'http://localhost:3080'

  if (configuredBaseUrl) {
    try {
      return new URL(path, configuredBaseUrl).toString()
    } catch {
      // Ignora URL malformada de ambiente e usa fallback local.
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }

  return path
}

export function getSectionQueueState(
  section: Pick<SectionListItem, 'id' | 'status' | 'internal_status' | 'queued_images_count' | 'processing_images_count'>,
  detail: Pick<SectionDetail, 'id' | 'images'> | null
): QueueState {
  const normalizedStatus = normalizeStatus(section.status)
  const normalizedInternalStatus = normalizeStatus(section.internal_status)
  const statuses = [normalizedStatus, normalizedInternalStatus]

  const hasQueuedOrProcessingCounters =
    section.queued_images_count > 0 || section.processing_images_count > 0
  const inQueueOrProcessing =
    hasQueuedOrProcessingCounters || statuses.some((status) => QUEUE_OR_PROCESSING_STATUSES.has(status))
  const completedByStatus = statuses.some((status) => COMPLETED_SECTION_STATUSES.has(status))
  const completedByImages =
    detail?.id === section.id
    && detail.images.length > 0
    && detail.images.every((image) => isImageTranslated(image))

  return {
    canQueue: !(inQueueOrProcessing || completedByStatus || completedByImages),
    inQueueOrProcessing,
    completed: completedByStatus || completedByImages,
  }
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toErrorMessage } from '@/lib/sections'
import { Check, ChevronDown, ChevronUp, FileImage, FileText, HelpCircle, Loader2, PlayCircle, Save, Sparkles, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { SpotlightTour, checkTourDone, type TourStep } from '@/components/spotlight-tour'

interface LanguageOption {
  code: string
  name: string
}

interface PreparedUploadItem {
  id: string
  sourceName: string
  files: File[]
  rawPdf?: File
}

type BatchPdfUploadPhase = 'pending' | 'preparing' | 'uploading' | 'assigning-category' | 'success' | 'error'

interface BatchPdfUploadStatus {
  phase: BatchPdfUploadPhase
  message: string
  processedPages?: number
  totalPages?: number
}

interface PreparingState {
  currentFileName: string
  currentFileIndex: number
  totalFiles: number
  processedPages: number
  totalPages: number
}

interface SectionCategoryResponse {
  category?: unknown
  categories?: unknown
  category_items?: unknown
  deleted_sections_count?: unknown
  message?: string
  error?: string
}

interface OpenRouterStatusPayload {
  isValid?: boolean
  availableModels?: string[]
  selectedModel?: string | null
}

type UploadMode = 'pdf' | 'pdf-batch' | 'images'

const STATIC_LANGUAGES: LanguageOption[] = [
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
const DEFAULT_SOURCE_LANG = 'en'
const DEFAULT_TARGET_LANG = 'pt-BR'

const MAX_BATCH_PDFS = 3
const MAX_BATCH_PDFS_ROLE4 = 10
const SECTION_CATEGORY_MAX_LENGTH = 64


function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name)
}

function getPdfBaseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, '')
}

function buildSectionNameSuggestionFromPdf(fileName: string) {
  return getPdfBaseName(fileName)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSectionNameSuggestionFromImage(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function createUploadItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getInitialBatchPdfUploadStatus(): BatchPdfUploadStatus {
  return {
    phase: 'pending',
    message: 'Aguardando envio.',
  }
}

function getBatchPdfPhaseMeta(phase: BatchPdfUploadPhase) {
  if (phase === 'preparing') {
    return {
      label: 'Extraindo',
      className: 'text-violet-600 dark:text-violet-400',
    }
  }

  if (phase === 'uploading') {
    return {
      label: 'Enviando',
      className: 'text-blue-600 dark:text-blue-400',
    }
  }

  if (phase === 'assigning-category') {
    return {
      label: 'Categorizando',
      className: 'text-indigo-600 dark:text-indigo-400',
    }
  }

  if (phase === 'success') {
    return {
      label: 'Concluído',
      className: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (phase === 'error') {
    return {
      label: 'Erro',
      className: 'text-red-600 dark:text-red-400',
    }
  }

  return {
    label: 'Na fila',
    className: 'text-muted-foreground',
  }
}

function getPreparingOverallProgress(state: PreparingState | null) {
  if (!state || state.totalFiles <= 0) return 0

  const filesDoneBeforeCurrent = Math.max(0, state.currentFileIndex - 1)
  const currentFileProgress = state.totalPages > 0
    ? Math.min(1, state.processedPages / state.totalPages)
    : 0

  const overall = ((filesDoneBeforeCurrent + currentFileProgress) / state.totalFiles) * 100
  return Math.min(100, Math.max(0, overall))
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
    limite: root.limite ?? nestedUser.limite,
    gerado: root.gerado ?? nestedUser.gerado,
    limit_page_upload: root.limit_page_upload ?? nestedUser.limit_page_upload,
  }
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeSectionCategoryValue(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, SECTION_CATEGORY_MAX_LENGTH)
}

function toSectionCategoryKey(value: string) {
  return normalizeSectionCategoryValue(value).toLocaleLowerCase('pt-BR')
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
}

function getHardwareConcurrency() {
  if (typeof navigator === 'undefined') return 4
  const cores = Number(navigator.hardwareConcurrency)
  if (!Number.isFinite(cores) || cores <= 0) return 4
  return Math.floor(cores)
}

function getDeviceMemoryGb() {
  if (typeof navigator === 'undefined') return null
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
  if (!Number.isFinite(memory) || memory <= 0) return null
  return memory
}

function yieldToUI() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function getPdfParallelChunksDefault() {
  return 4
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao converter página para imagem.'))),
      mimeType,
      quality
    )
  )
}

let _canvasWebpSupport: boolean | null = null

function canEncodeCanvasWebp() {
  if (_canvasWebpSupport !== null) return _canvasWebpSupport
  if (typeof document === 'undefined') {
    _canvasWebpSupport = false
    return _canvasWebpSupport
  }

  try {
    const probe = document.createElement('canvas')
    probe.width = 2
    probe.height = 2
    const dataUrl = probe.toDataURL('image/webp', 0.8)
    _canvasWebpSupport = dataUrl.startsWith('data:image/webp')
  } catch {
    _canvasWebpSupport = false
  }

  return _canvasWebpSupport
}

// Cache do pdfjs para evitar reimportar a cada chamada
let _pdfjsLib: typeof import('pdfjs-dist') | null = null

async function getPdfjsLib() {
  if (!_pdfjsLib) {
    const lib = await import('pdfjs-dist')
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    _pdfjsLib = lib
  }
  return _pdfjsLib
}

async function extractPdfToImages(
  pdfFile: File,
  onProgress: (processedPages: number, totalPages: number) => void,
  options?: { maxPages?: number | null; parallelChunks?: number | null }
): Promise<File[]> {
  const pdfjsLib = await getPdfjsLib()

  const mobile = isMobileDevice()
  const useWebp = canEncodeCanvasWebp()
  const mimeType = useWebp ? 'image/webp' : 'image/jpeg'
  const ext = useWebp ? 'webp' : 'jpg'

  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise

  const totalPages = pdf.numPages
  const maxPages = typeof options?.maxPages === 'number' ? Math.max(1, Math.floor(options.maxPages)) : null
  if (maxPages !== null && totalPages > maxPages) {
    throw new Error(`PDF possui ${totalPages} páginas e excede o limite de ${maxPages} páginas por seção.`)
  }
  const baseName = getPdfBaseName(pdfFile.name)
  const results: File[] = new Array(totalPages)

  const hardwareConcurrency = getHardwareConcurrency()
  const deviceMemoryGb = getDeviceMemoryGb()
  const lowMemoryDevice = deviceMemoryGb !== null && deviceMemoryGb <= 4
  const firstPage = await pdf.getPage(1)
  const baseViewport = firstPage.getViewport({ scale: 1 })
  firstPage.cleanup()
  const baseArea = Math.max(1, baseViewport.width * baseViewport.height)

  const fileSizeMb = pdfFile.size / (1024 * 1024)
  const isHugePdf = totalPages >= 120 || fileSizeMb >= 120
  const isLargePdf = totalPages >= 60 || fileSizeMb >= 60

  const targetMegaPixels = mobile
    ? (isHugePdf ? 0.75 : isLargePdf ? 0.95 : 1.2)
    : (isHugePdf ? 1.2 : isLargePdf ? 1.6 : 2.0)
  const tunedMegaPixels = lowMemoryDevice
    ? Math.max(0.7, targetMegaPixels - (mobile ? 0.1 : 0.3))
    : targetMegaPixels

  const maxScale = mobile ? 1.45 : 1.7
  const minScale = mobile ? 0.85 : 1.0
  const dynamicScale = Math.sqrt((tunedMegaPixels * 1_000_000) / baseArea)
  const scale = Math.min(maxScale, Math.max(minScale, dynamicScale))

  const imageQuality = useWebp
    ? (
      mobile
        ? (isLargePdf ? 0.64 : 0.68)
        : (isHugePdf ? 0.68 : isLargePdf ? 0.72 : 0.76)
    )
    : (
      mobile
        ? (isLargePdf ? 0.68 : 0.72)
        : (isHugePdf ? 0.72 : isLargePdf ? 0.76 : 0.8)
    )

  // Mais slots para máquinas mais fortes; limitamos para evitar estouro de memória.
  const highEndDesktop = !mobile && !lowMemoryDevice && hardwareConcurrency >= 8
  const concurrencyCap = mobile ? 4 : (highEndDesktop ? 12 : (lowMemoryDevice ? 6 : 9))
  const baseConcurrency = Math.max(2, Math.floor(hardwareConcurrency / (mobile ? 2 : 1.5)))
  const hugePdfPenalty = isHugePdf ? 2 : 0
  const concurrency = Math.max(
    1,
    Math.min(concurrencyCap, totalPages, baseConcurrency - hugePdfPenalty)
  )
  onProgress(0, totalPages)

  let completedCount = 0
  const requestedChunks = Math.max(1, Math.floor(options?.parallelChunks ?? getPdfParallelChunksDefault()))
  const chunkCount = Math.max(1, Math.min(requestedChunks, totalPages))
  const pagesPerChunk = Math.ceil(totalPages / chunkCount)

  type ChunkRange = { start: number; end: number }
  const ranges: ChunkRange[] = []
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * pagesPerChunk + 1
    const end = Math.min(totalPages, start + pagesPerChunk - 1)
    if (start <= end) ranges.push({ start, end })
  }

  const workersPerChunk = Math.max(1, Math.floor(concurrency / Math.max(1, ranges.length)))

  async function runChunk(range: ChunkRange) {
    const pagesInChunk = range.end - range.start + 1
    const chunkConcurrency = Math.max(1, Math.min(workersPerChunk, pagesInChunk))
    const slots = Array.from({ length: chunkConcurrency }, () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { alpha: false })!
      return { canvas, ctx }
    })

    async function runSlot(slotIndex: number) {
      const slot = slots[slotIndex]!
      let pendingBlob: Promise<Blob> | null = null
      let pendingPageNum = -1

      for (
        let pageNum = range.start + slotIndex;
        pageNum <= range.end;
        pageNum += chunkConcurrency
      ) {
        if (((pageNum - range.start) / chunkConcurrency) % 8 === 0) {
          await yieldToUI()
        }

        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        slot.canvas.width = viewport.width
        slot.canvas.height = viewport.height

        await page.render({ canvasContext: slot.ctx, viewport }).promise
        page.cleanup()

        const currentBlob = canvasToBlob(slot.canvas, mimeType, imageQuality)

        if (pendingBlob !== null) {
          const blob = await pendingBlob
          results[pendingPageNum - 1] = new File([blob], `${baseName}_p${pendingPageNum}.${ext}`, { type: mimeType })
          completedCount++
          onProgress(completedCount, totalPages)
        }

        pendingBlob = currentBlob
        pendingPageNum = pageNum
      }

      if (pendingBlob !== null) {
        const blob = await pendingBlob
        results[pendingPageNum - 1] = new File([blob], `${baseName}_p${pendingPageNum}.${ext}`, { type: mimeType })
        completedCount++
        onProgress(completedCount, totalPages)
      }

      slot.canvas.width = 0
      slot.canvas.height = 0
    }

    await Promise.all(
      Array.from({ length: chunkConcurrency }, (_, i) => runSlot(i))
    )
  }

  await Promise.all(ranges.map((range) => runChunk(range)))

  pdf.cleanup()
  pdf.destroy()

  return results.filter((file): file is File => Boolean(file))
}

function normalizeSectionCategoryOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]

  const seen = new Set<string>()
  const options: string[] = []

  for (const item of value) {
    const normalized = normalizeSectionCategoryValue(item)
    if (!normalized) continue

    const key = toSectionCategoryKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    options.push(normalized)

    if (options.length >= 200) break
  }

  options.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  return options
}

function resolveSectionCategoryNames(payload: SectionCategoryResponse) {
  const fromCategories = normalizeSectionCategoryOptions(payload.categories)
  if (fromCategories.length > 0) return fromCategories

  const rawItems = Array.isArray(payload.category_items) ? payload.category_items : []
  const names = rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const name = (item as { name?: unknown }).name
      return typeof name === 'string' ? name : ''
    })
    .filter(Boolean)

  return normalizeSectionCategoryOptions(names)
}

export function SectionCreateForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const sectionCategoryTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sectionCategorySkipCloseCommitRef = useRef(false)

  const [uploadMode, setUploadMode] = useState<UploadMode>('pdf')
  const [name, setName] = useState('')
  const [nameSuggestion, setNameSuggestion] = useState('')
  const [sourceLang, setSourceLang] = useState(DEFAULT_SOURCE_LANG)
  const [targetLang, setTargetLang] = useState(DEFAULT_TARGET_LANG)
  const [providerLang, setProviderLang] = useState<'google' | 'openrouter'>('google')
  const [openRouterModel, setOpenRouterModel] = useState('')
  const [uploadItems, setUploadItems] = useState<PreparedUploadItem[]>([])
  const [batchPdfStatusByItemId, setBatchPdfStatusByItemId] = useState<Record<string, BatchPdfUploadStatus>>({})
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPreparingUploads, setIsPreparingUploads] = useState(false)
  const [preparingState, setPreparingState] = useState<PreparingState | null>(null)
  const [isCreatingSection, setIsCreatingSection] = useState(false)
  const [userRole, setUserRole] = useState<number | null>(null)
  const [pageUploadLimit, setPageUploadLimit] = useState<number | null>(null)
  const [isLoadingRole, setIsLoadingRole] = useState(true)
  const [roleError, setRoleError] = useState('')
  const [configExpanded, setConfigExpanded] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [monthlyUsage, setMonthlyUsage] = useState<{ limit: number | null; generated: number | null }>({
    limit: null,
    generated: null,
  })
  const [sectionCategoryDraft, setSectionCategoryDraft] = useState('')
  const [sectionCategoryOptions, setSectionCategoryOptions] = useState<string[]>([])
  const [sectionCategoryQuery, setSectionCategoryQuery] = useState('')
  const [isSectionCategoryPopoverOpen, setIsSectionCategoryPopoverOpen] = useState(false)
  const [sectionCategoryPopoverWidth, setSectionCategoryPopoverWidth] = useState<number | null>(null)
  const [isSectionCategoryLoading, setIsSectionCategoryLoading] = useState(false)
  const [isSectionCategorySaving, setIsSectionCategorySaving] = useState(false)
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState('')
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)

  const sourceLanguageOptions = STATIC_LANGUAGES
  const targetLanguageOptions = STATIC_LANGUAGES.filter((o) => o.code !== 'auto')

  const priorityValue = useMemo(() => {
    if (userRole !== null && userRole >= 4) return '10'
    return '2'
  }, [userRole])

  const priorityLabel = useMemo(() => {
    if (priorityValue === '10') return 'Admin (P10)'
    return 'Baixa (P2)'
  }, [priorityValue])
  const canUsePdfBatch = true
  const isRole4OrAbove = useMemo(
    () => userRole !== null && userRole >= 4,
    [userRole]
  )
  const remainingSectionQuota = useMemo(() => {
    if (monthlyUsage.limit === null || monthlyUsage.generated === null) return null
    if (monthlyUsage.limit <= 0) return null
    return Math.max(0, Math.floor(monthlyUsage.limit - monthlyUsage.generated))
  }, [monthlyUsage.generated, monthlyUsage.limit])
  const batchPlanCap = useMemo(
    () => (isRole4OrAbove ? MAX_BATCH_PDFS_ROLE4 : MAX_BATCH_PDFS),
    [isRole4OrAbove]
  )
  const maxBatchPdfsAllowedNow = useMemo(() => {
    if (remainingSectionQuota === null) return batchPlanCap
    if (batchPlanCap === null) return remainingSectionQuota
    return Math.min(batchPlanCap, remainingSectionQuota)
  }, [batchPlanCap, remainingSectionQuota])
  const hasBatchErrors = useMemo(
    () => uploadMode === 'pdf-batch' && uploadItems.some((item) => batchPdfStatusByItemId[item.id]?.phase === 'error'),
    [uploadMode, uploadItems, batchPdfStatusByItemId]
  )
  const files = useMemo(
    () => uploadItems.flatMap((item) => item.files),
    [uploadItems]
  )
  const hasLoadedPdf = uploadItems.length > 0
  const sourcePdfCount = useMemo(
    () => uploadItems.length,
    [uploadItems]
  )
  const preparingOverallProgress = useMemo(
    () => getPreparingOverallProgress(preparingState),
    [preparingState]
  )

  useEffect(() => {
    let cancelled = false

    const warmupPdfRuntime = () => {
      if (cancelled) return
      void getPdfjsLib().catch(() => {
        // aquecimento opcional; falhas não devem impactar o fluxo normal
      })
    }

    if (typeof window === 'undefined') return
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(warmupPdfRuntime, { timeout: 1500 })
      return () => {
        cancelled = true
        if (typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleId)
        }
      }
    }

    const timeoutId = globalThis.setTimeout(warmupPdfRuntime, 300)
    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const fetchUserRole = async () => {
      setIsLoadingRole(true)
      setRoleError('')
      setMonthlyUsage({ limit: null, generated: null })

      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = (await response.json()) as Record<string, unknown>
        const mePayload = resolveAuthMePayload(data)

        if (response.status === 401) {
          setRoleError('Sessão inválida. Faça login novamente.')
          return
        }

        if (!response.ok) {
          throw new Error(toErrorMessage(data, 'Não foi possível carregar seu perfil.'))
        }

        const parsedRoleValue = toFiniteNumber(mePayload.role)
        const parsedRole = parsedRoleValue === null ? null : Math.floor(parsedRoleValue)
        setUserRole(parsedRole)

        setMonthlyUsage({
          limit: toFiniteNumber(mePayload.limite),
          generated: toFiniteNumber(mePayload.gerado),
        })

        const rawLimit = mePayload.limit_page_upload
        if (typeof rawLimit === 'number' && Number.isFinite(rawLimit)) {
          setPageUploadLimit(rawLimit)
        } else if (typeof rawLimit === 'string') {
          const parsed = Number(rawLimit)
          if (Number.isFinite(parsed)) setPageUploadLimit(parsed)
        }

      } catch (err) {
        setRoleError(err instanceof Error ? err.message : 'Falha ao obter role do usuário.')
        setMonthlyUsage({ limit: null, generated: null })
      } finally {
        setIsLoadingRole(false)
      }
    }

    void fetchUserRole()
  }, [router])

  useEffect(() => {
    let cancelled = false
    const loadOpenRouterStatus = async () => {
      try {
        const response = await fetch('/api/openrouter', { cache: 'no-store' })
        const data = (await response.json()) as OpenRouterStatusPayload
        if (cancelled || !response.ok) return

        if (!data.isValid) return
        const models = Array.isArray(data.availableModels) ? data.availableModels : []
        if (models.length === 0) return

        const selectedModel = typeof data.selectedModel === 'string' ? data.selectedModel : ''
        const nextModel = selectedModel && models.includes(selectedModel)
          ? selectedModel
          : (models[0] || '')
        if (!nextModel) return
        setOpenRouterModel(nextModel)
      } catch {
        // OpenRouter opcional
      }
    }
    void loadOpenRouterStatus()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (uploadMode === 'pdf-batch' && !canUsePdfBatch) {
      setUploadMode('pdf')
      setUploadItems([])
      setBatchPdfStatusByItemId({})
      setPreparingState(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }, [canUsePdfBatch, uploadMode])

  useEffect(() => {
    setBatchPdfStatusByItemId((previous) => {
      if (uploadMode !== 'pdf-batch') {
        if (Object.keys(previous).length === 0) return previous
        return {}
      }

      const next: Record<string, BatchPdfUploadStatus> = {}
      let changed = false

      for (const item of uploadItems) {
        const existing = previous[item.id]
        if (existing) {
          next[item.id] = existing
        } else {
          next[item.id] = getInitialBatchPdfUploadStatus()
          changed = true
        }
      }

      if (Object.keys(previous).length !== Object.keys(next).length) {
        changed = true
      }

      return changed ? next : previous
    })
  }, [uploadItems, uploadMode])

  useEffect(() => {
    const handler = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force
      if (force || !checkTourDone('tour-create-v2')) {
        setIsTourOpen(true)
      }
    }
    window.addEventListener('open-page-tour', handler)
    return () => window.removeEventListener('open-page-tour', handler)
  }, [])

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
  }, [isSectionCategoryPopoverOpen])

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      setIsSectionCategoryLoading(true)
      try {
        const response = await fetch('/api/sections/categories', { cache: 'no-store' })
        const data = (await response.json()) as SectionCategoryResponse

        if (cancelled) return

        if (response.status === 401) {
          setSectionCategoryOptions([])
          return
        }

        if (!response.ok) {
          setSectionCategoryOptions([])
          return
        }

        setSectionCategoryOptions(resolveSectionCategoryNames(data))
      } catch {
        if (cancelled) return
        setSectionCategoryOptions([])
      } finally {
        if (!cancelled) {
          setIsSectionCategoryLoading(false)
        }
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [router])

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

  const handleEnsureGlobalCategory = async (rawCategory: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(rawCategory)
    if (!normalizedCategory) return false

    const alreadyExists = sectionCategoryOptions.some(
      (category) => toSectionCategoryKey(category) === toSectionCategoryKey(normalizedCategory)
    )
    if (alreadyExists) return true

    setIsSectionCategorySaving(true)
    try {
      const response = await fetch('/api/sections/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: normalizedCategory }),
      })
      const data = (await response.json()) as SectionCategoryResponse

      if (response.status === 401) {
        return false
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível salvar a categoria.'))
      }

      setSectionCategoryOptions(resolveSectionCategoryNames(data))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar categoria.')
      return false
    } finally {
      setIsSectionCategorySaving(false)
    }
  }

  const handleSelectSectionCategory = (rawCategory: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(rawCategory)
    sectionCategorySkipCloseCommitRef.current = true
    setSectionCategoryQuery('')
    setIsSectionCategoryPopoverOpen(false)
    setSectionCategoryDraft(normalizedCategory)

    if (!normalizedCategory) return
    void handleEnsureGlobalCategory(normalizedCategory)
  }

  const handleSectionCategoryPopoverChange = (open: boolean) => {
    if (!open) {
      if (sectionCategorySkipCloseCommitRef.current) {
        sectionCategorySkipCloseCommitRef.current = false
      } else {
        const normalizedQuery = normalizeSectionCategoryValue(sectionCategoryQuery)
        if (normalizedQuery) {
          setSectionCategoryDraft(normalizedQuery)
          void handleEnsureGlobalCategory(normalizedQuery)
        }
      }
      setSectionCategoryQuery('')
    } else {
      setSectionCategoryQuery(sectionCategoryDraft)
    }

    setIsSectionCategoryPopoverOpen(open)
  }

  const handleOpenDeleteCategoryDialog = (category: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(category)
    if (!normalizedCategory) return

    sectionCategorySkipCloseCommitRef.current = true
    setSectionCategoryQuery('')
    setIsSectionCategoryPopoverOpen(false)
    setCategoryToDelete(normalizedCategory)
    setIsDeleteCategoryDialogOpen(true)
  }

  const handleDeleteCategory = async () => {
    const normalizedCategory = normalizeSectionCategoryValue(categoryToDelete)
    if (!normalizedCategory) {
      setIsDeleteCategoryDialogOpen(false)
      return
    }

    setIsDeletingCategory(true)
    try {
      const response = await fetch('/api/sections/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: normalizedCategory }),
      })
      const data = (await response.json()) as SectionCategoryResponse

      if (response.status === 401) {
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível excluir a categoria.'))
      }

      const nextOptions = resolveSectionCategoryNames(data)
      setSectionCategoryOptions(nextOptions)
      if (toSectionCategoryKey(sectionCategoryDraft) === toSectionCategoryKey(normalizedCategory)) {
        setSectionCategoryDraft('')
      }
      setSectionCategoryQuery('')
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
  }

  const assignCategoryToSection = async (sectionId: number, rawCategory: string) => {
    const normalizedCategory = normalizeSectionCategoryValue(rawCategory)
    if (!normalizedCategory) {
      return { unauthorized: false as const, assigned: true as const, message: '' }
    }

    const response = await fetch(`/api/sections/${sectionId}/category`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ category: normalizedCategory }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.status === 401) {
      return { unauthorized: true as const, assigned: false as const, message: 'Sessão expirada.' }
    }

    if (!response.ok) {
      return {
        unauthorized: false as const,
        assigned: false as const,
        message: toErrorMessage(data, `A seção #${sectionId} foi criada, mas não foi possível aplicar a categoria.`),
      }
    }

    return {
      unauthorized: false as const,
      assigned: true as const,
      message: '',
    }
  }

  const appendSelectedFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return

    if (uploadMode === 'images') {
      const nonImages = selectedFiles.filter((f) => !isImageFile(f))
      if (nonImages.length > 0) {
        toast.error('Somente imagens são permitidas (JPG, PNG, WEBP, etc.).')
        return
      }
      const currentCount = uploadItems.length
      if (pageUploadLimit !== null && currentCount + selectedFiles.length > pageUploadLimit) {
        const remaining = pageUploadLimit - currentCount
        toast.error(
          remaining > 0
            ? `Limite de ${pageUploadLimit} imagens. Você ainda pode adicionar ${remaining} imagem(ns).`
            : `Limite de ${pageUploadLimit} imagens atingido.`
        )
        return
      }
      const newItems: PreparedUploadItem[] = selectedFiles.map((file) => ({
        id: createUploadItemId(),
        sourceName: file.name,
        files: [file],
      }))
      if (currentCount === 0 && selectedFiles[0]) {
        const suggestion = buildSectionNameSuggestionFromImage(selectedFiles[0].name)
        setNameSuggestion(suggestion)
        setName((current) => (!current.trim() ? suggestion : current))
      }
      setUploadItems((prev) => [...prev, ...newItems])
      return
    }

    if (uploadMode === 'pdf-batch' && !canUsePdfBatch) {
      toast.error('PDF em Massa indisponível no momento.')
      return
    }

    const selectedPdfs = selectedFiles.filter((f) => isPdfFile(f))
    if (selectedPdfs.length !== selectedFiles.length) {
      toast.error('Somente PDFs são permitidos nesta etapa.')
      return
    }

    if (uploadMode === 'pdf') {
      if (uploadItems.length > 0) {
        toast.error('Já existe um PDF carregado. Descarte o atual antes de carregar outro.')
        return
      }

      if (selectedPdfs.length > 1) {
        toast.error('Envie apenas um PDF por vez.')
        return
      }

      const selectedPdf = selectedPdfs[0]
      if (!selectedPdf) {
        toast.error('Selecione um PDF válido.')
        return
      }

      const nextNameSuggestion = buildSectionNameSuggestionFromPdf(selectedPdf.name)
      setNameSuggestion(nextNameSuggestion)
      setName((currentName) => {
        if (!currentName.trim() || currentName.trim() === nameSuggestion) {
          return nextNameSuggestion
        }
        return currentName
      })

      setUploadItems([{
        id: createUploadItemId(),
        sourceName: selectedPdf.name,
        files: [],
        rawPdf: selectedPdf,
      }])
      return
    }

    // modo PDF em massa — role 4: até 5 por lote, demais perfis: até 3 por lote
    const remaining = Math.max(0, maxBatchPdfsAllowedNow - uploadItems.length)
    if (remaining <= 0) {
      if (remainingSectionQuota !== null && remainingSectionQuota <= 0) {
        toast.error('Sem limite disponível para criar novas seções neste momento.')
      } else {
        toast.error(`Limite de ${maxBatchPdfsAllowedNow} PDF(s) em massa atingido.`)
      }
      return
    }

    const pdfsToProcess = selectedPdfs.slice(0, remaining)
    if (selectedPdfs.length > remaining) {
      toast.warning(
        `Máximo disponível agora: ${maxBatchPdfsAllowedNow} PDF(s). Apenas ${remaining} PDF(s) foram adicionados agora.`
      )
    }

    const preparedItems: PreparedUploadItem[] = pdfsToProcess
      .filter((f): f is File => Boolean(f))
      .map((pdfFile) => ({
        id: createUploadItemId(),
        sourceName: pdfFile.name,
        files: [],
        rawPdf: pdfFile,
      }))

    if (preparedItems.length === 0) {
      toast.error('Nenhum PDF válido foi preparado.')
      return
    }

    setUploadItems((prev) => [...prev, ...preparedItems])
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = event.currentTarget
    const selectedFiles = Array.from(inputElement.files ?? [])

    // Limpa imediatamente para permitir reenvio do mesmo arquivo após descarte.
    inputElement.value = ''
    await appendSelectedFiles(selectedFiles)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const selectedFiles = Array.from(event.dataTransfer.files ?? [])
    void appendSelectedFiles(selectedFiles)
  }

  const handleRemoveUploadItem = (itemId: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== itemId))
    setBatchPdfStatusByItemId((prev) => {
      if (!(itemId in prev)) return prev
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleClearUploads = () => {
    setUploadItems([])
    setBatchPdfStatusByItemId({})
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleCreateSection = async (event: React.FormEvent) => {
    event.preventDefault()

    const isBatchPdfMode = uploadMode === 'pdf-batch'
    if (isBatchPdfMode && !canUsePdfBatch) {
      toast.error('PDF em Massa indisponível no momento.')
      return
    }
    if (isBatchPdfMode && maxBatchPdfsAllowedNow !== null && maxBatchPdfsAllowedNow <= 0) {
      toast.error('Sem limite disponível para criar seções em massa neste momento.')
      return
    }
    if (isBatchPdfMode && maxBatchPdfsAllowedNow !== null && uploadItems.length > maxBatchPdfsAllowedNow) {
      toast.error(`Você pode criar no máximo ${maxBatchPdfsAllowedNow} seção(ões) em massa agora.`)
      return
    }

    if (!isBatchPdfMode && !name.trim()) {
      toast.error('Informe o nome da seção.')
      return
    }

    const hasRawPdf = uploadItems.some((item) => item.rawPdf)
    if (files.length === 0 && !hasRawPdf) {
      toast.error('Carregue um arquivo para criar a seção.')
      return
    }

    const effectiveSourceLang = sourceLang || sourceLanguageOptions[0]?.code || DEFAULT_SOURCE_LANG
    const effectiveTargetLang = targetLang
    const selectedCategory = normalizeSectionCategoryValue(sectionCategoryDraft)

    if (!effectiveSourceLang || !effectiveTargetLang) {
      toast.error('Selecione os idiomas de origem e destino.')
      return
    }

    if (uploadMode === 'images' && pageUploadLimit !== null) {
      const sectionExceedingLimit = uploadItems.find((item) => item.files.length > pageUploadLimit)
      if (sectionExceedingLimit) {
        const pagesCount = sectionExceedingLimit.files.length
        toast.error(
          `O arquivo "${sectionExceedingLimit.sourceName}" gerou ${pagesCount} páginas, acima do limite de ${pageUploadLimit} por seção.`
        )
        return
      }
    }

// Converter PDF único antes de criar (não converte na seleção do arquivo)
    let filesToUpload = files
    if (uploadMode === 'pdf') {
      const singleItem = uploadItems[0]
      if (singleItem?.rawPdf) {
        setIsPreparingUploads(true)
        try {
          setPreparingState({
            currentFileName: singleItem.sourceName,
            currentFileIndex: 1,
            totalFiles: 1,
            processedPages: 0,
            totalPages: 0,
          })
          filesToUpload = await extractPdfToImages(
            singleItem.rawPdf,
            (processedPages, totalPages) => {
              setPreparingState({
                currentFileName: singleItem.sourceName,
                currentFileIndex: 1,
                totalFiles: 1,
                processedPages,
                totalPages,
              })
            },
            { maxPages: pageUploadLimit }
          )
          if (filesToUpload.length === 0) {
            toast.error('Nenhuma página foi extraída do PDF.')
            return
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erro ao processar o PDF.')
          return
        } finally {
          setPreparingState(null)
          setIsPreparingUploads(false)
        }
      }
    }

    setIsCreatingSection(true)
    let batchCreatedCount = 0
    const batchWarnings: string[] = []
    const setBatchItemStatus = (itemId: string, status: BatchPdfUploadStatus) => {
      setBatchPdfStatusByItemId((previous) => ({
        ...previous,
        [itemId]: status,
      }))
    }

    try {
      if (isBatchPdfMode) {
        const itemsToProcessIds = new Set(
          uploadItems
            .filter((item) => batchPdfStatusByItemId[item.id]?.phase !== 'success')
            .map((item) => item.id)
        )

        if (itemsToProcessIds.size === 0) {
          toast.info('Todas as seções já foram criadas com sucesso.')
          router.push('/inicio/secoes')
          return
        }

        let failedCount = 0

        for (const item of uploadItems) {
          if (!itemsToProcessIds.has(item.id)) continue

          const sectionName = buildSectionNameSuggestionFromPdf(item.sourceName) || item.sourceName

          try {
            let imageFiles: File[]
            if (item.rawPdf) {
              setBatchItemStatus(item.id, {
                phase: 'preparing',
                message: 'Convertendo PDF...',
                processedPages: 0,
                totalPages: 0,
              })
              imageFiles = await extractPdfToImages(
                item.rawPdf,
                (processedPages, totalPages) => {
                  setBatchItemStatus(item.id, {
                    phase: 'preparing',
                    message: 'Extraindo páginas...',
                    processedPages,
                    totalPages,
                  })
                },
                { maxPages: pageUploadLimit }
              )
            } else {
              setBatchItemStatus(item.id, {
                phase: 'preparing',
                message: 'Preparando páginas extraídas...',
                processedPages: item.files.length,
                totalPages: item.files.length,
              })
              imageFiles = item.files
            }

            if (imageFiles.length === 0) {
              setBatchItemStatus(item.id, { phase: 'error', message: 'Nenhuma página extraída do PDF.' })
              failedCount++
              continue
            }

            setBatchItemStatus(item.id, {
              phase: 'uploading',
              message: `Enviando ${imageFiles.length} página(s)...`,
            })

            const formData = new FormData()
            formData.append('name', sectionName)
            formData.append('priority', priorityValue)
            formData.append('source_lang', effectiveSourceLang)
            formData.append('target_lang', effectiveTargetLang)
            const providerValue = providerLang === 'openrouter' && openRouterModel
              ? `openrouter:${openRouterModel}`
              : providerLang
            formData.append('provider_lang', providerValue)
            imageFiles.forEach((file) => formData.append('files', file))

            const response = await fetch('/api/sections', {
              method: 'POST',
              body: formData,
            })
            const data = await response.json()

            if (response.status === 401) {
              setBatchItemStatus(item.id, { phase: 'error', message: 'Sessão expirada durante o envio.' })
              return
            }

            if (!response.ok) {
              setBatchItemStatus(item.id, {
                phase: 'error',
                message: toErrorMessage(data, `Não foi possível criar a seção "${sectionName}".`),
              })
              failedCount++
              continue
            }

            batchCreatedCount += 1
            const rawSectionId = typeof data?.id === 'number' ? data.id : Number(data?.id)

            if (!Number.isFinite(rawSectionId)) {
              batchWarnings.push(`"${sectionName}" criada sem ID válido para acessar direto.`)
              setBatchItemStatus(item.id, { phase: 'success', message: 'Seção criada, mas sem ID de retorno válido.' })
              continue
            }

            if (selectedCategory) {
              setBatchItemStatus(item.id, { phase: 'assigning-category', message: 'Seção criada. Aplicando categoria...' })
              const categoryResult = await assignCategoryToSection(rawSectionId, selectedCategory)
              if (categoryResult.unauthorized) {
                setBatchItemStatus(item.id, { phase: 'error', message: 'Sessão expirada ao aplicar categoria.' })
                return
              }
              if (!categoryResult.assigned) {
                batchWarnings.push(categoryResult.message)
                setBatchItemStatus(item.id, { phase: 'success', message: 'Seção criada (categoria não aplicada).' })
              } else {
                setBatchItemStatus(item.id, { phase: 'success', message: 'Seção criada e categorizada.' })
              }
            } else {
              setBatchItemStatus(item.id, { phase: 'success', message: 'Seção criada com sucesso.' })
            }
          } catch (itemError) {
            setBatchItemStatus(item.id, {
              phase: 'error',
              message: itemError instanceof Error ? itemError.message : `Erro ao criar a seção "${sectionName}".`,
            })
            failedCount++
          }
        }

        if (batchWarnings.length > 0) {
          toast.warning(batchWarnings[0])
        }

        if (batchCreatedCount > 0 && failedCount === 0) {
          toast.success(
            batchCreatedCount === 1
              ? '1 seção criada com sucesso. Use o botão Processar para iniciar a fila.'
              : `${batchCreatedCount} seção(ões) criada(s) com sucesso. Use o botão Processar em cada seção para iniciar a fila.`
          )
          router.push('/inicio/secoes')
          return
        }

        if (batchCreatedCount > 0) {
          toast.success(`${batchCreatedCount} seção(ões) criada(s). ${failedCount} com erro — corrija e tente novamente.`)
          return
        }

        toast.error('Nenhuma seção foi criada. Verifique os erros e tente novamente.')
        return
      }

      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('priority', priorityValue)
      formData.append('source_lang', effectiveSourceLang)
      formData.append('target_lang', effectiveTargetLang)
      const providerValue = providerLang === 'openrouter' && openRouterModel
        ? `openrouter:${openRouterModel}`
        : providerLang
      formData.append('provider_lang', providerValue)
      filesToUpload.forEach((file) => formData.append('files', file))

      const response = await fetch('/api/sections', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (response.status === 401) {
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível criar a seção.'))
      }

      const rawCreatedSectionId = typeof data?.id === 'number' ? data.id : Number(data?.id)
      if (Number.isFinite(rawCreatedSectionId)) {
        if (selectedCategory) {
          const categoryResult = await assignCategoryToSection(rawCreatedSectionId, selectedCategory)
          if (categoryResult.unauthorized) return
          if (!categoryResult.assigned) {
            toast.warning(categoryResult.message)
          }
        }

        toast.success('Seção criada com sucesso. Use o botão Processar para iniciar a fila.')
        router.push(`/inicio/secoes/${rawCreatedSectionId}`)
        return
      }

      toast.success('Seção criada com sucesso.')
      router.push('/inicio/secoes')
    } catch (err) {
      const fallbackMessage = isBatchPdfMode
        ? 'Erro ao criar seções em massa.'
        : 'Erro ao criar seção.'
      const baseMessage = err instanceof Error ? err.message : fallbackMessage
      if (isBatchPdfMode && batchCreatedCount > 0) {
        toast.error(`${baseMessage} ${batchCreatedCount} de ${uploadItems.length} seção(ões) foram criadas.`)
      } else {
        toast.error(baseMessage)
      }
    } finally {
      setIsCreatingSection(false)
    }
  }

  return (
    <form onSubmit={handleCreateSection} className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Nova Tradução</h1>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.dispatchEvent(new CustomEvent('open-page-tour', { detail: { force: true } }))}
              >
                <HelpCircle className="h-4 w-4 sm:hidden" />
                <PlayCircle className="h-4 w-4 hidden sm:block" />
                <span className="hidden sm:inline">Como usar</span>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Crie traduções por capítulo com imagens ou PDF único.
            </p>
          </div>
        </div>
      </Card>


      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <Card data-tour="upload-area" className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Arquivos para traduzir</h2>
              <p className="text-xs text-muted-foreground">
                {uploadMode === 'pdf'
                  ? 'Um único PDF — páginas extraídas localmente e enviadas como imagens.'
                  : uploadMode === 'pdf-batch'
                  ? 'Vários PDFs — cada um vira uma seção, extraído localmente de 1 em 1.'
                  : 'Várias imagens de uma vez (JPG, PNG, WEBP…).'}
              </p>
            </div>
          </div>

          {/* Toggle PDF / PDF em Massa / Imagens */}
          <div className="flex rounded-md border border-border overflow-hidden w-fit">
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm transition-colors',
                uploadMode === 'pdf'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted/50'
              )}
              disabled={isPreparingUploads || isCreatingSection}
              onClick={() => {
                if (uploadMode === 'pdf') return
                if (uploadItems.length > 0) {
                  toast.warning('Remova os arquivos carregados antes de trocar para PDF.')
                  return
                }
                setUploadMode('pdf')
              }}
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
            {canUsePdfBatch && (
              <button
                type="button"
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 text-sm transition-colors border-l border-border',
                  uploadMode === 'pdf-batch'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/50'
                )}
                disabled={isPreparingUploads || isCreatingSection}
                onClick={() => {
                  if (uploadMode === 'pdf-batch') return
                  if (uploadItems.length > 0) {
                    toast.warning('Remova os arquivos carregados antes de trocar para PDF em Massa.')
                    return
                  }
                  setUploadMode('pdf-batch')
                }}
              >
                <FileText className="h-4 w-4" />
                PDF em Massa
              </button>
            )}
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm transition-colors border-l border-border',
                uploadMode === 'images'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted/50'
              )}
              disabled={isPreparingUploads || isCreatingSection}
              onClick={() => {
                if (uploadMode === 'images') return
                if (uploadItems.length > 0) {
                  toast.warning('Remova os arquivos carregados antes de trocar para Imagens.')
                  return
                }
                setUploadMode('images')
              }}
            >
              <FileImage className="h-4 w-4" />
              Imagens
            </button>
          </div>

          {uploadMode === 'pdf-batch' && (
            <div className="rounded-lg border border-primary/25 bg-primary/8 p-3">
              <p className="text-sm font-medium text-foreground">Tradução PDF em Massa</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada PDF vira uma seção separada com o nome do arquivo.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Disponível agora:{' '}
                <span className="font-medium text-foreground">{maxBatchPdfsAllowedNow}</span> / {batchPlanCap} PDF(s)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Atual: <span className="font-medium text-foreground">{uploadItems.length}</span> PDF(s) carregado(s)
              </p>
              {uploadItems.length > maxBatchPdfsAllowedNow && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Remova {uploadItems.length - maxBatchPdfsAllowedNow} PDF(s) para respeitar o limite disponível atual.
                </p>
              )}
            </div>
          )}

          {/* Inputs ocultos */}
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple={uploadMode === 'pdf-batch'}
            className="hidden"
            onChange={(event) => void handleFileInputChange(event)}
            disabled={
              isCreatingSection
              || isPreparingUploads
              || (uploadMode === 'pdf' && uploadItems.length > 0)
              || (uploadMode === 'pdf-batch' && maxBatchPdfsAllowedNow !== null && uploadItems.length >= maxBatchPdfsAllowedNow)
            }
          />
          <Input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleFileInputChange(event)}
            disabled={isCreatingSection || isPreparingUploads || uploadMode !== 'images'}
          />

          {/* Zona de drop */}
          {(() => {
            const pdfSingleBlocked = uploadMode === 'pdf' && uploadItems.length > 0
            const pdfBatchBlocked =
              uploadMode === 'pdf-batch'
              && maxBatchPdfsAllowedNow !== null
              && uploadItems.length >= maxBatchPdfsAllowedNow
            const imagesAtLimit = uploadMode === 'images' && pageUploadLimit !== null && files.length >= pageUploadLimit
            const blocked = pdfSingleBlocked || pdfBatchBlocked || imagesAtLimit
            return (
              <div
                className={cn(
                  'rounded-lg border-2 border-dashed p-5 sm:p-6 transition-colors',
                  blocked
                    ? 'border-border bg-muted/10 cursor-not-allowed opacity-70'
                    : 'cursor-pointer',
                  !blocked && (
                    isDragOver
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/35'
                  )
                )}
                onClick={() => {
                  if (blocked || isCreatingSection || isPreparingUploads) return
                  if (uploadMode === 'pdf' || uploadMode === 'pdf-batch') fileInputRef.current?.click()
                  else imageInputRef.current?.click()
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (!blocked) setIsDragOver(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsDragOver(false)
                }}
                onDrop={(event) => {
                  if (blocked) {
                    event.preventDefault()
                    setIsDragOver(false)
                    return
                  }
                  handleDrop(event)
                }}
              >
                <div className="flex flex-col items-center justify-center text-center gap-2">
                  {uploadMode === 'pdf' || uploadMode === 'pdf-batch' ? (
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <FileImage className="h-6 w-6 text-muted-foreground" />
                  )}
                  {imagesAtLimit ? (
                    <>
                      <p className="text-sm text-foreground font-medium">Limite atingido</p>
                      <p className="text-xs text-muted-foreground">{pageUploadLimit} imagens carregadas.</p>
                    </>
                  ) : pdfBatchBlocked ? (
                    <>
                      <p className="text-sm text-foreground font-medium">Limite de PDFs em massa atingido</p>
                      <p className="text-xs text-muted-foreground">
                        Você já adicionou o limite disponível ({maxBatchPdfsAllowedNow} PDF(s)). Remova um para adicionar outro.
                      </p>
                    </>
                  ) : pdfSingleBlocked ? (
                    <>
                      <p className="text-sm text-foreground font-medium">PDF já carregado</p>
                      <p className="text-xs text-muted-foreground">Descarte o PDF atual para carregar outro.</p>
                    </>
                  ) : uploadMode === 'pdf-batch' ? (
                    <>
                      <p className="text-sm text-foreground font-medium">
                        {`Arraste até ${maxBatchPdfsAllowedNow} PDF(s) ou clique para selecionar`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`${uploadItems.length} / ${maxBatchPdfsAllowedNow} PDF(s) adicionados`}
                      </p>
                    </>
                  ) : uploadMode === 'pdf' ? (
                    <>
                      <p className="text-sm text-foreground font-medium">Arraste um PDF ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground">Formato aceito: PDF</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-foreground font-medium">
                        {files.length > 0 ? 'Clique para adicionar mais imagens' : 'Arraste imagens ou clique para selecionar'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pageUploadLimit !== null
                          ? `${files.length} / ${pageUploadLimit} imagens — JPG, PNG, WEBP…`
                          : 'JPG, PNG, WEBP e outros formatos de imagem'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {isPreparingUploads && preparingState && (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando anexos... arquivo {preparingState.currentFileIndex} de {preparingState.totalFiles}
              </div>
              <p className="text-xs text-muted-foreground truncate" title={preparingState.currentFileName}>
                {preparingState.currentFileName}
              </p>
              <Progress value={preparingOverallProgress} className="h-2" />
              {preparingState.totalPages > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Processando: {preparingState.processedPages} / {preparingState.totalPages}
                  </p>
                  <Progress
                    value={(preparingState.processedPages / preparingState.totalPages) * 100}
                    className="h-2"
                  />
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {uploadMode === 'images' ? (
              <Badge variant="outline">
                {uploadItems.length}{pageUploadLimit !== null ? ` / ${pageUploadLimit}` : ''} imagem(ns)
              </Badge>
            ) : (
              <Badge variant="outline">
                {files.length > 0
                  ? `${files.length} página(s)`
                  : uploadItems.some((i) => i.rawPdf)
                    ? uploadMode === 'pdf-batch'
                      ? `${uploadItems.length} PDF(s) selecionado(s)`
                      : 'PDF selecionado'
                    : '0 página(s)'}
              </Badge>
            )}
          </div>

          {uploadItems.length > 0 ? (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-56 overflow-auto space-y-2">
              {uploadItems.map((item) => {
                const batchStatus = uploadMode === 'pdf-batch'
                  ? batchPdfStatusByItemId[item.id] ?? getInitialBatchPdfUploadStatus()
                  : null
                const batchPhaseMeta = batchStatus ? getBatchPdfPhaseMeta(batchStatus.phase) : null
                const isBatchRunning = batchStatus?.phase === 'preparing' || batchStatus?.phase === 'uploading' || batchStatus?.phase === 'assigning-category'

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/70 bg-background/60 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {uploadMode === 'images'
                        ? <FileImage className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate" title={item.sourceName}>
                          {item.sourceName}
                        </p>
                        {uploadMode === 'pdf' && (
                          <p className="text-xs text-muted-foreground">
                            {item.rawPdf
                              ? 'Pronto para converter ao criar'
                              : `${item.files.length} página(s) extraída(s)`}
                          </p>
                        )}
                        {uploadMode === 'pdf-batch' && batchStatus && batchPhaseMeta && (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="flex items-center gap-1.5 text-[11px]">
                              {isBatchRunning ? (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : (
                                <span className={cn('h-1.5 w-1.5 rounded-full', batchStatus.phase === 'success'
                                  ? 'bg-emerald-500'
                                  : batchStatus.phase === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-muted-foreground/50')}
                                />
                              )}
                              <span className={cn('font-medium', batchPhaseMeta.className)}>
                                {batchPhaseMeta.label}
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate" title={batchStatus.message}>
                              {batchStatus.message}
                            </p>
                            {batchStatus.phase === 'preparing' && batchStatus.totalPages !== undefined && batchStatus.totalPages > 0 && (
                              <Progress
                                value={(( batchStatus.processedPages ?? 0) / batchStatus.totalPages) * 100}
                                className="h-1.5 mt-1"
                              />
                            )}
                            <p className="text-[11px] text-muted-foreground truncate">
                              seção: {buildSectionNameSuggestionFromPdf(item.sourceName) || item.sourceName}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleRemoveUploadItem(item.id)}
                      disabled={isPreparingUploads || isCreatingSection}
                      aria-label={`Remover ${item.sourceName}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {uploadMode === 'images'
                ? 'Nenhuma imagem carregada ainda.'
                : 'Nenhum PDF carregado ainda.'}
            </p>
          )}
        </Card>

        <Card data-tour="lang-config" className="overflow-hidden">
          {/* Header sempre visível */}
          <div className="p-4 space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
              onClick={() => setConfigExpanded((v) => !v)}
            >
              <h2 className="text-base font-semibold text-foreground">Configuração</h2>
              {configExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Idiomas e provedor — sempre visíveis */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="section-source-lang">
                  Origem
                </label>
                <Select
                  value={sourceLang}
                  onValueChange={setSourceLang}
                  disabled={isCreatingSection}
                >
                  <SelectTrigger id="section-source-lang" className="w-full h-12 text-sm">
                    <SelectValue placeholder="Origem">
                      {sourceLanguageOptions.find((o) => o.code === sourceLang)?.name ?? sourceLang}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60">
                    {sourceLanguageOptions.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="section-target-lang">
                  Destino
                </label>
                <Select
                  value={targetLang}
                  onValueChange={setTargetLang}
                  disabled={isCreatingSection}
                >
                  <SelectTrigger id="section-target-lang" className="w-full h-12 text-sm">
                    <SelectValue placeholder="Destino">
                      {targetLanguageOptions.find((o) => o.code === targetLang)?.name ?? targetLang}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-60">
                    {targetLanguageOptions.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="section-provider-lang">
                  Provedor
                </label>
                <Select
                  value={providerLang}
                  onValueChange={(value) => setProviderLang(value === 'openrouter' ? 'openrouter' : 'google')}
                  disabled={isCreatingSection || isPreparingUploads}
                >
                  <SelectTrigger id="section-provider-lang" className="w-full h-12 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="google">Google</SelectItem>
                    {openRouterModel ? (
                      <SelectItem value="openrouter">OpenRouter ({openRouterModel})</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>

                {null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="section-category-select" className="text-sm font-medium text-foreground">
                Categoria (opcional)
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
                    className="h-10 w-full justify-between gap-2 px-3 text-left text-sm font-normal"
                    disabled={isCreatingSection || isPreparingUploads || isSectionCategoryLoading || isSectionCategorySaving}
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
              <p className="text-xs text-muted-foreground">
                Opcional. Escolha uma categoria existente ou crie uma nova.
              </p>
            </div>
          </div>

          {/* Opções avançadas — colapsáveis */}
          {configExpanded && (
            <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="section-name">
                  Nome da seção
                </label>
                <Input
                  id="section-name"
                  placeholder={hasLoadedPdf && nameSuggestion ? `Sugestão: ${nameSuggestion}` : 'Ex: Capítulo 11'}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isCreatingSection || isPreparingUploads}
                />
                {hasLoadedPdf && nameSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    Sugestão baseada no PDF: {nameSuggestion}
                  </p>
                )}
              </div>

              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Prioridade automática</p>
                <p className="text-sm text-foreground">
                  {isLoadingRole ? 'Calculando prioridade...' : priorityLabel}
                </p>
              </div>

<p className="text-xs text-muted-foreground">
                {`${sourceLanguageOptions.length} idioma(s) disponível(is).`}
              </p>

              {roleError && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {roleError} Aplicando prioridade baixa por segurança.
                </p>
              )}

            </div>
          )}
        </Card>

      </div>

      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        <Button
          data-tour="submit-btn"
          size="lg"
          className="w-full sm:w-auto"
          type="submit"
          disabled={isCreatingSection || isLoadingRole || isPreparingUploads}
        >
          {isCreatingSection ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadMode === 'pdf-batch' ? 'Processando PDFs...' : 'Criando seção...'}
            </>
          ) : isPreparingUploads ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando anexos...
            </>
          ) : isLoadingRole ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando prioridade...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {uploadMode === 'pdf-batch'
                ? hasBatchErrors ? 'Tentar novamente' : 'Criar Seções em Massa'
                : 'Criar Seção'}
            </>
          )}
        </Button>
        <Button asChild size="lg" className="w-full sm:w-auto" type="button" variant="outline" disabled={isCreatingSection || isPreparingUploads}>
          <Link href="/inicio/secoes">Cancelar</Link>
        </Button>
      </div>

      <Dialog open={isCreatingSection && uploadMode !== 'pdf-batch'}>
        <DialogContent
          className="sm:max-w-sm [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="relative flex items-center justify-center w-28 h-28">
              <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
              <div
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary"
                style={{ animation: 'spin 0.9s linear infinite' }}
              />
              <div
                className="absolute inset-2.5 rounded-full border-4 border-transparent border-t-primary/50"
                style={{ animation: 'spin 1.4s linear infinite reverse' }}
              />
              <div
                className="absolute inset-5 rounded-full border-4 border-transparent border-t-primary/25"
                style={{ animation: 'spin 2s linear infinite' }}
              />
              <div className="h-8 w-8 rounded-full bg-primary/10 animate-pulse flex items-center justify-center">
                <Save className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Criando sua seção...
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Aguarde enquanto processamos seu pedido.
              </DialogDescription>
            </div>

            <div className="flex gap-2">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
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

      <SpotlightTour
        storageKey="tour-create-v2"
        open={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={CREATE_TOUR_STEPS}
      />
    </form>
  )
}

const CREATE_TOUR_STEPS: TourStep[] = [
  {
    title: 'Criar uma nova tradução',
    description: 'Nesta tela você prepara um capítulo ou lote de páginas para tradução automática com IA. São apenas 3 passos: enviar arquivos, configurar idiomas e criar.',
  },
  {
    title: 'Envie seus arquivos',
    description: 'Arraste imagens (JPG, PNG, WEBP…) ou um único PDF. O PDF é processado localmente: cada página vira uma imagem enviada para tradução.',
    selector: 'upload-area',
    tooltipSide: 'bottom',
  },
  {
    title: 'Configure os idiomas',
    description: 'Escolha o idioma de origem do mangá (ex: Inglês ou Japonês) e o idioma de destino (ex: Português). Você também pode trocar o provedor de tradução nessa seção.',
    selector: 'lang-config',
    tooltipSide: 'bottom',
  },
  {
    title: 'Criar e traduzir',
    description: 'Com arquivos e idiomas prontos, toque aqui para criar a seção. Depois, use o botão Processar para enviar para a fila de tradução.',
    selector: 'submit-btn',
    tooltipSide: 'top',
  },
]

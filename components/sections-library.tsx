'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import ReactPaginate from 'react-paginate'
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
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/components/ui/use-mobile'
import { SpotlightTour, checkTourDone, type TourStep } from '@/components/spotlight-tour'
import { SECTION_READ_LS_PREFIX } from '@/components/section-reader'
import {
  buildImageViewUrl,
  formatSectionDate,
  formatStatus,
  getSectionQueueState,
  getSectionPriorityInfo,
  resolveSectionListResponse,
  type SectionListItem,
  type SectionListPaginationLinks,
  toErrorMessage,
} from '@/lib/sections'
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PlusSquare,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Upload,
  Sparkles,
} from 'lucide-react'

interface DeleteSectionResponse {
  message?: string
  section?: { id?: number }
}

interface AuthUsageSummaryResponse {
  role?: number
  limite?: number
  gerado?: number
  limit_page_upload?: number
  message?: string
  error?: string
}

interface SectionCategoriesLibraryResponse {
  categories?: unknown
  section_categories_by_id?: unknown
  message?: string
  error?: string
}

interface LibraryUsageSummary {
  limitInTenHours: number | null
  generatedInTenHours: number
  pageUploadLimit: number | null
}

const MOBILE_SECTIONS_PER_PAGE = 6
const DESKTOP_SECTIONS_PER_PAGE = 8
const LIBRARY_CATEGORY_MAX_LENGTH = 64
const READ_PAGES_LS_PREFIX = 'manga-read-'
const SECTION_READ_THRESHOLD = 0.70

type SectionsPaginationMode = 'server' | 'client'

interface LibrarySectionsPagination {
  mode: SectionsPaginationMode
  total: number
  page: number
  perPage: number
  totalPages: number
  from: number | null
  to: number | null
  links: SectionListPaginationLinks | null
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(1, totalPages))
}

function parsePageFromQuery(value: string | null) {
  if (!value) return 1
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return parsed
}

function normalizeCategoryLabel(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, LIBRARY_CATEGORY_MAX_LENGTH)
}

function toCategoryKey(value: string) {
  return normalizeCategoryLabel(value).toLocaleLowerCase('pt-BR')
}

function asRecordObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeCategoryOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]

  const seen = new Set<string>()
  const options: string[] = []

  for (const item of value) {
    const normalized = normalizeCategoryLabel(item)
    if (!normalized) continue

    const key = toCategoryKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    options.push(normalized)

    if (options.length >= 300) break
  }

  options.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  return options
}

function normalizeCategoryMap(value: unknown) {
  const root = asRecordObject(value)
  if (!root) return {} as Record<number, string>

  const map: Record<number, string> = {}
  for (const [rawSectionId, rawCategory] of Object.entries(root)) {
    const sectionId = Number.parseInt(rawSectionId, 10)
    if (!Number.isFinite(sectionId)) continue

    const category = normalizeCategoryLabel(rawCategory)
    if (!category) continue

    map[sectionId] = category
  }
  return map
}

export function SectionsLibrary() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const sectionsPerPage = isMobile ? MOBILE_SECTIONS_PER_PAGE : DESKTOP_SECTIONS_PER_PAGE
  const sectionsFetchRequestId = useRef(0)
  const sectionsInFlightKeysRef = useRef<Set<string>>(new Set())
  const lastSectionsFetchKeyRef = useRef<string | null>(null)
  const lastSectionsFetchAtRef = useRef(0)
  const lastCategoriesSectionIdsKeyRef = useRef('')
  const syncedReadProgressSectionIdsRef = useRef<Set<number>>(new Set())
  const pageFromUrl = useMemo(
    () => parsePageFromQuery(searchParams.get('page')),
    [searchParams]
  )
  const categoryFromUrl = useMemo(
    () => normalizeCategoryLabel(searchParams.get('category')),
    [searchParams]
  )

  const [sections, setSections] = useState<SectionListItem[]>([])
  const [isLoadingSections, setIsLoadingSections] = useState(true)
  const [isLoadingUsageSummary, setIsLoadingUsageSummary] = useState(true)
  const [usageSummary, setUsageSummary] = useState<LibraryUsageSummary | null>(null)
  const [deletingSectionId, setDeletingSectionId] = useState<number | null>(null)
  const [sectionToDelete, setSectionToDelete] = useState<SectionListItem | null>(null)
  const [error, setError] = useState('')
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [success, setSuccess] = useState('')
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, boolean>>({})
  const [readSectionIds, setReadSectionIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(pageFromUrl)
  const currentPageRef = useRef(currentPage)
  const [sectionsPagination, setSectionsPagination] = useState<LibrarySectionsPagination>({
    mode: 'server',
    total: 0,
    page: 1,
    perPage: sectionsPerPage,
    totalPages: 1,
    from: null,
    to: null,
    links: null,
  })
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [sectionCategoryById, setSectionCategoryById] = useState<Record<number, string>>({})
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(categoryFromUrl)
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  const handleUnauthorized = useCallback(() => {
    const params = new URLSearchParams()
    params.set('expired', '1')
    const currentPath = pathname || '/inicio/secoes'
    const currentQuery = searchParams.toString()
    const redirectTarget = currentQuery ? `${currentPath}?${currentQuery}` : currentPath
    if (redirectTarget.startsWith('/')) {
      params.set('redirect', redirectTarget)
    }
    router.replace(`/login?${params.toString()}`)
  }, [pathname, router, searchParams])

  const syncFiltersToUrl = useCallback((nextPage: number, nextCategory: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(nextPage))
    }
    const normalizedCategory = normalizeCategoryLabel(nextCategory)
    if (normalizedCategory) {
      params.set('category', normalizedCategory)
    } else {
      params.delete('category')
    }
    const query = params.toString()
    const target = query ? `${pathname}?${query}` : pathname
    router.replace(target, { scroll: false })
  }, [pathname, router, searchParams])

  const fetchSections = useCallback(
    async (
      page = 1,
      options?: { force?: boolean; categoryOverride?: string; preserveView?: boolean }
    ) => {
      const force = options?.force ?? false
      const preserveView = options?.preserveView ?? false
      const normalizedPage = Math.max(1, Math.floor(page))
      const normalizedCategory = normalizeCategoryLabel(options?.categoryOverride ?? selectedCategoryFilter)
      const requestKey = `${normalizedPage}:${sectionsPerPage}:${toCategoryKey(normalizedCategory)}`
      const now = Date.now()

      if (!force) {
        if (sectionsInFlightKeysRef.current.has(requestKey)) return
        if (
          lastSectionsFetchKeyRef.current === requestKey &&
          now - lastSectionsFetchAtRef.current < 1000
        ) {
          return
        }
      }

      sectionsInFlightKeysRef.current.add(requestKey)
      const requestId = ++sectionsFetchRequestId.current
      if (!preserveView) {
        setIsLoadingSections(true)
      }

      try {
        const queryParams = new URLSearchParams()
        queryParams.set('page', String(normalizedPage))
        queryParams.set('per_page', String(sectionsPerPage))
        if (normalizedCategory) {
          queryParams.set('category', normalizedCategory)
        }
        const response = await fetch(
          `/api/sections?${queryParams.toString()}`,
          { cache: 'no-store' }
        )
        const data = await response.json()

        if (response.status === 401) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          throw new Error(toErrorMessage(data, 'Não foi possível listar seções.'))
        }

        const resolved = resolveSectionListResponse(data, sectionsPerPage)
        if (sectionsFetchRequestId.current !== requestId) return

        const isLegacyArray = Array.isArray(data)
        const nextTotal = resolved.meta?.total ?? resolved.sections.length
        const nextPerPage = resolved.meta?.per_page ?? sectionsPerPage
        const nextTotalPages = resolved.meta?.last_page ?? Math.max(1, Math.ceil(nextTotal / nextPerPage))
        const nextPage = isLegacyArray
          ? normalizedPage
          : resolved.meta?.current_page ?? normalizedPage
        const nextFrom = isLegacyArray
          ? nextTotal === 0
            ? null
            : (nextPage - 1) * nextPerPage + 1
          : resolved.meta?.from ?? (nextTotal === 0 ? null : (nextPage - 1) * nextPerPage + 1)
        const nextTo = isLegacyArray
          ? nextTotal === 0
            ? null
            : Math.min(nextPage * nextPerPage, nextTotal)
          : resolved.meta?.to ??
            (nextTotal === 0 ? null : Math.min(nextPage * nextPerPage, nextTotal))

        setSections(resolved.sections)
        setSectionsPagination({
          mode: isLegacyArray ? 'client' : 'server',
          total: nextTotal,
          page: nextPage,
          perPage: nextPerPage,
          totalPages: nextTotalPages,
          from: nextFrom,
          to: nextTo,
          links: resolved.links,
        })
        setCurrentPage(nextPage)
        lastSectionsFetchKeyRef.current = requestKey
        lastSectionsFetchAtRef.current = Date.now()
        setError('')
      } catch (err) {
        if (sectionsFetchRequestId.current !== requestId) return
        setError(err instanceof Error ? err.message : 'Erro ao listar seções.')
      } finally {
        sectionsInFlightKeysRef.current.delete(requestKey)
        if (sectionsFetchRequestId.current === requestId) {
          setIsLoadingSections(false)
        }
      }
    },
    [handleUnauthorized, sectionsPerPage, selectedCategoryFilter]
  )

  const fetchUsageSummary = useCallback(async () => {
    setIsLoadingUsageSummary(true)

    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = (await response.json()) as AuthUsageSummaryResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível carregar os limites da conta.'))
      }

      setUsageSummary({
        limitInTenHours: toFiniteNumber(data.limite),
        generatedInTenHours: toFiniteNumber(data.gerado) ?? 0,
        pageUploadLimit: toFiniteNumber(data.limit_page_upload),
      })
    } catch {
      setUsageSummary(null)
    } finally {
      setIsLoadingUsageSummary(false)
    }
  }, [handleUnauthorized])

  const fetchSectionCategories = useCallback(async (sectionIds: number[]) => {
    if (sectionIds.length === 0) {
      setCategoryOptions([])
      setSectionCategoryById({})
      setSelectedCategoryFilter('')
      return
    }

    setIsLoadingCategories(true)
    try {
      const sectionIdsParam = sectionIds.join(',')
      const response = await fetch(`/api/sections/categories?section_ids=${encodeURIComponent(sectionIdsParam)}`, {
        cache: 'no-store',
      })
      const data = (await response.json()) as SectionCategoriesLibraryResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível carregar categorias da biblioteca.'))
      }

      const nextOptions = normalizeCategoryOptions(data.categories)
      const nextMap = normalizeCategoryMap(data.section_categories_by_id)
      setCategoryOptions(nextOptions)
      setSectionCategoryById(nextMap)
      setSelectedCategoryFilter((previous) => {
        if (!previous) return ''
        const exists = nextOptions.some((category) => toCategoryKey(category) === toCategoryKey(previous))
        return exists ? previous : ''
      })
    } catch {
      setCategoryOptions([])
      setSectionCategoryById({})
      setSelectedCategoryFilter('')
    } finally {
      setIsLoadingCategories(false)
    }
  }, [handleUnauthorized])

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  useEffect(() => {
    void fetchUsageSummary()
  }, [fetchUsageSummary])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSections(currentPageRef.current)
    }, 180)
    return () => clearTimeout(timer)
  }, [fetchSections, sectionsPerPage])

  useEffect(() => {
    const currentCategoryKey = toCategoryKey(selectedCategoryFilter)
    const urlCategoryKey = toCategoryKey(categoryFromUrl)
    const shouldSyncCategory = currentCategoryKey !== urlCategoryKey
    const shouldSyncPage = pageFromUrl !== currentPageRef.current

    if (!shouldSyncCategory && !shouldSyncPage) return

    if (shouldSyncCategory) {
      setSelectedCategoryFilter(categoryFromUrl)
    }
    if (shouldSyncPage) {
      setCurrentPage(pageFromUrl)
      currentPageRef.current = pageFromUrl
    }

    void fetchSections(pageFromUrl, {
      force: true,
      categoryOverride: categoryFromUrl,
    })
  }, [categoryFromUrl, fetchSections, pageFromUrl, selectedCategoryFilter])

  useEffect(() => {
    const sectionIds = sections.map((section) => section.id)
    const sectionIdsKey = sectionIds.join(',')
    if (sectionIdsKey === lastCategoriesSectionIdsKeyRef.current) return
    lastCategoriesSectionIdsKeyRef.current = sectionIdsKey
    void fetchSectionCategories(sectionIds)
  }, [fetchSectionCategories, sections])

  useEffect(() => {
    const handler = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force
      if (force || !checkTourDone('tour-library-v2')) {
        setIsTourOpen(true)
      }
    }
    window.addEventListener('open-page-tour', handler)
    return () => window.removeEventListener('open-page-tour', handler)
  }, [])

  useEffect(() => {
    if (sections.length === 0) return
    const localDoneSectionIds = new Set<string>()
    for (const section of sections) {
      try {
        if (localStorage.getItem(`${SECTION_READ_LS_PREFIX}${section.id}`) === 'done') {
          localDoneSectionIds.add(String(section.id))
          continue
        }
      } catch {
        // silencioso
      }

      if (!Number.isFinite(section.images_count) || section.images_count <= 0) continue

      try {
        const rawReadPages = localStorage.getItem(`${READ_PAGES_LS_PREFIX}${section.id}`)
        if (!rawReadPages) continue

        const parsed = JSON.parse(rawReadPages) as unknown
        if (!Array.isArray(parsed) || parsed.length === 0) continue

        const uniqueReadPages = new Set(
          parsed
            .map((value) => (typeof value === 'number' ? value : Number(value)))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.floor(value))
        )

        const ratio = uniqueReadPages.size / section.images_count
        if (ratio < SECTION_READ_THRESHOLD) continue

        localStorage.setItem(`${SECTION_READ_LS_PREFIX}${section.id}`, 'done')
        localDoneSectionIds.add(String(section.id))
      } catch {
        // silencioso: leitura local pode falhar em casos de JSON inválido
      }
    }

    setReadSectionIds(new Set(localDoneSectionIds))

    const pendingSyncSectionIds = Array.from(localDoneSectionIds)
      .map((sectionId) => Number(sectionId))
      .filter((sectionId) => Number.isFinite(sectionId))
      .filter((sectionId) => !syncedReadProgressSectionIdsRef.current.has(sectionId))
    if (pendingSyncSectionIds.length > 0) {
      for (const sectionId of pendingSyncSectionIds) {
        syncedReadProgressSectionIdsRef.current.add(sectionId)
      }

      void Promise.all(
        pendingSyncSectionIds.map(async (sectionId) => {
          try {
            await fetch(`/api/sections/${sectionId}/read-progress`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ done: true }),
            })
          } catch {
            syncedReadProgressSectionIdsRef.current.delete(sectionId)
          }
        })
      )
    }

    // Complementa com dados do Redis (assíncrono, cross-device)
    const sectionIdsParam = sections.map((s) => s.id).join(',')
    void fetch(`/api/sections/read-progress?section_ids=${sectionIdsParam}`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ done: Record<string, boolean> }>) : null))
      .then((data) => {
        if (!data?.done) return
        setReadSectionIds((prev) => {
          const next = new Set(prev)
          for (const [idStr, isDone] of Object.entries(data.done)) {
            if (!isDone) continue
            const id = Number(idStr)
            if (!Number.isFinite(id)) continue
            next.add(String(id))
            try {
              localStorage.setItem(`${SECTION_READ_LS_PREFIX}${id}`, 'done')
            } catch {
              // silencioso
            }
          }
          return next
        })
      })
      .catch(() => {
        // silencioso — estado local já foi aplicado
      })
  }, [sections])

  useEffect(() => {
    const handleReadProgressUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionId?: unknown; done?: unknown }>).detail
      if (!detail) return
      const sectionId = Number(detail.sectionId)
      if (!Number.isFinite(sectionId)) return
      const done = detail.done === true

      setReadSectionIds((prev) => {
        const next = new Set(prev)
        if (done) {
          next.add(String(sectionId))
        } else {
          next.delete(String(sectionId))
        }
        return next
      })
    }

    window.addEventListener('section-read-progress-updated', handleReadProgressUpdated)
    return () => {
      window.removeEventListener('section-read-progress-updated', handleReadProgressUpdated)
    }
  }, [])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [success])

  const categorySummaryItems = useMemo(() => {
    const summaryMap = new Map<string, { label: string; count: number }>()

    for (const category of categoryOptions) {
      const normalized = normalizeCategoryLabel(category)
      if (!normalized) continue
      const key = toCategoryKey(normalized)
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { label: normalized, count: 0 })
      }
    }

    for (const section of sections) {
      const category = normalizeCategoryLabel(sectionCategoryById[section.id])
      if (!category) continue

      const key = toCategoryKey(category)
      const existing = summaryMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        summaryMap.set(key, { label: category, count: 1 })
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
  }, [categoryOptions, sectionCategoryById, sections])

  const filteredSections = useMemo(() => {
    if (sectionsPagination.mode === 'server') return sections
    if (!selectedCategoryFilter) return sections

    const selectedKey = toCategoryKey(selectedCategoryFilter)
    return sections.filter((section) => {
      const category = normalizeCategoryLabel(sectionCategoryById[section.id])
      if (!category) return false
      return toCategoryKey(category) === selectedKey
    })
  }, [sections, sectionCategoryById, sectionsPagination.mode, selectedCategoryFilter])

  const totalPages = sectionsPagination.mode === 'server'
    ? Math.max(1, sectionsPagination.totalPages)
    : Math.max(1, Math.ceil(filteredSections.length / sectionsPerPage))
  const safeCurrentPage = clampPage(currentPage, totalPages)
  const paginatedSections = useMemo(() => {
    if (sectionsPagination.mode === 'server') {
      return filteredSections
    }

    const startIndex = (safeCurrentPage - 1) * sectionsPerPage
    return filteredSections.slice(startIndex, startIndex + sectionsPerPage)
  }, [filteredSections, safeCurrentPage, sectionsPagination.mode, sectionsPerPage])
  const totalSections = sectionsPagination.mode === 'server' ? sectionsPagination.total : filteredSections.length
  const startItemIndex =
    totalSections === 0
      ? 0
      : sectionsPagination.mode === 'server'
        ? sectionsPagination.from ?? (safeCurrentPage - 1) * sectionsPagination.perPage + 1
        : (safeCurrentPage - 1) * sectionsPerPage + 1
  const endItemIndex =
    totalSections === 0
      ? 0
      : sectionsPagination.mode === 'server'
        ? sectionsPagination.to ?? Math.min(safeCurrentPage * sectionsPagination.perPage, totalSections)
        : Math.min(safeCurrentPage * sectionsPerPage, filteredSections.length)

  const markImageAsLoaded = useCallback((url: string) => {
    setLoadedImageUrls((prev) => {
      if (prev[url]) return prev
      return {
        ...prev,
        [url]: true,
      }
    })
  }, [])

  const hasReachedGenerationLimit =
    !isLoadingUsageSummary &&
    usageSummary !== null &&
    usageSummary.limitInTenHours !== null &&
    usageSummary.limitInTenHours > 0 &&
    usageSummary.generatedInTenHours >= usageSummary.limitInTenHours

  const hasPreviousPage =
    sectionsPagination.mode === 'server'
      ? Boolean(sectionsPagination.links?.prev ?? (safeCurrentPage > 1))
      : safeCurrentPage > 1
  const hasNextPage =
    sectionsPagination.mode === 'server'
      ? Boolean(sectionsPagination.links?.next ?? (safeCurrentPage < totalPages))
      : safeCurrentPage < totalPages

  const goToPage = (page: number) => {
    const nextPage = clampPage(page, totalPages)
    if (nextPage === currentPageRef.current) return
    setCurrentPage(nextPage)
    currentPageRef.current = nextPage
    syncFiltersToUrl(nextPage, selectedCategoryFilter)
    if (sectionsPagination.mode === 'server') {
      void fetchSections(nextPage)
    }
  }

  const handleCategoryFilterChange = useCallback((nextCategory: string) => {
    const normalizedCategory = normalizeCategoryLabel(nextCategory)
    const currentKey = toCategoryKey(selectedCategoryFilter)
    const nextKey = toCategoryKey(normalizedCategory)
    if (currentKey === nextKey) return

    setSelectedCategoryFilter(normalizedCategory)
    setCurrentPage(1)
    currentPageRef.current = 1
    syncFiltersToUrl(1, normalizedCategory)
    void fetchSections(1, { force: true, categoryOverride: normalizedCategory })
  }, [fetchSections, selectedCategoryFilter, syncFiltersToUrl])

  const handleDeleteSection = async () => {
    if (!sectionToDelete) return

    setError('')
    setSuccess('')
    setDeletingSectionId(sectionToDelete.id)

    try {
      const response = await fetch(`/api/sections/${sectionToDelete.id}`, {
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

      setSuccess(data.message || `Seção ${sectionToDelete.id} removida com sucesso.`)
      setSectionToDelete(null)
      await fetchSections(currentPageRef.current, { force: true, preserveView: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover seção.')
    } finally {
      setDeletingSectionId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* CTA — Nova Tradução */}
      <Link href="/inicio/secoes/nova" data-tour="new-section">
        <div className="relative cursor-pointer rounded-xl overflow-hidden border border-primary/30 hover:border-primary/60 transition-all duration-300 group bg-card">
          {/* brilho de fundo no hover */}
          <div className="absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          {/* faixa superior */}
          <div className="h-0.75 w-full bg-linear-to-r from-primary/40 via-primary to-primary/40" />

          <div className="px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4 sm:gap-5">
            {/* ícone */}
            <div className="relative shrink-0">
              <div className="rounded-2xl bg-primary/15 group-hover:bg-primary/22 p-3.5 transition-colors duration-300">
                <Upload className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* texto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                  Nova Tradução
                </span>
                <span className="hidden sm:inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  IA
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
                Clique aqui para adicionar imagens ou PDF e traduzir automaticamente com IA.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                Clique aqui para traduzir com IA.
              </p>
            </div>

            {/* botão */}
            <div className="shrink-0 flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200">
              <PlusSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Criar</span>
            </div>
          </div>
        </div>
      </Link>


      {hasReachedGenerationLimit && usageSummary && (
        <Card className="relative overflow-hidden border-border bg-card p-4 sm:p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary/50 via-primary to-primary/50" />
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Limite atual atingido
              </div>

              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Quer continuar agora? Fale com a gente
              </h2>

              <p className="text-sm text-muted-foreground">
                Uso atual:{' '}
                <span className="font-semibold text-foreground">
                  {usageSummary.generatedInTenHours}/{usageSummary.limitInTenHours}
                </span>{' '}
                PDFs no mes. Ajuste o limite da sua instância local nas configurações.
              </p>
            </div>
          </div>
        </Card>
      )}


      <section className="mt-3 rounded-xl bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Biblioteca de Seções</h1>
            <p className="text-sm text-muted-foreground">
              Navegue pelas seções criadas, abra páginas e acompanhe status de processamento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLoadingSections && totalSections > 0 && (
              <span className="rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                Mostrando {startItemIndex}-{endItemIndex} de {totalSections}
              </span>
            )}
            {!isLoadingUsageSummary && usageSummary && (
              <div data-tour="usage-stats" className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                    Limite: <span className="font-semibold text-foreground">{usageSummary.limitInTenHours ?? '—'}</span>
                  </span>
                  <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                    Gerado: <span className="font-semibold text-foreground">{usageSummary.generatedInTenHours}</span>
                  </span>
                </div>
                {usageSummary.limitInTenHours !== null && usageSummary.limitInTenHours > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        hasReachedGenerationLimit ? 'bg-destructive' : 'bg-primary'
                      )}
                      style={{
                        width: `${Math.min(100, (usageSummary.generatedInTenHours / usageSummary.limitInTenHours) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchSections(currentPage, { force: true })}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {!isLoadingSections && sections.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Categorias</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  !selectedCategoryFilter
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
                onClick={() => handleCategoryFilterChange('')}
              >
                Todas ({sectionsPagination.total})
              </button>
              {categorySummaryItems.map((categoryItem) => (
                <button
                  key={categoryItem.label}
                  type="button"
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    toCategoryKey(selectedCategoryFilter) === toCategoryKey(categoryItem.label)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => handleCategoryFilterChange(categoryItem.label)}
                >
                  <span>{categoryItem.label}</span>
                  <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">
                    {categoryItem.count}
                  </span>
                </button>
              ))}
              {isLoadingCategories && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando categorias...
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      <section className="space-y-4">
        {isLoadingSections ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: sectionsPerPage }).map((_, i) => (
              <div key={i} className="rounded-xl bg-card/70 p-2 sm:p-2.5 ring-1 ring-border/40">
                <Skeleton className="aspect-3/4 w-full rounded-lg" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl bg-muted/40 p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma seção ainda</p>
                <p className="mt-1 text-xs text-muted-foreground">Clique em &quot;Nova Tradução&quot; para começar.</p>
              </div>
              <Button asChild size="sm">
                <Link href="/inicio/secoes/nova">
                  <PlusSquare className="h-4 w-4" />
                  Nova Tradução
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {selectedCategoryFilter && paginatedSections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 py-8 text-center text-sm text-muted-foreground">
                Nenhuma seção encontrada na categoria "{selectedCategoryFilter}".
              </div>
            ) : (
              <div data-tour="sections-grid" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedSections.map((section) => {
                  const queueState = getSectionQueueState(section, null)
                  const priorityInfo = getSectionPriorityInfo(section.priority)
                  const providerLabel = 'Google'
                  const priorityCode =
                    priorityInfo.badgeLabel.match(/P\d+/i)?.[0]?.toUpperCase() ?? priorityInfo.badgeLabel
                  const coverUrl = section.cover?.image_id
                    ? buildImageViewUrl(section.id, section.cover.image_id, 'original')
                    : null
                  const isCoverLoaded = coverUrl ? Boolean(loadedImageUrls[coverUrl]) : true

                  return (
                    <article
                      key={section.id}
                      className="group cursor-pointer rounded-xl bg-card/70 p-2 sm:p-2.5 ring-1 ring-border/40 transition-all duration-200 hover:bg-card hover:ring-primary/40"
                      onClick={() => {
                        const detailHref = safeCurrentPage > 1
                          ? `/inicio/secoes/${section.id}?page=${safeCurrentPage}`
                          : `/inicio/secoes/${section.id}`
                        router.push(detailHref)
                      }}
                    >
                      <div className="relative aspect-3/4 overflow-hidden rounded-lg bg-muted/35">
                        {readSectionIds.has(String(section.id)) && (
                          <div className="absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-full border border-emerald-700 bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              Lido 
                          </div>
                        )}
                        {coverUrl ? (
                          <>
                            {!isCoverLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
                            <img
                              src={coverUrl}
                              alt={`Capa da seção ${section.name}`}
                              className={cn(
                                'h-full w-full object-cover transition-all duration-300 group-hover:scale-105',
                                isCoverLoaded ? 'opacity-100' : 'opacity-0'
                              )}
                              loading="lazy"
                              decoding="async"
                              onLoad={() => markImageAsLoaded(coverUrl)}
                              onError={() => markImageAsLoaded(coverUrl)}
                            />
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}

                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-md bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <BookOpen className="h-7 w-7 text-white drop-shadow" />
                          <span className="text-xs font-semibold tracking-wide text-white drop-shadow">Ler</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p
                          className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary sm:text-base"
                          title={section.name}
                        >
                          {section.name}
                        </p>

                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary">{formatStatus(section.status)}</Badge>
                          <div className="hidden flex-wrap gap-1 sm:flex">
                            <Badge variant="outline">
                              {section.source_lang} → {section.target_lang}
                            </Badge>
                            <Badge variant="outline">{providerLabel}</Badge>
                            <Badge
                              variant="outline"
                              className={cn(priorityInfo.tier === 'admin' && 'border-primary/50 text-primary')}
                            >
                              {priorityInfo.badgeLabel}
                            </Badge>
                          </div>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground sm:hidden">
                          <span>
                            {section.source_lang} → {section.target_lang}
                          </span>
                          <span className="px-1">•</span>
                          <span>{providerLabel}</span>
                          <span className="px-1">•</span>
                          <span className={cn(priorityInfo.tier === 'admin' && 'font-medium text-primary')}>
                            {priorityCode}
                          </span>
                        </p>

                        <p
                          className={cn(
                            'text-xs',
                            readSectionIds.has(String(section.id))
                              ? 'text-green-600 dark:text-green-400 sm:text-muted-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {section.images_count} páginas
                          <span className="hidden sm:inline"> • {priorityInfo.description}</span>
                        </p>
                        <p className="hidden text-xs text-muted-foreground sm:block">
                          Atualizado em {formatSectionDate(section.updated_at)}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-2',
                          queueState.canQueue ? 'mt-3' : 'mt-0 sm:mt-3 justify-between'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button asChild size="sm" variant="outline" className="hidden flex-1 min-w-0 sm:flex sm:min-w-30">
                          <Link href={`/inicio/secoes/${section.id}`}>
                            <BookOpen className="h-4 w-4" />
                            Abrir
                          </Link>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="hidden text-muted-foreground hover:border-destructive/50 hover:text-destructive sm:inline-flex"
                          disabled={deletingSectionId === section.id}
                          onClick={() => setSectionToDelete(section)}
                        >
                          {deletingSectionId === section.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>

                        {!queueState.canQueue && (
                          <Badge variant={queueState.completed ? 'secondary' : 'outline'}>
                            {queueState.completed ? 'Concluída' : 'Em fila'}
                          </Badge>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-center text-xs text-muted-foreground sm:text-left">
                    Página {safeCurrentPage} de {totalPages}
                  </p>

                  <ReactPaginate
                    breakLabel="..."
                    nextLabel={<ChevronRight className="h-4 w-4" />}
                    previousLabel={<ChevronLeft className="h-4 w-4" />}
                    forcePage={safeCurrentPage - 1}
                    pageCount={totalPages}
                    pageRangeDisplayed={3}
                    marginPagesDisplayed={1}
                    onPageChange={(selectedItem) => {
                      const nextPage = selectedItem.selected + 1
                      if (nextPage !== safeCurrentPage) goToPage(nextPage)
                    }}
                    containerClassName="flex flex-wrap items-center justify-center gap-1"
                    pageClassName=""
                    pageLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    activeClassName=""
                    activeLinkClassName="border-primary bg-primary text-primary-foreground hover:bg-primary"
                    previousClassName=""
                    previousLinkClassName={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted',
                      !hasPreviousPage && 'pointer-events-none opacity-40'
                    )}
                    nextClassName=""
                    nextLinkClassName={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted',
                      !hasNextPage && 'pointer-events-none opacity-40'
                    )}
                    breakClassName=""
                    breakLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 bg-muted/20 px-2.5 text-sm text-muted-foreground"
                    disabledClassName="pointer-events-none opacity-40"
                    renderOnZeroPageCount={null}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <AlertDialog
        open={Boolean(sectionToDelete)}
        onOpenChange={(open) => {
          if (!open && deletingSectionId === null) {
            setSectionToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir seção</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai remover a seção "{sectionToDelete?.name}" e todos os vínculos dela.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSectionId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteSection()
              }}
              disabled={deletingSectionId !== null}
            >
              {deletingSectionId !== null ? (
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
        storageKey="tour-library-v2"
        open={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        steps={LIBRARY_TOUR_STEPS}
      />
    </div>
  )
}

const LIBRARY_TOUR_STEPS: TourStep[] = [
  {
    title: 'Bem-vindo à Biblioteca!',
    description: 'Este é o seu painel principal. Aqui ficam todos os capítulos e lotes de páginas que você enviou para tradução. Vou te guiar pelos recursos essenciais.',
  },
  {
    title: 'Criar Nova Tradução',
    description: 'Toque aqui para começar. Você pode enviar imagens (JPG, PNG…) ou um PDF completo — cada página do PDF vira uma imagem automaticamente.',
    selector: 'new-section',
    tooltipSide: 'bottom',
  },
  {
    title: 'Suas Seções',
    description: 'Cada card é uma seção. Toque na capa para abrir, ver o status de cada página, selecionar quais traduzir e iniciar o processamento com IA.',
    selector: 'sections-grid',
    tooltipSide: 'top',
  },
  {
    title: 'Seu uso mensal',
    description: 'Aqui você acompanha quantas seções já foram geradas e qual é o seu limite no período. Ao atingir o limite, novas criações ficam pausadas até a renovação.',
    selector: 'usage-stats',
    tooltipSide: 'bottom',
  },
]

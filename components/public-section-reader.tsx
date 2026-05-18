'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  buildPublicImageViewUrl,
  formatSectionDate,
  formatStatus,
  normalizeStatus,
  type PublicSectionDetail,
} from '@/lib/sections'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

interface PublicSectionReaderProps {
  sharedKey: string
}

const STATUS_POLL_INTERVAL_MS = 5000
const READING_PRELOAD_RADIUS = 2
const SWIPE_TRIGGER_PX = 56
const SWIPE_DIRECTION_RATIO = 1.2
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
const TRANSLATED_IMAGE_STATUSES = new Set([
  'translated',
  'done',
  'completed',
  'success',
  'sucesso',
  'concluido',
  'concluida',
])
const IMAGE_PROCESSING_STATUSES = new Set([
  'processing',
  'processando',
  'in_progress',
  'running',
  'traduzindo',
  'translating',
])

function toErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const maybeMessage = (payload as { message?: string; error?: string }).message
      || (payload as { message?: string; error?: string }).error
    if (maybeMessage) return maybeMessage
  }
  return fallback
}

function isPublicImageTranslated(image: PublicSectionDetail['images'][number]) {
  const translationStatus = normalizeStatus(image.translation_status)
  return Boolean(image.translated_url) || TRANSLATED_IMAGE_STATUSES.has(translationStatus)
}

export function PublicSectionReader({ sharedKey }: PublicSectionReaderProps) {
  const [section, setSection] = useState<PublicSectionDetail | null>(null)
  const [isLoadingSection, setIsLoadingSection] = useState(true)
  const [isPollingStatus, setIsPollingStatus] = useState(false)
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [readingMode, setReadingMode] = useState(false)
  const [currentReadingPage, setCurrentReadingPage] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, boolean>>({})
  const [isReadingImageLoading, setIsReadingImageLoading] = useState(false)
  const readingTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const readingSwipeLockedRef = useRef(false)

  const markImageAsLoaded = useCallback((url: string) => {
    setLoadedImageUrls((prev) => {
      if (prev[url]) return prev
      return {
        ...prev,
        [url]: true,
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
      const response = await fetch(`/api/public/sections/${encodeURIComponent(sharedKey)}`, { cache: 'no-store' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível carregar a seção pública.'))
      }

      setSection(data as PublicSectionDetail)
      setLastStatusSyncAt(Date.now())
      if (!silent) {
        setError('')
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar seção pública.')
      }
    } finally {
      if (silent) {
        setIsPollingStatus(false)
      } else {
        setIsLoadingSection(false)
      }
    }
  }, [sharedKey])

  useEffect(() => {
    void fetchSection()
  }, [fetchSection])

  const sectionImages = useMemo(() => {
    if (!section) return []
    return section.images.slice().sort((a, b) => a.order_index - b.order_index)
  }, [section])

  useEffect(() => {
    if (sectionImages.length === 0) {
      setCurrentReadingPage(0)
      return
    }

    if (currentReadingPage > sectionImages.length - 1) {
      setCurrentReadingPage(sectionImages.length - 1)
    }
  }, [currentReadingPage, sectionImages])

  const sectionStatusNormalized = normalizeStatus(section?.status)
  const shouldPollStatus = QUEUE_OR_PROCESSING_STATUSES.has(sectionStatusNormalized)

  useEffect(() => {
    if (!shouldPollStatus) return

    const intervalId = window.setInterval(() => {
      void fetchSection({ silent: true })
    }, STATUS_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [fetchSection, shouldPollStatus])

  const openReadingPage = (pageIndex: number) => {
    setCurrentReadingPage(pageIndex)
    setZoom(100)
    setReadingMode(true)
  }

  const goToPreviousPage = () => {
    setCurrentReadingPage((prev) => Math.max(0, prev - 1))
  }

  const goToNextPage = () => {
    setCurrentReadingPage((prev) => Math.min(sectionImages.length - 1, prev + 1))
  }

  const currentPage = sectionImages[currentReadingPage] ?? null
  const readingOriginalViewUrl = currentPage
    ? buildPublicImageViewUrl(sharedKey, currentPage.id, 'original')
    : ''
  const readingTranslatedViewUrl = currentPage
    ? buildPublicImageViewUrl(sharedKey, currentPage.id, 'translated')
    : ''
  const readingTranslatedAvailable = currentPage ? isPublicImageTranslated(currentPage) : false
  const readingDisplayUrl = currentPage
    ? (readingTranslatedAvailable ? readingTranslatedViewUrl : readingOriginalViewUrl)
    : ''

  useEffect(() => {
    if (!readingMode || !readingDisplayUrl) {
      setIsReadingImageLoading(false)
      return
    }

    setIsReadingImageLoading(!loadedImageUrls[readingDisplayUrl])
  }, [loadedImageUrls, readingDisplayUrl, readingMode])

  useEffect(() => {
    if (!readingMode || sectionImages.length === 0) return

    const adjacentIndexes: number[] = []
    for (let offset = 1; offset <= READING_PRELOAD_RADIUS; offset++) {
      adjacentIndexes.push(currentReadingPage - offset, currentReadingPage + offset)
    }

    adjacentIndexes.forEach((pageIndex) => {
      const adjacentImage = sectionImages[pageIndex]
      if (!adjacentImage) return

      const adjacentUrl = isPublicImageTranslated(adjacentImage)
        ? buildPublicImageViewUrl(sharedKey, adjacentImage.id, 'translated')
        : buildPublicImageViewUrl(sharedKey, adjacentImage.id, 'original')

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
    sectionImages,
    sharedKey,
  ])

  const handleReadingTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
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

  if (readingMode && section && currentPage) {
    const translatedAvailable = readingTranslatedAvailable
    const originalViewUrl = readingOriginalViewUrl
    const translatedViewUrl = readingTranslatedViewUrl
    const displayUrl = readingDisplayUrl

    const statusA = normalizeStatus(currentPage.status)
    const statusB = normalizeStatus(currentPage.translation_status)
    const isCurrentProcessing = IMAGE_PROCESSING_STATUSES.has(statusA) || IMAGE_PROCESSING_STATUSES.has(statusB)

    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        <div className="flex-none bg-card border-b border-border p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReadingMode(false)}
              className="h-9 px-2 sm:px-3"
            >
              <X className="h-5 w-5" />
              <span className="hidden sm:inline ml-2">Fechar</span>
            </Button>

            <div className="flex items-center gap-2">
              {translatedAvailable ? (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  Traduzida
                </span>
              ) : (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Original
                </span>
              )}
              {isCurrentProcessing && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processando
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((value) => Math.max(25, value - 10))}
                className="h-9 w-9 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs w-10 text-center">{zoom}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((value) => Math.min(300, value + 10))}
                className="h-9 w-9 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-auto bg-muted/30"
          onTouchStart={handleReadingTouchStart}
          onTouchMove={handleReadingTouchMove}
          onTouchEnd={handleReadingTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center p-2 sm:p-4">
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
                onLoad={() => markImageAsLoaded(displayUrl)}
                onError={() => markImageAsLoaded(displayUrl)}
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                }}
              />
            </div>
          </div>
        </div>

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
                    Página {image.order_index + 1} {isPublicImageTranslated(image) ? '(Traduzida)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={goToNextPage}
              disabled={currentReadingPage === sectionImages.length - 1}
              className="h-12 w-20 sm:w-24"
            >
              <span className="hidden sm:inline mr-1">Próx.</span>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/inicio/secoes">
              <ArrowLeft className="h-4 w-4" />
              Ir para a biblioteca
            </Link>
          </Button>

          <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void fetchSection()}>
              Atualizar
            </Button>
            {sectionImages.length > 0 && (
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => openReadingPage(0)}>
                <BookOpen className="h-4 w-4" />
                Modo Leitura
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-3 text-sm text-destructive bg-destructive/10 border-destructive/30">
          {error}
        </Card>
      )}

      {isLoadingSection ? (
        <Card className="p-8">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando seção pública...
          </div>
        </Card>
      ) : !section ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar a seção pública.
        </Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{section.name}</h1>
              <p className="text-sm text-muted-foreground">Visualização pública</p>
            </div>

            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{formatStatus(section.status)}</Badge>
              <Badge variant="outline">{section.source_lang} → {section.target_lang}</Badge>
              {shouldPollStatus && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className={cn('h-3 w-3', isPollingStatus && 'animate-spin')} />
                  Monitorando status
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Criada em {formatSectionDate(section.created_at)} • Atualizada em {formatSectionDate(section.updated_at)}
            </p>
            <p className="text-xs text-muted-foreground">
              {shouldPollStatus
                ? `Atualização automática a cada ${STATUS_POLL_INTERVAL_MS / 1000}s.`
                : 'Atualização automática pausada.'}
              {lastStatusSyncAt
                ? ` Última checagem: ${new Date(lastStatusSyncAt).toLocaleTimeString('pt-BR')}.`
                : ''}
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold text-foreground mb-3">Páginas compartilhadas</h2>

            {sectionImages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem páginas disponíveis nesta seção.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sectionImages.map((image, idx) => {
                  const translatedAvailable = isPublicImageTranslated(image)
                  const originalViewUrl = buildPublicImageViewUrl(sharedKey, image.id, 'original')
                  const translatedViewUrl = buildPublicImageViewUrl(sharedKey, image.id, 'translated')
                  const previewUrl = translatedAvailable ? translatedViewUrl : originalViewUrl

                  return (
                    <article key={image.id} className="rounded-md border border-border p-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => openReadingPage(idx)}
                        className="w-full text-left"
                      >
                        <div className="aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted/30">
                          <img
                            src={previewUrl}
                            alt={`Página ${image.order_index + 1} - ${section.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </button>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground truncate" title={image.original_name}>
                          Pág. {image.order_index + 1}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={image.original_name}>
                          {image.original_name}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{formatStatus(image.status)}</Badge>
                          <Badge variant={translatedAvailable ? 'secondary' : 'outline'}>
                            {translatedAvailable ? 'Traduzida' : formatStatus(image.translation_status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 min-w-[110px]"
                          onClick={() => openReadingPage(idx)}
                        >
                          <BookOpen className="h-4 w-4" />
                          Ler
                        </Button>

                        {/* <Button asChild variant="outline" size="sm" className="flex-1 min-w-[110px]">
                          <a href={previewUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </a>
                        </Button> */}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

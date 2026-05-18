'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatSectionDate, normalizeStatus, toErrorMessage } from '@/lib/sections'
import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  Gauge,
  Layers,
  ListOrdered,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'

interface AuthMeResponse {
  role?: number
  message?: string
  error?: string
}

interface GlobalQueueApiItem {
  job_id?: number
  section_id?: number
  section_name?: string
  job_status?: string
  position?: number | null
  jobs_ahead?: number
  priority?: number
  translated_pages?: number
  total_pages?: number
  estimated_wait_seconds?: number
  estimated_wait_minutes?: number
  estimated_start_at?: string | null
  created_at?: string
  started_at?: string | null
  finished_at?: string | null
  error_message?: string | null
}

interface GlobalQueueApiResponse {
  total_jobs?: number
  total_in_queue?: number
  avg_ms_per_image_reference?: number | null
  items?: GlobalQueueApiItem[]
  message?: string
  error?: string
}

interface GlobalQueueItem {
  jobId: number
  sectionId: number
  sectionName: string
  jobStatus: string
  position: number | null
  jobsAhead: number
  priority: number
  translatedPages: number
  totalPages: number
  estimatedWaitSeconds: number
  estimatedWaitMinutes: number
  estimatedStartAt: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
}

interface GlobalQueueData {
  totalJobs: number
  totalInQueue: number
  avgMsPerImageReference: number | null
  items: GlobalQueueItem[]
}

interface PriorityUpdateResponse {
  id?: number
  priority?: number
  status?: string
  message?: string
  error?: string
}

interface QueueRemoveResponse {
  message?: string
  error?: string
  section?: { id?: number; status?: string }
}

const PROCESSING_JOB_STATUSES = new Set([
  'processing', 'processando', 'in_progress', 'running', 'traduzindo', 'translating',
])

const QUEUED_JOB_STATUSES = new Set([
  'queued', 'queue', 'em_fila', 'na_fila', 'pending', 'waiting', 'aguardando',
])

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeQueueItem(item: GlobalQueueApiItem): GlobalQueueItem | null {
  const jobId = toFiniteNumber(item.job_id)
  const sectionId = toFiniteNumber(item.section_id)
  const createdAt = toStringValue(item.created_at)
  if (jobId === null || sectionId === null || !createdAt) return null
  return {
    jobId,
    sectionId,
    sectionName: toStringValue(item.section_name) || `Seção #${sectionId}`,
    jobStatus: toStringValue(item.job_status) || 'desconhecido',
    position: toFiniteNumber(item.position),
    jobsAhead: toFiniteNumber(item.jobs_ahead) ?? 0,
    priority: toFiniteNumber(item.priority) ?? 0,
    translatedPages: toFiniteNumber(item.translated_pages) ?? 0,
    totalPages: toFiniteNumber(item.total_pages) ?? 0,
    estimatedWaitSeconds: toFiniteNumber(item.estimated_wait_seconds) ?? 0,
    estimatedWaitMinutes: toFiniteNumber(item.estimated_wait_minutes) ?? 0,
    estimatedStartAt: toNullableString(item.estimated_start_at),
    createdAt,
    startedAt: toNullableString(item.started_at),
    finishedAt: toNullableString(item.finished_at),
    errorMessage: toNullableString(item.error_message),
  }
}

function formatMaybeDate(value: string | null) {
  if (!value) return '—'
  return formatSectionDate(value)
}

function formatAvgPerImage(value: number | null) {
  if (value === null) return '—'
  return `${(value / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}s`
}

function resolveStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const n = normalizeStatus(status)
  if (n === 'done' || n === 'completed' || n === 'success') return 'secondary'
  if (n === 'failed' || n === 'error') return 'destructive'
  if (PROCESSING_JOB_STATUSES.has(n) || QUEUED_JOB_STATUSES.has(n)) return 'default'
  return 'outline'
}

function resolveStatusColor(status: string) {
  const n = normalizeStatus(status)
  if (n === 'done' || n === 'completed' || n === 'success')
    return 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
  if (n === 'failed' || n === 'error')
    return 'text-destructive bg-destructive/10 border-destructive/20'
  if (PROCESSING_JOB_STATUSES.has(n))
    return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20'
  if (QUEUED_JOB_STATUSES.has(n))
    return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-muted-foreground bg-muted/30 border-border'
}

function progressPercent(translated: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((translated / total) * 100)))
}

export function AdminSectionsQueue() {
  const router = useRouter()

  const [queueData, setQueueData] = useState<GlobalQueueData | null>(null)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [isLoadingQueue, setIsLoadingQueue] = useState(true)
  const [actionProcessingKey, setActionProcessingKey] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleUnauthorized = useCallback(() => {
    router.replace('/login?expired=1')
  }, [router])

  const fetchGlobalQueue = useCallback(async () => {
    setIsLoadingQueue(true)
    try {
      const response = await fetch('/api/admin/sections/queue', { cache: 'no-store' })
      const payload = (await response.json()) as GlobalQueueApiResponse
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok) throw new Error(toErrorMessage(payload, 'Não foi possível carregar a fila global.'))

      const normalizedItems = Array.isArray(payload.items)
        ? payload.items
            .map((item) => normalizeQueueItem(item))
            .filter((item): item is GlobalQueueItem => item !== null)
            .sort((a, b) => b.jobId - a.jobId)
        : []

      setQueueData({
        totalJobs: toFiniteNumber(payload.total_jobs) ?? normalizedItems.length,
        totalInQueue: toFiniteNumber(payload.total_in_queue) ?? 0,
        avgMsPerImageReference: toFiniteNumber(payload.avg_ms_per_image_reference),
        items: normalizedItems,
      })
      setLastSyncAt(Date.now())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fila global.')
    } finally {
      setIsLoadingQueue(false)
    }
  }, [handleUnauthorized, router])

  const handlePrioritizeSection = useCallback(async (sectionId: number) => {
    const actionKey = `priority:${sectionId}`
    setActionProcessingKey(actionKey)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/sections/${sectionId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 10 }),
      })
      const data = (await response.json()) as PriorityUpdateResponse
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível priorizar a seção.'))
      setSuccess(data.message || `Seção ${sectionId} priorizada com sucesso.`)
      await fetchGlobalQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao priorizar seção.')
    } finally {
      setActionProcessingKey(null)
    }
  }, [fetchGlobalQueue, handleUnauthorized, router])

  const handleRemoveFromQueue = useCallback(async (sectionId: number) => {
    const actionKey = `dequeue:${sectionId}`
    setActionProcessingKey(actionKey)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/sections/${sectionId}/queue`, { method: 'DELETE' })
      const data = (await response.json()) as QueueRemoveResponse
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível remover da fila.'))
      setSuccess(data.message || `Seção ${sectionId} removida da fila.`)
      await fetchGlobalQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover seção da fila.')
    } finally {
      setActionProcessingKey(null)
    }
  }, [fetchGlobalQueue, handleUnauthorized, router])

  useEffect(() => {
    let cancelled = false
    const checkAccess = async () => {
      setIsCheckingAccess(true)
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = (await response.json()) as AuthMeResponse
        if (cancelled) return
        if (response.status === 401) { handleUnauthorized(); return }
        if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível verificar permissão.'))
        if (data.role !== 4) { router.replace('/inicio/secoes'); return }
        await fetchGlobalQueue()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao validar permissão.')
          setIsLoadingQueue(false)
        }
      } finally {
        if (!cancelled) setIsCheckingAccess(false)
      }
    }
    void checkAccess()
    return () => { cancelled = true }
  }, [fetchGlobalQueue, handleUnauthorized, router])

  const avgPerImageLabel = useMemo(
    () => formatAvgPerImage(queueData?.avgMsPerImageReference ?? null),
    [queueData?.avgMsPerImageReference]
  )

  const processingCount = useMemo(
    () => queueData?.items.filter((i) => PROCESSING_JOB_STATUSES.has(normalizeStatus(i.jobStatus))).length ?? 0,
    [queueData]
  )
  const successCount = useMemo(
    () => queueData?.items.filter((i) => {
      const n = normalizeStatus(i.jobStatus)
      return n === 'done' || n === 'completed' || n === 'success'
    }).length ?? 0,
    [queueData]
  )
  const failedCount = useMemo(
    () => queueData?.items.filter((i) => {
      const n = normalizeStatus(i.jobStatus)
      return n === 'failed' || n === 'error'
    }).length ?? 0,
    [queueData]
  )

  if (isCheckingAccess) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Validando acesso...
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Fila Global</h1>
            <p className="text-sm text-muted-foreground">
              Visão administrativa dos jobs de processamento.
              {lastSyncAt && (
                <span className="ml-1 text-xs">
                  · Sync às {new Date(lastSyncAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchGlobalQueue()}
            disabled={isLoadingQueue}
            className="w-full sm:w-auto"
          >
            {isLoadingQueue
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </Card>

      {/* Feedback */}
      {error && (
        <Card className="p-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border-destructive/30">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      )}
      {success && (
        <Card className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30">
          {success}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total de jobs</p>
            <p className="text-2xl font-semibold text-foreground">
              {(queueData?.totalJobs ?? 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 shrink-0">
            <ListOrdered className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Em fila</p>
            <p className="text-2xl font-semibold text-foreground">
              {(queueData?.totalInQueue ?? 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5 shrink-0">
            <Zap className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Processando</p>
            <p className="text-2xl font-semibold text-foreground">{processingCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-green-500/10 p-2.5 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-semibold text-foreground">{successCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-destructive/10 p-2.5 shrink-0">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Falharam</p>
            <p className="text-2xl font-semibold text-foreground">{failedCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-muted/40 p-2.5 shrink-0">
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Média / imagem</p>
            <p className="text-2xl font-semibold text-foreground">{avgPerImageLabel}</p>
          </div>
        </Card>
      </div>

      {/* Tabela / Cards */}
      <Card className="overflow-hidden p-0">
        {isLoadingQueue && !queueData ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando fila global...
          </div>
        ) : !queueData || queueData.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum job encontrado na fila global.
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="divide-y divide-border lg:hidden">
              {queueData.items.map((item) => {
                const normalizedJobStatus = normalizeStatus(item.jobStatus)
                const isProcessingJob = PROCESSING_JOB_STATUSES.has(normalizedJobStatus)
                const isQueuedJob = QUEUED_JOB_STATUSES.has(normalizedJobStatus) || item.position !== null
                const canPrioritize = isQueuedJob && !isProcessingJob && item.priority < 10
                const canRemoveFromQueue = isQueuedJob && !isProcessingJob
                const isPrioritizing = actionProcessingKey === `priority:${item.sectionId}`
                const isRemovingFromQueue = actionProcessingKey === `dequeue:${item.sectionId}`
                const pct = progressPercent(item.translatedPages, item.totalPages)

                return (
                  <div key={item.jobId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/inicio/secoes/${item.sectionId}`}
                          className="font-medium text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {item.sectionName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Job #{item.jobId} · Seção #{item.sectionId}
                        </p>
                      </div>
                      <span className={cn(
                        'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border',
                        resolveStatusColor(item.jobStatus)
                      )}>
                        {normalizeStatus(item.jobStatus).replace(/_/g, ' ')}
                      </span>
                    </div>

                    {item.totalPages > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{item.translatedPages}/{item.totalPages} ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {item.position !== null && (
                        <span className="flex items-center gap-1">
                          <ListOrdered className="h-3 w-3" />
                          Posição #{item.position}
                        </span>
                      )}
                      {item.estimatedWaitMinutes > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{item.estimatedWaitMinutes} min
                        </span>
                      )}
                      <span>Prioridade {item.priority}</span>
                      <span>Criado {formatSectionDate(item.createdAt)}</span>
                    </div>

                    {item.errorMessage && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                        {item.errorMessage}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        disabled={!canPrioritize || isPrioritizing || isRemovingFromQueue}
                        onClick={() => void handlePrioritizeSection(item.sectionId)}
                      >
                        {isPrioritizing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        Priorizar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50"
                        disabled={!canRemoveFromQueue || isPrioritizing || isRemovingFromQueue}
                        onClick={() => void handleRemoveFromQueue(item.sectionId)}
                      >
                        {isRemovingFromQueue
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                        Remover
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-20">Job</TableHead>
                    <TableHead>Seção</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Fila / Espera</TableHead>
                    <TableHead className="w-20">Prior.</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Finalizado</TableHead>
                    <TableHead className="w-40">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueData.items.map((item) => {
                    const normalizedJobStatus = normalizeStatus(item.jobStatus)
                    const isProcessingJob = PROCESSING_JOB_STATUSES.has(normalizedJobStatus)
                    const isQueuedJob = QUEUED_JOB_STATUSES.has(normalizedJobStatus) || item.position !== null
                    const canPrioritize = isQueuedJob && !isProcessingJob && item.priority < 10
                    const canRemoveFromQueue = isQueuedJob && !isProcessingJob
                    const isPrioritizing = actionProcessingKey === `priority:${item.sectionId}`
                    const isRemovingFromQueue = actionProcessingKey === `dequeue:${item.sectionId}`
                    const pct = progressPercent(item.translatedPages, item.totalPages)

                    return (
                      <TableRow key={item.jobId} className={cn(isProcessingJob && 'bg-blue-500/5')}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          #{item.jobId}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/inicio/secoes/${item.sectionId}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {item.sectionName}
                          </Link>
                          <p className="text-xs text-muted-foreground">#{item.sectionId}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
                            resolveStatusColor(item.jobStatus)
                          )}>
                            {normalizeStatus(item.jobStatus).replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-32.5">
                          {item.totalPages > 0 ? (
                            <div className="space-y-1">
                              <Progress value={pct} className="h-1.5 w-24" />
                              <p className="text-xs text-muted-foreground">
                                {item.translatedPages}/{item.totalPages} ({pct}%)
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {item.position !== null ? `#${item.position}` : '—'}
                          </p>
                          {item.estimatedWaitMinutes > 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ~{item.estimatedWaitMinutes} min
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.priority >= 10 ? 'default' : 'outline'} className="text-xs">
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatSectionDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatMaybeDate(item.finishedAt)}
                          {item.errorMessage && (
                            <p className="text-destructive truncate max-w-35" title={item.errorMessage}>
                              {item.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={!canPrioritize || isPrioritizing || isRemovingFromQueue}
                              onClick={() => void handlePrioritizeSection(item.sectionId)}
                              title="Priorizar (10)"
                            >
                              {isPrioritizing
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <ArrowUpCircle className="h-3 w-3" />}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50"
                              disabled={!canRemoveFromQueue || isPrioritizing || isRemovingFromQueue}
                              onClick={() => void handleRemoveFromQueue(item.sectionId)}
                              title="Remover da fila"
                            >
                              {isRemovingFromQueue
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

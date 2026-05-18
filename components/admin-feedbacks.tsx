'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, RefreshCw, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FeedbackItem {
  id: number
  section_id: number
  section_name: string
  user_id: number
  stars: number
  comment: string | null
  created_at: string
  updated_at: string
}

interface FeedbacksResponse {
  total_feedbacks: number
  items: FeedbackItem[]
}

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= stars ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

function isReport(comment: string | null) {
  return comment?.startsWith('[') && comment.includes(']')
}

function parseReport(comment: string) {
  const match = comment.match(/^\[(.+?)\](.*)$/)
  if (!match) return { type: comment, detail: '' }
  return { type: match[1]!.trim(), detail: match[2]!.trim() }
}

export function AdminFeedbacks() {
  const router = useRouter()
  const [data, setData] = useState<FeedbacksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/sections/feedbacks', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/login?expired=1'); return }
      if (res.status === 403) { setError('Acesso restrito a administradores.'); return }
      if (!res.ok) { setError('Erro ao carregar feedbacks.'); return }
      const json = await res.json() as FeedbacksResponse
      setData(json)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void fetchFeedbacks() }, [fetchFeedbacks])

  const reports = data?.items.filter((i) => isReport(i.comment)) ?? []
  const ratings = data?.items.filter((i) => !isReport(i.comment)) ?? []
  const avgStars = ratings.length
    ? (ratings.reduce((s, i) => s + i.stars, 0) / ratings.length).toFixed(1)
    : null

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Feedbacks</h1>
            <p className="text-sm text-muted-foreground">
              Avaliações e problemas reportados pelos usuários.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchFeedbacks()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-4 text-sm text-destructive bg-destructive/10 border-destructive/30">
          {error}
        </Card>
      )}

      {loading && !data && (
        <Card className="p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando feedbacks…
        </Card>
      )}

      {data && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: data.total_feedbacks },
              { label: 'Avaliações', value: ratings.length },
              { label: 'Problemas', value: reports.length },
              { label: 'Média', value: avgStars ? `★ ${avgStars}` : '—' },
            ].map((s) => (
              <Card key={s.label} className="p-3 sm:p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Problemas reportados */}
          {reports.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground">Problemas reportados</h2>
                <Badge variant="destructive" className="ml-auto">{reports.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {reports.map((item) => {
                  const { type, detail } = parseReport(item.comment ?? '')
                  return (
                    <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-destructive border-destructive/40 text-[11px]">
                            {type}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {item.section_name}
                          </span>
                        </div>
                        {detail && (
                          <p className="text-sm text-foreground">{detail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                        <span>Usuário #{item.user_id}</span>
                        <span>·</span>
                        <span>{timeAgo(item.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Avaliações */}
          {ratings.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Avaliações</h2>
                <Badge variant="secondary" className="ml-auto">{ratings.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {ratings.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StarDisplay stars={item.stars} />
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.section_name}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="text-sm text-foreground">{item.comment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                      <span>Usuário #{item.user_id}</span>
                      <span>·</span>
                      <span>{timeAgo(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.total_feedbacks === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nenhum feedback recebido ainda.
            </Card>
          )}
        </>
      )}
    </div>
  )
}

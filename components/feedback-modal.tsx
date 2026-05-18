'use client'

import { useState } from 'react'
import { CheckCircle, MessageSquare, Send, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FeedbackModalProps {
  open: boolean
  sectionId: number
  onClose: () => void
  onSubmitted: () => void
}

const STAR_LABELS = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente']
const STAR_EMOJIS = ['😞', '😕', '😐', '😊', '🤩']

export function FeedbackModal({ open, sectionId, onClose, onSubmitted }: FeedbackModalProps) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleClose() {
    if (submitted) return
    onClose()
  }

  async function handleSubmit() {
    if (stars === 0 || submitting) return
    setSubmitting(true)
    try {
      await fetch(`/api/sections/${sectionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stars,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      })
    } finally {
      setSubmitting(false)
      setSubmitted(true)
      setTimeout(() => onSubmitted(), 2000)
    }
  }

  const activeStars = hovered || stars
  const starLabel = activeStars > 0 ? STAR_LABELS[activeStars - 1] : null
  const starEmoji = activeStars > 0 ? STAR_EMOJIS[activeStars - 1] : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl border-border/60 shadow-2xl"
      >
        {submitted ? (
          /* ── Tela de sucesso ── */
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-8 text-center">
            <div className="relative">
              <div className="rounded-full bg-green-500/15 p-5">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <span className="absolute -top-1 -right-1 text-2xl">🎉</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Obrigado!</p>
              <p className="text-sm text-muted-foreground">
                Sua avaliação nos ajuda a melhorar a qualidade das traduções.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header com gradiente ── */}
            <div className="relative bg-linear-to-br from-primary/15 via-primary/8 to-transparent px-6 pt-6 pb-5 border-b border-border/50">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{starEmoji ?? '📖'}</span>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
                    Avaliação da seção
                  </p>
                </div>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  Como foi a leitura?
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sua opinião sobre a qualidade da tradução.
                </p>
              </div>
            </div>

            <div className="px-6 py-6 flex flex-col gap-6">
              {/* ── Estrelas ── */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="flex items-center gap-2"
                  onMouseLeave={() => setHovered(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStars(n)}
                      onMouseEnter={() => setHovered(n)}
                      className="p-1 transition-transform duration-100 hover:scale-125 active:scale-95"
                      aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={cn(
                          'h-10 w-10 transition-all duration-150',
                          n <= activeStars
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                            : 'fill-muted/60 text-muted-foreground/25'
                        )}
                      />
                    </button>
                  ))}
                </div>

                <div className="h-5 flex items-center">
                  {starLabel && (
                    <span className="text-sm font-semibold text-amber-500 animate-in fade-in zoom-in-95 duration-150">
                      {starLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Comentário ── */}
              {!showComment ? (
                <button
                  type="button"
                  onClick={() => setShowComment(true)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 py-3 text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  <MessageSquare className="h-4 w-4" />
                  Deixar um comentário
                </button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="O que poderia melhorar? Algo que te surpreendeu positivamente?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="resize-none text-sm min-h-[90px] rounded-xl border-border/70 focus:border-primary/50"
                    maxLength={500}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{comment.length}/500</p>
                </div>
              )}

              {/* ── Ações ── */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-11 text-muted-foreground hover:text-foreground rounded-xl"
                  onClick={onClose}
                >
                  Pular
                </Button>
                <Button
                  type="button"
                  className="flex-[2] h-11 rounded-xl gap-2 font-semibold"
                  disabled={stars === 0 || submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? (
                    'Enviando…'
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar avaliação
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

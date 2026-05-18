'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ReportModalProps {
  open: boolean
  sectionId: number
  onClose: () => void
}

const PROBLEM_TYPES = [
  { id: 'translation_failed',  label: 'Tradução falhou',      emoji: '❌' },
  { id: 'wrong_text',          label: 'Texto incorreto',      emoji: '📝' },
  { id: 'unreadable',          label: 'Texto ilegível',       emoji: '🔍' },
  { id: 'missing_pages',       label: 'Páginas faltando',     emoji: '📄' },
  { id: 'image_error',         label: 'Erro na imagem',       emoji: '🖼️' },
  { id: 'other',               label: 'Outro problema',       emoji: '💬' },
]

export function ReportModal({ open, sectionId, onClose }: ReportModalProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleClose() {
    if (submitting) return
    onClose()
  }

  async function handleSubmit() {
    if (!selected || submitting) return
    setSubmitting(true)

    const label = PROBLEM_TYPES.find((p) => p.id === selected)?.label ?? selected
    const comment = description.trim()
      ? `[${label}] ${description.trim()}`
      : `[${label}]`

    try {
      await fetch(`/api/sections/${sectionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars: 1, comment }),
      })
    } finally {
      setSubmitting(false)
      setSubmitted(true)
      setTimeout(() => {
        onClose()
        setSubmitted(false)
        setSelected(null)
        setDescription('')
      }, 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl border-border/60 shadow-2xl"
      >
        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-8 text-center">
            <div className="rounded-full bg-green-500/15 p-5">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Relatório enviado!</p>
              <p className="text-sm text-muted-foreground">
                Obrigado por nos avisar. Vamos analisar o problema.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative bg-destructive/8 border-b border-border/50 px-6 pt-6 pb-5">
              <div className="flex items-start gap-3 pr-2">
                <div className="rounded-xl bg-destructive/15 p-2.5 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-destructive/80 mb-0.5">
                    Reportar problema
                  </p>
                  <h2 className="text-base font-bold text-foreground leading-snug">
                    O que aconteceu?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Nos conte sobre o problema nesta seção.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Tipos de problema */}
              <div className="grid grid-cols-2 gap-2">
                {PROBLEM_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelected(type.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
                      selected === type.id
                        ? 'border-destructive/60 bg-destructive/8 text-foreground'
                        : 'border-border hover:border-border/80 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none">{type.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Textarea
                  placeholder="Descreva o problema com mais detalhes…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none text-sm min-h-[80px] rounded-xl border-border/70"
                  maxLength={500}
                />
              </div>

              {/* Ações */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-11 text-muted-foreground hover:text-foreground rounded-xl"
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-2 h-11 rounded-xl gap-2 font-semibold"
                  disabled={!selected || submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? (
                    'Enviando…'
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar relatório
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

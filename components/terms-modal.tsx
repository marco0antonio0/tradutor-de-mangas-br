'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ChevronDown,
  ExternalLink,
  Gift,
  Languages,
  ScrollText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { LEGAL_MODAL_CONTENT } from '@/lib/legal-content'

const TERMS_KEY = 'manga-terms-v2'

export function hasAcceptedTerms() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TERMS_KEY) === 'accepted'
}

export function markTermsAccepted() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TERMS_KEY, 'accepted')
  }
}

interface TermsModalProps {
  open: boolean
  onAccept: () => void
}

export function TermsModal({ open, onAccept }: TermsModalProps) {
  const [checked, setChecked] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setIsAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
  }

  const handleAccept = () => {
    if (!checked) {
      setAttempted(true)
      return
    }
    markTermsAccepted()
    onAccept()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[calc(100%-2.5rem)] sm:max-w-md p-0 gap-0"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Bem-vindo ao MangaIOTranslate</DialogTitle>
          <DialogDescription>Aceite os termos para continuar</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto px-6 pt-6 pb-4 space-y-4"
            style={{ maxHeight: 'calc(90dvh - 180px)' }}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-4">
                <Languages className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{LEGAL_MODAL_CONTENT.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {LEGAL_MODAL_CONTENT.subtitle}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 pb-6">
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {LEGAL_MODAL_CONTENT.cards[0].text}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                <ScrollText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {LEGAL_MODAL_CONTENT.cards[1].text}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                <Gift className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {LEGAL_MODAL_CONTENT.cards[2].text}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {LEGAL_MODAL_CONTENT.cards[3].text}
                </p>
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300"
            style={{ opacity: isAtBottom ? 0 : 1 }}
          >
            <div className="h-16 bg-linear-to-t from-card to-transparent" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 shadow-lg">
                <ChevronDown className="h-3.5 w-3.5 text-primary-foreground animate-bounce" />
                <span className="text-[11px] font-semibold text-primary-foreground">role para ver mais</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-border bg-background space-y-3">
          <label
            className={`flex items-start gap-3 cursor-pointer group rounded-lg p-2 transition-all ${
              attempted && !checked
                ? 'bg-destructive/10 ring-1 ring-destructive/50'
                : 'hover:bg-muted/30'
            }`}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                setChecked(Boolean(v))
                if (v) setAttempted(false)
              }}
              className={`mt-0.5 shrink-0 ${attempted && !checked ? 'border-destructive' : ''}`}
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
              {LEGAL_MODAL_CONTENT.acceptancePrefix}{' '}
              <Link
                href="/termos"
                target="_blank"
                className="underline text-primary hover:text-primary/80 inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {LEGAL_MODAL_CONTENT.acceptanceLinkLabel}
                <ExternalLink className="h-3 w-3" />
              </Link>.
            </span>
          </label>

          {attempted && !checked && (
            <p className="text-xs text-destructive px-2 -mt-1">
              {LEGAL_MODAL_CONTENT.acceptanceError}
            </p>
          )}

          <Button className="w-full" onClick={handleAccept}>
            Entrar na plataforma
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

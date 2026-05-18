'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, CheckCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const PADDING = 12
const TOOLTIP_W = 308
const TOOLTIP_H_EST = 196 // altura estimada desktop
const TOOLTIP_MOBILE_H = 200 // reserva de espaço no scroll mobile
const GAP = 14
const MOBILE_BP = 640
const TRANSITION = 'x 0.35s cubic-bezier(0.4,0,0.2,1), y 0.35s cubic-bezier(0.4,0,0.2,1), width 0.35s cubic-bezier(0.4,0,0.2,1), height 0.35s cubic-bezier(0.4,0,0.2,1), rx 0.35s'

export interface TourStep {
  title: string
  description: string
  /** valor do atributo data-tour no elemento alvo */
  selector?: string
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface SpotlightTourProps {
  steps: TourStep[]
  storageKey: string
  open: boolean
  onClose: () => void
}

export function checkTourDone(key: string): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(key) === 'done'
}

export function markTourDone(key: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(key, 'done')
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BP
}

function computeRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  }
}

function resolveDesktopSide(
  rect: Rect,
  preferred: TourStep['tooltipSide'],
): 'top' | 'bottom' | 'left' | 'right' {
  const vh = window.innerHeight
  const canBelow = rect.top + rect.height + GAP + TOOLTIP_H_EST < vh
  const canAbove = rect.top - GAP - TOOLTIP_H_EST > 0
  if (preferred && preferred !== 'auto') return preferred
  return canBelow ? 'bottom' : canAbove ? 'top' : 'bottom'
}

/** Posicionamento desktop: calcula top/left absolutos */
function getDesktopTooltipStyle(
  rect: Rect | null,
  side: TourStep['tooltipSide'],
): React.CSSProperties {
  if (!rect) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: TOOLTIP_W,
    }
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const resolved = resolveDesktopSide(rect, side)

  let top: number
  let left: number

  if (resolved === 'bottom') {
    top = rect.top + rect.height + GAP
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2
  } else if (resolved === 'top') {
    top = rect.top - TOOLTIP_H_EST - GAP
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2
  } else if (resolved === 'left') {
    top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2
    left = rect.left - TOOLTIP_W - GAP
  } else {
    top = rect.top + rect.height / 2 - TOOLTIP_H_EST / 2
    left = rect.left + rect.width + GAP
  }

  left = clamp(left, 10, vw - TOOLTIP_W - 10)
  top = clamp(top, 10, vh - TOOLTIP_H_EST - 10)

  return { position: 'fixed', top, left, width: TOOLTIP_W }
}

/** Calcula a seta que aponta tooltip → elemento (somente desktop) */
function getArrowStyle(
  rect: Rect,
  side: TourStep['tooltipSide'],
  tooltipLeft: number,
): { style: React.CSSProperties; side: 'top' | 'bottom' | 'left' | 'right' } | null {
  const resolved = resolveDesktopSide(rect, side)
  const ARROW = 8

  if (resolved === 'bottom') {
    const arrowLeft = clamp(
      rect.left + rect.width / 2 - tooltipLeft - ARROW,
      ARROW,
      TOOLTIP_W - ARROW * 3,
    )
    return { style: { top: -(ARROW * 2 - 1), left: arrowLeft }, side: 'bottom' }
  }
  if (resolved === 'top') {
    const arrowLeft = clamp(
      rect.left + rect.width / 2 - tooltipLeft - ARROW,
      ARROW,
      TOOLTIP_W - ARROW * 3,
    )
    return { style: { bottom: -(ARROW * 2 - 1), left: arrowLeft }, side: 'top' }
  }
  return null
}

export function SpotlightTour({
  steps,
  storageKey,
  open,
  onClose,
}: SpotlightTourProps) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tooltipKey, setTooltipKey] = useState(0)

  const stepRef = useRef(step)
  const stepsRef = useRef(steps)
  stepRef.current = step
  stepsRef.current = steps

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) { setStep(0); setTooltipKey(k => k + 1) }
  }, [open])

  const captureRect = useCallback((selector: string) => {
    const el = document.querySelector(`[data-tour="${selector}"]`)
    if (el) setRect(computeRect(el))
    else setRect(null)
  }, [])

  // Find element, scroll to visible area, capture rect
  useEffect(() => {
    if (!open) return
    const selector = steps[step]?.selector
    if (!selector) { setRect(null); return }

    const el = document.querySelector(`[data-tour="${selector}"]`)
    if (!el) { setRect(null); return }

    // No mobile reserva espaço para o bottom-sheet ao calcular o scroll
    if (isMobileViewport()) {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const targetCenter = r.top + r.height / 2
      const safeCenter = (vh - TOOLTIP_MOBILE_H) / 2
      const diff = targetCenter - safeCenter
      if (Math.abs(diff) > 40) {
        window.scrollBy({ top: diff, behavior: 'smooth' })
      }
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }

    const timer = setTimeout(() => captureRect(selector), 400)
    return () => clearTimeout(timer)
  }, [open, step, steps, captureRect])

  // Sync rect on scroll / resize
  useEffect(() => {
    if (!open) return
    const selector = steps[step]?.selector
    if (!selector) return
    const update = () => captureRect(selector)
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, step, steps, captureRect])

  const currentStep = steps[step]!
  const isFirst = step === 0
  const isLast = step === steps.length - 1

  const handleNext = useCallback(() => {
    if (stepRef.current === stepsRef.current.length - 1) {
      markTourDone(storageKey)
      setStep(0)
      onClose()
    } else {
      setStep(s => s + 1)
      setTooltipKey(k => k + 1)
    }
  }, [storageKey, onClose])

  const handlePrev = useCallback(() => {
    setStep(s => Math.max(0, s - 1))
    setTooltipKey(k => k + 1)
  }, [])

  const handleSkip = useCallback(() => {
    markTourDone(storageKey)
    setStep(0)
    onClose()
  }, [storageKey, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleSkip() }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleNext, handlePrev, handleSkip])

  if (!open || !mounted) return null

  const mobile = isMobileViewport()
  const progressPct = ((step + 1) / steps.length) * 100

  // Desktop tooltip positioning
  const desktopStyle = !mobile ? getDesktopTooltipStyle(rect, currentStep.tooltipSide) : {}
  const desktopArrow =
    !mobile && rect && typeof desktopStyle.left === 'number'
      ? getArrowStyle(rect, currentStep.tooltipSide, desktopStyle.left as number)
      : null

  // ── Tooltip content (shared between mobile and desktop) ──
  const tooltipContent = (
    <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-0.75 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className={cn(
              'shrink-0 mt-0.5 flex items-center justify-center rounded-full text-[10px] font-bold w-5 h-5',
              rect ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary',
            )}>
              {rect ? step + 1 : <Sparkles className="h-3 w-3" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                Passo {step + 1} de {steps.length}
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">
                {currentStep.title}
              </h3>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pl-7">
          {currentStep.description}
        </p>

        {/* Keyboard hints — desktop only */}
        {!mobile && (
          <div className="pl-7 flex items-center gap-1.5 flex-wrap">
            {(['←', '→', 'Esc'] as const).map((key, i) => (
              <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground/55">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                  {key}
                </kbd>
                <span>{['anterior', 'próximo', 'fechar'][i]}</span>
                {i < 2 && <span className="mx-0.5 opacity-40">·</span>}
              </span>
            ))}
          </div>
        )}

        {/* Dots + navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 pl-7">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => { setStep(i); setTooltipKey(k => k + 1) }}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50',
                )}
                aria-label={`Ir ao passo ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-8 w-8 p-0"
                title="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="h-8 px-3.5 text-xs gap-1.5"
            >
              {isLast ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Concluir
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const overlay = (
    <>
      {/* SVG Backdrop with spotlight cutout */}
      <svg
        className="tour-backdrop-in"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9997, pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={10}
                ry={10}
                fill="black"
                style={{ transition: TRANSITION }}
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-spotlight-mask)" />
      </svg>

      {/* Click-to-skip backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={handleSkip} />

      {/* Spotlight pulse ring */}
      {rect && (
        <div
          className="tour-pulse-ring"
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 10,
            border: '2px solid var(--primary)',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1), width 0.35s cubic-bezier(0.4,0,0.2,1), height 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      )}

      {mobile ? (
        /* ── Mobile: bottom sheet ── */
        <div
          key={tooltipKey}
          className="tour-tooltip-in"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10000,
            padding: '0 0 env(safe-area-inset-bottom, 0)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="rounded-t-2xl border-t border-x border-border bg-card shadow-2xl overflow-hidden">
            {/* drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            {/* Progress bar */}
            <div className="h-0.75 w-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="p-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    'shrink-0 mt-0.5 flex items-center justify-center rounded-full text-[10px] font-bold w-5 h-5',
                    rect ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary',
                  )}>
                    {rect ? step + 1 : <Sparkles className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                      Passo {step + 1} de {steps.length}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      {currentStep.title}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed pl-7">
                {currentStep.description}
              </p>

              {/* Dots + navigation */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 pl-7">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setStep(i); setTooltipKey(k => k + 1) }}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-300',
                        i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/25',
                      )}
                      aria-label={`Ir ao passo ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isFirst && (
                    <Button variant="outline" size="sm" onClick={handlePrev} className="h-9 w-9 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={handleNext} className="h-9 px-4 text-sm gap-1.5">
                    {isLast ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Concluir
                      </>
                    ) : (
                      <>
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Desktop: floating tooltip ── */
        <div
          key={tooltipKey}
          className="tour-tooltip-in"
          style={{ ...desktopStyle, zIndex: 10000 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Arrow pointing to element */}
          {desktopArrow && (
            <div
              style={{
                position: 'absolute',
                ...desktopArrow.style,
                width: 0,
                height: 0,
                ...(desktopArrow.side === 'bottom' && {
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderBottom: '9px solid var(--border)',
                }),
                ...(desktopArrow.side === 'top' && {
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '9px solid var(--border)',
                }),
              }}
            />
          )}
          {tooltipContent}
        </div>
      )}
    </>
  )

  return createPortal(overlay, document.body)
}

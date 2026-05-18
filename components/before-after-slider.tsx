'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const HOME_GALLERY_STORAGE_KEY = 'manga-home:last-translation'
const HOME_GALLERY_UPDATE_EVENT = 'manga-home-gallery-updated'

interface HomeGalleryPayload {
  original?: string
  translated?: string
  createdAt?: number
}

export function BeforeAfterSlider() {
  const [position, setPosition] = useState(100) // starts at 100% original, animates to 50%
  const [isDragging, setIsDragging] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isHorizontalGestureRef = useRef<boolean | null>(null)
  const [originalImage, setOriginalImage] = useState('/image-test-gemini.jpg')
  const [translatedImage, setTranslatedImage] = useState('/image-test-gemini-traduzida.jpg')

  const loadGalleryImages = useCallback(() => {
    try {
      const raw = localStorage.getItem(HOME_GALLERY_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as HomeGalleryPayload
      const original = typeof parsed.original === 'string' ? parsed.original.trim() : ''
      const translated = typeof parsed.translated === 'string' ? parsed.translated.trim() : ''

      if (original) setOriginalImage(original)
      if (translated) setTranslatedImage(translated)
    } catch {
      // ignore malformed storage data
    }
  }, [])

  useEffect(() => {
    loadGalleryImages()

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== HOME_GALLERY_STORAGE_KEY) return
      loadGalleryImages()
    }
    const onCustomUpdate = () => loadGalleryImages()

    window.addEventListener('storage', onStorage)
    window.addEventListener(HOME_GALLERY_UPDATE_EVENT, onCustomUpdate)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(HOME_GALLERY_UPDATE_EVENT, onCustomUpdate)
    }
  }, [loadGalleryImages])

  // Entrance animation: sweep from 100% → 50%
  useEffect(() => {
    let start: number | null = null
    const duration = 1200
    const from = 100
    const to = 50

    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setPosition(from + (to - from) * eased)
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    // Delay slightly so the page has rendered
    const timeout = setTimeout(() => {
      animFrameRef.current = requestAnimationFrame(step)
    }, 600)

    return () => {
      clearTimeout(timeout)
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const resolvePosition = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPosition((x / rect.width) * 100)
    if (!hasInteracted) setHasInteracted(true)
  }, [hasInteracted])

  // Mouse
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    resolvePosition(e.clientX)
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (isDragging) resolvePosition(e.clientX) }
    const onMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, resolvePosition])

  // Touch — só ativa o slider se o gesto for predominantemente horizontal
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    isHorizontalGestureRef.current = null // ainda não sabemos a direção
  }

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x)
      const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y)

      // Determina a direção na primeira movimentação significativa
      if (isHorizontalGestureRef.current === null && (dx > 4 || dy > 4)) {
        isHorizontalGestureRef.current = dx > dy
      }

      if (isHorizontalGestureRef.current) {
        e.preventDefault() // bloqueia scroll só em gesto horizontal
        setIsDragging(true)
        resolvePosition(e.touches[0].clientX)
      }
    }

    const onTouchEnd = () => {
      setIsDragging(false)
      touchStartRef.current = null
      isHorizontalGestureRef.current = null
    }

    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [resolvePosition])

  return (
    <div id="galeria-traducoes" className="rounded-t-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Galeria de Traduções</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-500">
          Arraste para comparar
        </span>
      </div>

      {/* Labels */}
      <div className="mt-3 flex justify-between text-[11px] font-medium">
        <span className="text-zinc-500">Original</span>
        <span className="text-amber-400">Traduzido ✓</span>
      </div>

      {/* Slider container */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="relative mt-2 overflow-hidden rounded-xl border border-white/10 select-none"
        style={{ cursor: isDragging ? 'col-resize' : 'ew-resize', aspectRatio: '572 / 1024' }}
      >
        {/* Back layer: translated image (full width) */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={translatedImage} alt="Mangá traduzido" className="h-full w-full object-cover" />
        </div>

        {/* Front layer: original image clipped to `position`% from left */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={originalImage} alt="Mangá original" className="h-full w-full object-cover" />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 shadow-[0_0_8px_2px_rgba(240,199,72,0.5)]"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />

        {/* Drag handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-zinc-950 shadow-lg shadow-amber-400/30"
          style={{ left: `${position}%` }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5 4L1 8L5 12" stroke="#F0C748" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4L15 8L11 12" stroke="#F0C748" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* "Before" label badge */}
        {position > 12 && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-zinc-950/90 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            Antes
          </div>
        )}

        {/* "After" label badge */}
        {position < 88 && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-md">
            Depois
          </div>
        )}

        {/* Hint overlay (fades after first interaction) */}
        {!hasInteracted && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6 opacity-80">
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-zinc-950/80 px-3 py-1.5 text-[11px] text-zinc-300 backdrop-blur-sm">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M4 3L1 7L4 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 3L13 7L10 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Arraste para ver a tradução
            </div>
          </div>
        )}
      </div>

      {/* Attribution */}
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Quadrinho original gerado por IA apenas para fins demonstrativos. Tradução realizada pelo software <span className="text-zinc-500">MangaIOTranslate</span>. Nenhum conteúdo protegido por direitos autorais foi utilizado.
      </p>

      {/* Progress indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400/60 transition-none"
            style={{ width: `${100 - position}%`, marginLeft: `${position}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] text-zinc-600">
          {Math.round(100 - position)}% traduzido
        </span>
      </div>
    </div>
  )
}

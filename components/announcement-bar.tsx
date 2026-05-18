'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="relative z-60 bg-amber-400 px-3 py-2 text-center text-[11px] leading-snug text-amber-950 sm:px-4 sm:py-2.5 sm:text-sm sm:leading-normal">
      <p className="mx-auto max-w-5xl pr-8 sm:pr-10">
        <span className="font-semibold">🎉</span>{' '}
        Faça o login e aproveite para <strong>3 gerações gratuitas</strong> — até 40 páginas em PDF ou até 40 imagens por geração, sem cartão!{' '}
        <a
          href="/login"
          className="mt-1 inline-block font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 sm:mt-0 sm:ml-1"
        >
          Criar conta grátis →
        </a>
      </p>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded p-0.5 text-amber-900/60 transition-colors hover:text-amber-950 sm:right-3 sm:top-1/2 sm:-translate-y-1/2"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

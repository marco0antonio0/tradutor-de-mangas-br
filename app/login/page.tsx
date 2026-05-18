import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import LoginPageClient from './page-client'
import { authController } from '@/lib/backend/auth/auth.module'

export const metadata: Metadata = {
  title: 'Tradutor de Manga Online: Login e Inicio Rapido',
  description:
    'Acesse o tradutor de manga e manhwa online com OCR e IA. Fluxo para traduzir manga pelo celular ou PC com mais agilidade.',
  keywords: [
    'tradutor de mangá',
    'tradutor de manga',
    'tradutor de manhwa',
    'tradutor de manga online',
    'tradutor de manga para pc',
    'como traduzir manga pelo celular',
    'manga translator',
  ],
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    type: 'website',
    url: '/login',
    title: 'Tradutor de Manga Online: Login e Inicio Rapido',
    description:
      'Entre na plataforma para traduzir manga e manhwa com OCR, IA e revisao em fluxo unico.',
    images: ['/image-preview-link.png'],
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tradutor de Manga Online: Login e Inicio Rapido',
    description:
      'Tradutor de manga online com OCR e IA para quem busca traduzir manga com mais velocidade e consistencia.',
    images: ['/image-preview-link.png'],
  },
}

function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
  if (!authController.hasAnyUser()) {
    redirect('/setup')
  }

  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SetupPageClient from './page-client'
import { authController } from '@/lib/backend/auth/auth.module'

export const metadata: Metadata = {
  title: 'Configuração inicial',
  description: 'Configuração inicial do administrador do sistema.',
  robots: { index: false, follow: false },
}

export default function SetupPage() {
  if (authController.hasAnyUser()) {
    redirect('/login')
  }

  return <SetupPageClient />
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { LoginForm } from '@/components/login-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [authCheckReason, setAuthCheckReason] = useState('')
  const [showExpiredModal, setShowExpiredModal] = useState(false)

  const sessionExpired = searchParams.get('expired') === '1'
  const redirectParam = searchParams.get('redirect')
  const loginRedirectTarget = useMemo(() => {
    if (!redirectParam) return '/inicio'
    if (!redirectParam.startsWith('/') || redirectParam.startsWith('//')) return '/inicio'
    return redirectParam
  }, [redirectParam])

  useEffect(() => {
    const checkAuth = async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => {
        controller.abort('session-check-timeout')
      }, 2500)

      try {
        const response = await fetch('/api/auth/check', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()

        if (response.ok && data.authenticated === true) {
          router.replace(loginRedirectTarget)
          return
        }

        if ((response.status === 401 || response.status === 403) && typeof data?.reason === 'string') {
          setAuthCheckReason(data.reason)
        } else {
          setAuthCheckReason('')
        }

      } catch {
        setAuthCheckReason('')
        // Segue para tela de login em caso de erro de rede
      } finally {
        window.clearTimeout(timeoutId)
        setIsCheckingSession(false)
      }
    }

    void checkAuth()
  }, [loginRedirectTarget, router])

  useEffect(() => {
    if (!isCheckingSession && sessionExpired) {
      setShowExpiredModal(true)
    }
  }, [isCheckingSession, sessionExpired])

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Verificando sessão...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={showExpiredModal} onOpenChange={setShowExpiredModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sessão expirada</DialogTitle>
            <DialogDescription>
              Sua sessão expirou. Faça login novamente para continuar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowExpiredModal(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoginForm
        onLogin={() => router.replace(loginRedirectTarget)}
      />
    </>
  )
}

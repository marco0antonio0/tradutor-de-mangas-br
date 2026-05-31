'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  Ellipsis,
  Languages,
  LogOut,
  Loader2,
  FolderOpen,
  Info,
  ListOrdered,
  Users,
  PlayCircle,
  Settings2,
} from 'lucide-react'
import { TermsModal, hasAcceptedTerms } from '@/components/terms-modal'

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive: (pathname: string) => boolean
  role4Only?: boolean
}


const navItems: NavItem[] = [
  {
    href: '/inicio/secoes',
    label: 'Biblioteca',
    icon: FolderOpen,
    isActive: (pathname) =>
      pathname === '/inicio/secoes'
      || /^\/inicio\/secoes\/\d+$/.test(pathname),
  },
  {
    href: '/inicio/preferencias',
    label: 'Preferências',
    icon: Settings2,
    isActive: (pathname) => pathname === '/inicio/preferencias',
  },
  {
    href: '/inicio/sobre',
    label: 'Sobre',
    icon: Info,
    isActive: (pathname) => pathname === '/inicio/sobre',
  },
  {
    href: '/inicio/usuarios',
    label: 'Usuários',
    icon: Users,
    role4Only: true,
    isActive: (pathname) =>
      pathname === '/inicio/usuarios'
      || pathname === '/inicio/usuarios/novo',
  },
  {
    href: '/inicio/fila-global',
    label: 'Fila Global',
    icon: ListOrdered,
    role4Only: true,
    isActive: (pathname) => pathname === '/inicio/fila-global',
  },
]

export default function InicioLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <Suspense fallback={<InicioLayoutFallback />}>
      <InicioLayoutContent>{children}</InicioLayoutContent>
    </Suspense>
  )
}

function InicioLayoutContent({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [userRole, setUserRole] = useState<number | null>(null)
  const [sessionWarning, setSessionWarning] = useState('')
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const currentPathWithQuery = useMemo(() => {
    const path = pathname || '/inicio'
    const query = searchParams.toString()
    return query ? `${path}?${query}` : path
  }, [pathname, searchParams])

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { cache: 'no-store' })
        const data = await response.json()

        if (cancelled) return

        if (response.ok && data.authenticated === true) {
          const role = typeof data?.user?.role === 'number' ? data.user.role : null
          setUserRole(role)
          setSessionWarning('')
          setIsCheckingSession(false)
          if (!hasAcceptedTerms()) {
            setIsTermsOpen(true)
          } else {
            window.dispatchEvent(new CustomEvent('open-page-tour', { detail: { force: false } }))
          }
          return
        }

        if (response.status === 401 || response.status === 403) {
          const reason = typeof data?.reason === 'string' ? data.reason : ''
          const params = new URLSearchParams()
          if (reason === 'expired_token') {
            params.set('expired', '1')
          }
          if (currentPathWithQuery.startsWith('/')) {
            params.set('redirect', currentPathWithQuery)
          }
          router.replace(`/login${params.toString() ? `?${params.toString()}` : ''}`)
          return
        }

        setSessionWarning('Instabilidade ao validar sessão. Tentando continuar sem encerrar seu acesso.')
        setIsCheckingSession(false)
      } catch {
        if (!cancelled) {
          setSessionWarning('Falha temporária de conexão ao validar sessão. Recarregue se o problema persistir.')
          setIsCheckingSession(false)
        }
      }
    }

    void checkAuth()
    return () => {
      cancelled = true
    }
  }, [currentPathWithQuery, router])

  const activeNav = useMemo(
    () =>
      navItems
        .filter((item) => !item.role4Only || userRole === 4)
        .find((item) => item.isActive(pathname ?? '')),
    [pathname, userRole]
  )
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.role4Only || userRole === 4),
    [userRole]
  )
  const mobilePrimaryNavItems = useMemo(() => {
    if (visibleNavItems.length <= 4) return visibleNavItems
    return visibleNavItems.slice(0, 4)
  }, [visibleNavItems])
  const mobileOverflowNavItems = useMemo(() => {
    if (visibleNavItems.length <= 4) return [] as NavItem[]
    return visibleNavItems.slice(4)
  }, [visibleNavItems])
  const currentPath = pathname ?? ''
  const isMobileOverflowActive = useMemo(
    () => mobileOverflowNavItems.some((item) => item.isActive(currentPath)),
    [mobileOverflowNavItems, currentPath]
  )
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.replace('/login')
    }
  }

  if (isCheckingSession) {
    return <InicioLayoutFallback />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3">
          {sessionWarning ? (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {sessionWarning}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2">
                <Languages className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-foreground">MangaIOTranslate</p>
                <p className="text-xs text-muted-foreground">
                  {activeNav?.label ?? 'Painel'}
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent('open-page-tour', { detail: { force: true } }))}
                className="gap-1.5"
              >
                <PlayCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Tutorial</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 md:hidden">
            <div className="min-w-0 flex items-center gap-2" />

            <div className="shrink-0 flex items-center gap-1.5">
              <Button
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent('open-page-tour', { detail: { force: true } }))}
                size="sm"
                className="h-9 w-9 p-0"
                title="Tutorial"
              >
                <PlayCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <nav className="mt-3 hidden md:flex flex-wrap items-center gap-2">
            {visibleNavItems.map((item) => {
              const active = item.isActive(currentPath)
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted/60'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-3 sm:px-4 py-4 pb-24 sm:py-6 md:pb-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div
          className="mx-auto grid max-w-screen-2xl gap-1 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(
              mobilePrimaryNavItems.length + (mobileOverflowNavItems.length > 0 ? 1 : 0),
              1
            )}, minmax(0, 1fr))`,
          }}
        >
          {mobilePrimaryNavItems.map((item) => {
            const active = item.isActive(currentPath)
            const Icon = item.icon

            return (
              <Link
                key={`${item.href}-mobile-bottom`}
                href={item.href}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                <span className="leading-tight text-center">{item.label}</span>
              </Link>
            )
          })}

          {mobileOverflowNavItems.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setIsMobileSheetOpen(true)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-medium transition-colors',
                  isMobileOverflowActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Ellipsis className="mb-1 h-4 w-4" />
                <span className="leading-tight text-center">Mais</span>
              </button>

              <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  <SheetHeader className="px-5 pb-3">
                    <SheetTitle className="text-left text-base font-semibold">Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col">
                    {mobileOverflowNavItems.map((item) => {
                      const active = item.isActive(currentPath)
                      const Icon = item.icon
                      return (
                        <button
                          key={`${item.href}-sheet`}
                          type="button"
                          onClick={() => {
                            setIsMobileSheetOpen(false)
                            router.push(item.href)
                          }}
                          className={cn(
                            'flex items-center gap-4 px-5 py-4 text-left text-sm font-medium transition-colors active:bg-muted/80',
                            active
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted/40'
                          )}
                        >
                          <div className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : null}
        </div>
      </nav>

      <TermsModal
        open={isTermsOpen}
        onAccept={() => {
          setIsTermsOpen(false)
          window.dispatchEvent(new CustomEvent('open-page-tour', { detail: { force: false } }))
        }}
      />
    </div>
  )
}

function InicioLayoutFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">Verificando sessão...</span>
      </div>
    </div>
  )
}

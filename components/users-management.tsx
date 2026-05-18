'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toErrorMessage } from '@/lib/sections'
import {
  AlertCircle,
  FileStack,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

interface UserItem {
  id: number
  name: string
  email: string
  role: number
  limite: number
  gerado: number
  limit_page_upload: number
  foto: string | null
  createdAt: string
}

interface AuthMeResponse {
  role?: number
  message?: string
  error?: string
}

interface UpdatePasswordResponse {
  success?: boolean
  message?: string
  error?: string
}

interface UpdateUserLimitResponse {
  id?: number
  limite?: number
  gerado?: number
  limit_page_upload?: number
  message?: string
  error?: string
}

function formatRoleLabel(role: number) {
  if (role === 4) return 'Admin'
  if (role === 3) return 'Gestor'
  if (role === 2) return 'Supervisor'
  if (role === 1) return 'Operador'
  if (role === 0) return 'Básico'
  return `Role ${role}`
}

function roleColor(role: number) {
  if (role === 4) return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30'
  if (role === 3) return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30'
  if (role === 2) return 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (role === 1) return 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30'
  return 'text-muted-foreground bg-muted/30 border-border'
}

function formatUserDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

function usagePercent(gerado: number, limite: number) {
  if (limite <= 0) return 0
  return Math.min(100, Math.round((gerado / limite) * 100))
}

export function UsersManagement() {
  const router = useRouter()

  const [users, setUsers] = useState<UserItem[]>([])
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false)
  const [limitActionType, setLimitActionType] = useState<'save' | 'reset' | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [limitInput, setLimitInput] = useState('')
  const [pageUploadLimitInput, setPageUploadLimitInput] = useState('')

  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserItem | null>(null)
  const [selectedUserForLimit, setSelectedUserForLimit] = useState<UserItem | null>(null)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const usersCount = useMemo(() => users.length, [users])
  const adminCount = useMemo(() => users.filter((u) => u.role === 4).length, [users])
  const sortedByGerado = useMemo(() => [...users].sort((a, b) => b.gerado - a.gerado), [users])
  const topGenerator = useMemo(() => sortedByGerado[0] ?? null, [sortedByGerado])
  const bottomGenerator = useMemo(() => sortedByGerado[sortedByGerado.length - 1] ?? null, [sortedByGerado])

  const handleUnauthorized = useCallback(() => {
    router.replace('/login?expired=1')
  }, [router])

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    try {
      const response = await fetch('/api/auth/users', { cache: 'no-store' })
      const data = await response.json()
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(toErrorMessage(data, 'Não foi possível listar usuários.'))
      }
      const nextUsers = data
        .filter((item) =>
          item
          && typeof item.id === 'number'
          && typeof item.name === 'string'
          && typeof item.email === 'string'
          && typeof item.role === 'number'
          && typeof item.createdAt === 'string'
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          role: item.role,
          limite: typeof item.limite === 'number' ? item.limite : 0,
          gerado: typeof item.gerado === 'number' ? item.gerado : 0,
          limit_page_upload: typeof item.limit_page_upload === 'number' ? item.limit_page_upload : 0,
          foto: typeof item.foto === 'string' ? item.foto : null,
          createdAt: item.createdAt,
        })) as UserItem[]
      setUsers(nextUsers)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar usuários.')
    } finally {
      setIsLoadingUsers(false)
    }
  }, [handleUnauthorized, router])

  useEffect(() => {
    let cancelled = false
    const checkAccess = async () => {
      setIsCheckingAccess(true)
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = (await response.json()) as AuthMeResponse
        if (cancelled) return
        if (response.status === 401) { handleUnauthorized(); return }
        if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível verificar permissão.'))
        if (data.role !== 4) { router.replace('/inicio/secoes'); return }
        await fetchUsers()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao validar permissão.')
          setIsLoadingUsers(false)
        }
      } finally {
        if (!cancelled) setIsCheckingAccess(false)
      }
    }
    void checkAccess()
    return () => { cancelled = true }
  }, [fetchUsers, handleUnauthorized, router])

  const openPasswordDialog = (user: UserItem) => {
    setSelectedUserForPassword(user)
    setNewPassword('')
    setIsPasswordDialogOpen(true)
    setError('')
    setSuccess('')
  }

  const closePasswordDialog = () => {
    if (isUpdatingPassword) return
    setIsPasswordDialogOpen(false)
    setSelectedUserForPassword(null)
    setNewPassword('')
  }

  const openLimitDialog = (user: UserItem) => {
    setSelectedUserForLimit(user)
    setLimitInput(String(user.limite))
    setPageUploadLimitInput(String(user.limit_page_upload))
    setIsLimitDialogOpen(true)
    setError('')
    setSuccess('')
  }

  const closeLimitDialog = () => {
    if (isUpdatingLimit) return
    setIsLimitDialogOpen(false)
    setSelectedUserForLimit(null)
    setLimitInput('')
    setPageUploadLimitInput('')
  }

  const handleUpdatePassword = async () => {
    if (!selectedUserForPassword) return
    if (!newPassword.trim()) { setError('Informe a nova senha.'); return }
    setError('')
    setSuccess('')
    setIsUpdatingPassword(true)
    try {
      const response = await fetch(`/api/auth/users/${selectedUserForPassword.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserForPassword.id, newPassword }),
      })
      const data = (await response.json()) as UpdatePasswordResponse
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível alterar a senha.'))
      setSuccess(data.message || 'Senha alterada com sucesso.')
      closePasswordDialog()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleSaveLimits = async () => {
    if (!selectedUserForLimit) return
    const parsedGenerationLimit = Number(limitInput)
    if (!Number.isInteger(parsedGenerationLimit) || parsedGenerationLimit < 0) {
      setError('Informe um limite inteiro maior ou igual a zero.')
      return
    }
    const parsedPageLimit = Number(pageUploadLimitInput)
    if (!Number.isInteger(parsedPageLimit) || parsedPageLimit < 0) {
      setError('Informe um limite de páginas inteiro maior ou igual a zero.')
      return
    }
    const shouldUpdateGenerationLimit = parsedGenerationLimit !== selectedUserForLimit.limite
    const shouldUpdatePageLimit = parsedPageLimit !== selectedUserForLimit.limit_page_upload
    if (!shouldUpdateGenerationLimit && !shouldUpdatePageLimit) {
      setSuccess('Nenhuma alteração para salvar.')
      return
    }
    setError('')
    setSuccess('')
    setIsUpdatingLimit(true)
    setLimitActionType('save')
    try {
      const successMessages: string[] = []
      if (shouldUpdateGenerationLimit) {
        const response = await fetch(`/api/auth/users/${selectedUserForLimit.id}/limit`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limite: parsedGenerationLimit }),
        })
        const data = (await response.json()) as UpdateUserLimitResponse
        if (response.status === 401) { handleUnauthorized(); return }
        if (response.status === 403) { router.replace('/inicio/secoes'); return }
        if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível atualizar o limite.'))
        successMessages.push(data.message || 'Limite atualizado.')
      }
      if (shouldUpdatePageLimit) {
        const response = await fetch(`/api/auth/users/${selectedUserForLimit.id}/limit-page-upload`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit_page_upload: parsedPageLimit }),
        })
        const data = (await response.json()) as UpdateUserLimitResponse
        if (response.status === 401) { handleUnauthorized(); return }
        if (response.status === 403) { router.replace('/inicio/secoes'); return }
        if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível atualizar o limite de páginas.'))
        successMessages.push(data.message || 'Limite de páginas atualizado.')
      }
      setSuccess(successMessages.join(' '))
      closeLimitDialog()
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar limites.')
    } finally {
      setIsUpdatingLimit(false)
      setLimitActionType(null)
    }
  }

  const handleResetLimit = async () => {
    if (!selectedUserForLimit) return
    setError('')
    setSuccess('')
    setIsUpdatingLimit(true)
    setLimitActionType('reset')
    try {
      const response = await fetch(`/api/auth/users/${selectedUserForLimit.id}/limit/reset`, { method: 'PATCH' })
      const data = (await response.json()) as UpdateUserLimitResponse
      if (response.status === 401) { handleUnauthorized(); return }
      if (response.status === 403) { router.replace('/inicio/secoes'); return }
      if (!response.ok) throw new Error(toErrorMessage(data, 'Não foi possível resetar o limite.'))
      setSuccess(data.message || 'Limite resetado com sucesso.')
      closeLimitDialog()
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resetar limite.')
    } finally {
      setIsUpdatingLimit(false)
      setLimitActionType(null)
    }
  }

  if (isCheckingAccess) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Validando acesso...
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Usuários</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie contas, limites e senhas da plataforma.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="flex-1 sm:flex-none">
              <Link href="/inicio/usuarios/novo">
                <UserPlus className="h-4 w-4" />
                Novo usuário
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => void fetchUsers()} disabled={isLoadingUsers} className="flex-1 sm:flex-none">
              {isLoadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
          </div>
        </div>
      </Card>

      {/* Feedback */}
      {error && (
        <Card className="p-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border-destructive/30">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      )}
      {success && (
        <Card className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30">
          {success}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold text-foreground">{usersCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/10 p-2.5 shrink-0">
            <ShieldCheck className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Admins</p>
            <p className="text-2xl font-semibold text-foreground">{adminCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-green-500/10 p-2.5 shrink-0">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Mais gerou</p>
            <p className="text-sm font-semibold text-foreground truncate">{topGenerator?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{topGenerator ? `${topGenerator.gerado} gerados` : ''}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-amber-500/10 p-2.5 shrink-0">
            <TrendingDown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Menos gerou</p>
            <p className="text-sm font-semibold text-foreground truncate">{bottomGenerator?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{bottomGenerator ? `${bottomGenerator.gerado} gerados` : ''}</p>
          </div>
        </Card>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden p-0">
        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando usuários...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="divide-y divide-border lg:hidden">
              {sortedByGerado.map((user) => {
                const pct = usagePercent(user.gerado, user.limite)
                const isTop = topGenerator?.id === user.id && user.gerado > 0
                const isBottom = bottomGenerator?.id === user.id && usersCount > 1
                return (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isTop && <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                          {isBottom && <TrendingDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <span className={cn(
                        'shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border',
                        roleColor(user.role)
                      )}>
                        {formatRoleLabel(user.role)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uso mensal</span>
                        <span>{user.gerado} / {user.limite}</span>
                      </div>
                      <Progress value={pct} className={cn('h-1.5', pct >= 90 && '[&>div]:bg-destructive')} />
                    </div>

                    <div className="flex gap-1.5 text-xs text-muted-foreground">
                      <FileStack className="h-3.5 w-3.5 shrink-0 mt-px" />
                      <span>Páginas: {user.limit_page_upload}</span>
                      <span className="ml-auto">Desde {formatUserDate(user.createdAt)}</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-1/2 h-10 text-sm font-medium gap-2"
                      onClick={() => openLimitDialog(user)}
                    >
                      <Settings2 className="h-4 w-4" />
                      Limites
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="min-w-40">Uso mensal</TableHead>
                    <TableHead>Pág./proc.</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="text-right w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByGerado.map((user) => {
                    const pct = usagePercent(user.gerado, user.limite)
                    const isTop = topGenerator?.id === user.id && user.gerado > 0
                    const isBottom = bottomGenerator?.id === user.id && usersCount > 1
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {user.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isTop && <span title="Mais gerou"><TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" /></span>}
                            {isBottom && <span title="Menos gerou"><TrendingDown className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                            <p className="font-medium text-foreground">{user.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
                            roleColor(user.role)
                          )}>
                            {formatRoleLabel(user.role)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={pct} className={cn('h-1.5 w-32', pct >= 90 && '[&>div]:bg-destructive')} />
                            <p className="text-xs text-muted-foreground">{user.gerado} / {user.limite} ({pct}%)</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{user.limit_page_upload}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatUserDate(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              title="Gerenciar limites"
                              onClick={() => openLimitDialog(user)}
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* Dialog — Limites */}
      <Dialog open={isLimitDialogOpen} onOpenChange={(open) => { if (!open) closeLimitDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limites do usuário</DialogTitle>
            <DialogDescription>
              {selectedUserForLimit
                ? `${selectedUserForLimit.name} · Gerado: ${selectedUserForLimit.gerado}`
                : 'Ajuste os limites do usuário.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Limite de geração (janela)</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="Ex: 5"
                disabled={isUpdatingLimit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveLimits() } }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Limite de páginas por processamento</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={pageUploadLimitInput}
                onChange={(e) => setPageUploadLimitInput(e.target.value)}
                placeholder="Ex: 50"
                disabled={isUpdatingLimit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSaveLimits() } }}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={closeLimitDialog} disabled={isUpdatingLimit} className="sm:mr-auto">
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleResetLimit()} disabled={isUpdatingLimit}>
              {isUpdatingLimit && limitActionType === 'reset'
                ? <><Loader2 className="h-4 w-4 animate-spin" />Resetando...</>
                : 'Resetar'}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveLimits()}
              disabled={isUpdatingLimit || !limitInput.trim() || !pageUploadLimitInput.trim()}
            >
              {isUpdatingLimit && limitActionType === 'save'
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Senha */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => { if (!open) closePasswordDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              {selectedUserForPassword
                ? `Nova senha para ${selectedUserForPassword.name}.`
                : 'Defina a nova senha do usuário.'}
            </DialogDescription>
          </DialogHeader>

          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha"
            disabled={isUpdatingPassword}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleUpdatePassword() } }}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePasswordDialog} disabled={isUpdatingPassword}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleUpdatePassword()} disabled={isUpdatingPassword || !newPassword.trim()}>
              {isUpdatingPassword
                ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                : 'Salvar senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

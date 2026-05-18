'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toErrorMessage } from '@/lib/sections'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'

interface AuthMeResponse {
  role?: number
  message?: string
  error?: string
}

interface CreateUserResponse {
  id?: number
  name?: string
  email?: string
  role?: number
  message?: string
  error?: string
}

export function UsersCreateForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleUnauthorized = useCallback(() => {
    router.replace('/login?expired=1')
  }, [router])

  useEffect(() => {
    let cancelled = false

    const checkAccess = async () => {
      setIsCheckingAccess(true)

      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = (await response.json()) as AuthMeResponse

        if (cancelled) return

        if (response.status === 401) {
          handleUnauthorized()
          return
        }

        if (!response.ok) {
          throw new Error(toErrorMessage(data, 'Não foi possível verificar permissão.'))
        }

        if (data.role !== 4) {
          router.replace('/inicio/secoes')
          return
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao validar permissão.')
        }
      } finally {
        if (!cancelled) {
          setIsCheckingAccess(false)
        }
      }
    }

    void checkAccess()

    return () => {
      cancelled = true
    }
  }, [handleUnauthorized, router])

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Informe nome, email e senha para criar o usuário.')
      return
    }

    setError('')
    setSuccess('')
    setIsCreatingUser(true)

    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      })
      const data = (await response.json()) as CreateUserResponse

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (response.status === 403) {
        router.replace('/inicio/secoes')
        return
      }

      if (!response.ok) {
        throw new Error(toErrorMessage(data, 'Não foi possível criar usuário.'))
      }

      setName('')
      setEmail('')
      setPassword('')
      setSuccess(data.message || 'Usuário criado com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário.')
    } finally {
      setIsCreatingUser(false)
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
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Criar Usuário</h1>
            <p className="text-sm text-muted-foreground">
              Cadastro de nova conta. Apenas administradores (role 4) têm acesso.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/inicio/usuarios">
              <ArrowLeft className="h-4 w-4" />
              Voltar para gerência
            </Link>
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-3 text-sm text-destructive bg-destructive/10 border-destructive/30">
          {error}
        </Card>
      )}

      {success && (
        <Card className="p-3 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/30">
          {success}
        </Card>
      )}

      <Card className="p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Dados do usuário</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            O role padrão será definido automaticamente pelo backend.
          </p>
        </div>

        <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={handleCreateUser}>
          <Input
            placeholder="Nome completo"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isCreatingUser}
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isCreatingUser}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isCreatingUser}
          />

          <div className="sm:col-span-3">
            <Button type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Criar usuário
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

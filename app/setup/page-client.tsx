'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Sparkles,
  HardDrive,
  Languages,
  Lock,
  ImageIcon,
  BookOpenText,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SetupPageClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateAdmin = async () => {
    if (isLoading) return
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha nome, email e senha.')
      return
    }

    setError('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message || 'Falha ao criar administrador.')
      }

      router.replace('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar administrador.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleCreateAdmin()
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/30">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 py-12 lg:flex-row lg:items-stretch lg:gap-12">
        <section className="flex w-full max-w-xl flex-col justify-center lg:max-w-2xl">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Primeira execução
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Bem-vindo ao{' '}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              MangaIOTranslate
            </span>
          </h1>

          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Uma plataforma para ler, traduzir e organizar capítulos de mangás, quadrinhos e
            páginas escaneadas, com OCR e tradução automática. Tudo pensado para rodar na sua
            própria máquina.
          </p>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  100% gratuito e executado localmente.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Seus arquivos, OCR, traduções e leituras ficam salvos no seu próprio
                  ambiente. A única exceção é o Google Tradutor, usado opcionalmente para a
                  etapa de tradução — todo o resto roda local.
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-3 rounded-xl border bg-card/50 p-3">
              <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">OCR de imagens</p>
                <p className="text-xs text-muted-foreground">
                  Extração de texto direto das páginas.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border bg-card/50 p-3">
              <Languages className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Tradução automática</p>
                <p className="text-xs text-muted-foreground">
                  Via Google Tradutor (único serviço externo).
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border bg-card/50 p-3">
              <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Armazenamento local</p>
                <p className="text-xs text-muted-foreground">
                  Tudo salvo no seu disco, sem nuvem.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-xl border bg-card/50 p-3">
              <BookOpenText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Biblioteca pessoal</p>
                <p className="text-xs text-muted-foreground">
                  Organize seções e leia no próprio app.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="flex w-full max-w-md items-center">
          <div className="w-full rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Configuração inicial
            </div>
            <h2 className="mt-2 text-2xl font-bold">Crie o administrador</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta conta será a dona da instância. Use um email e senha que você lembre — os
              dados ficam armazenados localmente.
            </p>

            {error ? (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <Input
                  placeholder="Nome do administrador"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Senha</label>
                <Input
                  type="password"
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button className="mt-6 w-full" size="lg" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Criando administrador...' : 'Criar administrador e continuar'}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda em manter estes dados apenas neste ambiente local.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

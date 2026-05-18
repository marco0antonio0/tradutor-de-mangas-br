'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, FileText, Languages, Loader2, ScanText, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const features = [
  {
    icon: ScanText,
    title: 'OCR inteligente',
    description: 'Le e extrai texto dos baloes para melhorar o resultado do OCR manga antes da traducao.',
  },
  {
    icon: Bot,
    title: 'Traducao com IA',
    description: 'Tradutor de manga e tradutor de manhwa com contexto para dialogos mais naturais.',
  },
  {
    icon: FileText,
    title: 'Upload em PDF',
    description: 'Traduza manga online no PC ou celular com processamento por pagina em poucos cliques.',
  },
  {
    icon: Zap,
    title: 'Fila em tempo real',
    description: 'Acompanhe cada etapa sem perder ritmo quando estiver traduzindo quadrinhos e capitulos longos.',
  },
]

interface LoginFormProps {
  onLogin: () => void
  initialError?: string
}

export function LoginForm({ onLogin, initialError = '' }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    if (isLoading) return

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError('Informe email e senha para entrar.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao entrar com email e senha.')
      }

      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="relative lg:flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden px-8 py-8 lg:px-12 lg:py-14 min-h-[42vh] lg:min-h-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-4"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="lg:hidden pointer-events-none absolute bottom-0 inset-x-0 h-16 bg-linear-to-t from-zinc-950 to-transparent" />

        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          {['翻', '訳', '漫', '画', 'AI', '語'].map((char, i) => (
            <span
              key={i}
              className="absolute font-bold text-white/3 text-[clamp(60px,10vw,120px)] leading-none"
              style={{
                top: `${[8, 22, 45, 60, 75, 88][i]}%`,
                left: `${[5, 60, 15, 72, 35, 55][i]}%`,
                transform: `rotate(${[-15, 10, -8, 20, -12, 5][i]}deg)`,
              }}
            >
              {char}
            </span>
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-xl bg-primary p-2 lg:p-2.5">
              <Languages className="h-5 w-5 lg:h-6 lg:w-6 text-primary-foreground" />
            </div>
            <span className="text-lg lg:text-xl font-bold text-white tracking-tight">MangaIOTranslate</span>
          </div>
          <p className="text-xs font-mono text-zinc-500 ml-1">v2 · powered by AI</p>
        </div>

        <div className="relative z-10 mt-6 lg:mt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">Tradução automática com IA</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-[2.6rem] font-black text-white leading-tight tracking-tight">
            Tradutor de manga
            <br />
            <span className="text-primary">e manhwa em portugues.</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-sm hidden sm:block">
            Traduza manga online com OCR e IA: faca upload de PDF, selecione paginas e mantenha o layout original em minutos.
          </p>
        </div>

        <div className="relative z-10 hidden lg:grid grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-white/7 bg-white/3 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-white">{title}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 hidden lg:flex items-center gap-4">
          <Link href="/termos" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Termos de uso
          </Link>
          <span className="text-zinc-700 text-xs">·</span>
          <span className="text-xs text-zinc-700">© 2026 MangaIOTranslate</span>
        </div>
      </div>

      <div className="lg:w-115 flex flex-col items-center justify-center px-8 py-10 lg:py-0 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Entre com seu email e senha para continuar.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-5">
              <span className="shrink-0 mt-px">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
            />
            <Input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleLogin()
                }
              }}
            />
          </div>

          <Button
            onClick={() => void handleLogin()}
            disabled={isLoading}
            className="mt-4 w-full h-12 text-sm font-medium gap-3"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin shrink-0" /> : null}
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="mt-3 text-xs text-center text-muted-foreground leading-relaxed">
            Ao continuar, você concorda com os{' '}
            <Link href="/termos" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Termos de uso
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

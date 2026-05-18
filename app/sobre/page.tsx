import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  ExternalLink,
  FileImage,
  HardDrive,
  Heart,
  Languages,
  Linkedin,
  ScrollText,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre — MangaIOTranslate',
  description:
    'Projeto open source e gratuito para tradução automática de mangás e manhwas, rodando localmente.',
  alternates: { canonical: '/sobre' },
}

export default function SobrePublicPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Link href="/login">
            <Button size="sm">Entrar</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">

        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="rounded-2xl bg-primary/10 p-5">
            <Languages className="h-12 w-12 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">MangaIOTranslate</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-sm mx-auto">
              Projeto open source para traduzir mangás, manhwas e quadrinhos automaticamente —
              rodando 100% na sua máquina.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary">Open Source</Badge>
            <Badge variant="secondary">Gratuito</Badge>
            <Badge variant="secondary">Local-first</Badge>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            O que é?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">MangaIOTranslate</strong> é um projeto{' '}
            <strong className="text-foreground">open source e sem fins lucrativos</strong> que
            traduz mangás, manhwas e HQs automaticamente, preservando o layout visual original
            das páginas.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Toda a aplicação — OCR, processamento de imagens, biblioteca e leitura —{' '}
            <strong className="text-foreground">roda localmente</strong> no seu ambiente. A
            única chamada externa é para o <strong className="text-foreground">Google Tradutor</strong>,
            usado opcionalmente na etapa de tradução de texto. Nenhum arquivo, conta ou
            histórico é enviado para servidores próprios — tudo fica salvo no seu disco.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Como funciona localmente
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Banco de dados, imagens, OCR e traduções ficam armazenados no diretório
              local da instância.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Não há cadastro em servidor remoto: o administrador é criado na primeira
              execução e a autenticação roda totalmente no próprio ambiente.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              A única comunicação externa é a tradução de texto via Google Tradutor —
              só os trechos de texto extraídos são enviados, sem identificação de
              usuário.
            </li>
          </ul>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Funcionalidades
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: FileImage, text: 'Upload de imagens ou PDF de capítulos completos' },
              { icon: Languages, text: 'OCR + tradução automática preservando o layout original' },
              { icon: Upload, text: 'Suporte a múltiplas páginas e processamento em lote' },
              { icon: ScrollText, text: 'Biblioteca pessoal com histórico de seções traduzidas' },
              { icon: Users, text: 'Gerenciamento local de usuários para a instância' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Como usar
          </h2>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {[
              'Acesse "Traduzir Manga / Manhwa" na tela inicial.',
              'Dê um nome para a seção e faça upload das imagens ou PDF do capítulo.',
              'Confirme o idioma de origem e o idioma de destino.',
              'Envie para a fila de processamento local e aguarde.',
              'Abra a seção para visualizar as páginas traduzidas.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Projeto sem fins lucrativos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Não há planos pagos, créditos, assinatura nem cobrança de qualquer tipo. O projeto
            existe como uma ferramenta de estudo e uso pessoal — todo o código pode ser
            inspecionado, modificado e auto-hospedado livremente.
          </p>
        </Card>

        <Card className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Termos e Privacidade</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Como os dados são tratados em uma instância local.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/termos" target="_blank">
              Ler
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Desenvolvido por</p>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-border">
              <Image
                src="/1757035892436.jpeg"
                alt="Marco Antonio"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Marco Antonio</p>
              <p className="text-sm text-muted-foreground">Desenvolvedor Full Stack</p>
              <Link
                href="https://www.linkedin.com/in/marco-antonio-aa3024233"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
              >
                <Linkedin className="h-3.5 w-3.5" />
                linkedin.com/in/marco-antonio-aa3024233
              </Link>
            </div>
          </div>
        </Card>

      </main>
    </div>
  )
}

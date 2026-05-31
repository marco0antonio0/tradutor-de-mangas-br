import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import {
  LEGAL_AWARENESS_DECLARATION,
  LEGAL_LAST_UPDATED,
  LEGAL_TERMS_METADATA,
  LEGAL_TERMS_SECTIONS,
} from '@/lib/legal-content'

export const metadata: Metadata = {
  title: LEGAL_TERMS_METADATA.title,
  description: LEGAL_TERMS_METADATA.description,
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary p-2">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Termos de Uso e Política de Privacidade</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            MangaIOTranslate · Última atualização: {LEGAL_LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          {LEGAL_TERMS_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-foreground mb-2">{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.title}-p-${index}`} className={index > 0 ? 'mt-2' : ''}>
                  {paragraph}
                </p>
              ))}
              {section.lists?.map((list) => (
                <div key={`${section.title}-${list.title}`}>
                  {list.title ? (
                    <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">{list.title}</h3>
                  ) : null}
                  {list.intro ? <p className="mt-2">{list.intro}</p> : null}
                  {list.items.length > 0 ? (
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      {list.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          ))}

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Declaração de ciência:</strong>{' '}
              {LEGAL_AWARENESS_DECLARATION}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Software fornecido <em>"as is"</em>, sem garantias.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

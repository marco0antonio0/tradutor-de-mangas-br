import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(240,199,72,0.08),transparent)]"
      />

      {/* Floating Japanese chars */}
      <div className="pointer-events-none fixed inset-0 select-none overflow-hidden">
        {(['404', '？', '迷', '子', '…'] as const).map((char, i) => (
          <span
            key={char}
            className="absolute font-black text-white/[0.025] leading-none"
            style={{
              fontSize: 'clamp(60px, 10vw, 120px)',
              top: `${[8, 25, 50, 70, 88][i]}%`,
              left: `${[5, 68, 15, 75, 40][i]}%`,
              transform: `rotate(${[-12, 8, -6, 15, -4][i]}deg)`,
            }}
          >
            {char}
          </span>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8">
          <Image
            src="/logo.png"
            alt="MangaIOTranslate"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
        </Link>

        {/* 404 */}
        <p className="text-8xl font-black text-amber-400 leading-none">404</p>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          A página que você procura não existe ou foi removida.
          Volte para o início e continue traduzindo seus mangás favoritos.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-300"
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Traduzir agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Sugestões */}
        <div className="mt-10 w-full rounded-2xl border border-white/10 bg-zinc-900/60 p-5 text-left backdrop-blur-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            <Search className="h-3.5 w-3.5" />
            Talvez você queira
          </p>
          <ul className="mt-3 space-y-2">
            {[
              { href: '/', label: 'Página inicial' },
              { href: '/login', label: 'Entrar na plataforma' },
              { href: '/sobre', label: 'Sobre o MangaIOTranslate' },
              { href: '/termos', label: 'Termos de uso' },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import {
  Anton,
  Audiowide,
  Bangers,
  Bebas_Neue,
  Carter_One,
  Changa_One,
  Geist,
  Geist_Mono,
  Kalam,
  Luckiest_Guy,
  Noto_Sans_KR,
  Permanent_Marker,
  Righteous,
  Rubik_Mono_One,
  Teko,
} from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const _geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const _bangers = Bangers({ subsets: ['latin'], weight: '400', variable: '--font-bangers' })
const _carterOne = Carter_One({ subsets: ['latin'], weight: '400', variable: '--font-carter-one' })
const _righteous = Righteous({ subsets: ['latin'], weight: '400', variable: '--font-righteous' })
const _rubikMonoOne = Rubik_Mono_One({ subsets: ['latin'], weight: '400', variable: '--font-rubik-mono-one' })
const _audiowide = Audiowide({ subsets: ['latin'], weight: '400', variable: '--font-audiowide' })
const _permanentMarker = Permanent_Marker({ subsets: ['latin'], weight: '400', variable: '--font-permanent-marker' })
const _kalam = Kalam({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-kalam' })
const _luckiestGuy = Luckiest_Guy({ subsets: ['latin'], weight: '400', variable: '--font-luckiest-guy' })
const _changaOne = Changa_One({ subsets: ['latin'], weight: '400', variable: '--font-changa-one' })
const _bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas-neue' })
const _anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const _teko = Teko({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-teko' })
const _notoSansKr = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans-kr' })

const siteUrl = 'http://localhost:3080/'
const siteName = 'MangaIOTranslate'
const defaultTitle = 'MangaIOTranslate | Tradutor de Manga Brasileiro com IA'
const defaultDescription =
  'Tradutor de manga brasileiro online com IA. Traduza manga e manhwa para o português do Brasil no PC e celular, com qualidade visual e layout original preservado.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    'tradutor de manga brasileiro',
    'tradutor de manga em portugues',
    'tradutor de manga pt br',
    'traduzir manga para portugues do brasil',
    'manga em portugues brasileiro',
    'manhwa em portugues',
    'tradutor de mangá',
    'tradutor de manga',
    'tradução de mangá',
    'traduzir manga',
    'tradutor de manhwa brasileiro',
    'manga traduzido para o brasileiro',
    'como traduzir manga em portugues',
    'como traduzir manga pelo celular',
    'como traduzir manhwa em portugues',
    'traduzir manhwa para o portugues',
    'tradutor de manga online brasileiro',
    'tradutor de quadrinhos brasileiro',
    'manga traduzido pt br',
    'traduzir de manhwa gratis',
    'tradutor de quadrinhos gratis',
    'tradutor de manga para pc',
    'tradutor de manga online',
    'manga translator',
    'ocr manga',
    'tradução de quadrinhos',
    'manga em pt br',
    'manhwa pt br',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: defaultTitle,
    description: defaultDescription,
    siteName,
    locale: 'pt_BR',
    images: [
      {
        url: '/image-preview-link.png',
        width: 1259,
        height: 744,
        type: 'image/png',
        alt: 'MangaIOTranslate - Tradutor de Manga Brasileiro com IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/image-preview-link.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={[
          _geist.variable,
          _geistMono.variable,
          _bangers.variable,
          _carterOne.variable,
          _righteous.variable,
          _rubikMonoOne.variable,
          _audiowide.variable,
          _permanentMarker.variable,
          _kalam.variable,
          _luckiestGuy.variable,
          _changaOne.variable,
          _bebasNeue.variable,
          _anton.variable,
          _teko.variable,
          _notoSansKr.variable,
          'font-sans antialiased',
        ].join(' ')}
      >
        {children}
        <Analytics />
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}

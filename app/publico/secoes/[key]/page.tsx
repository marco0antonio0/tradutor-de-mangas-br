import { notFound } from 'next/navigation'
import { PublicSectionReader } from '@/components/public-section-reader'

type PageParams = {
  params: Promise<{ key: string }>
}

export default async function SecaoPublicaPage({ params }: PageParams) {
  const { key } = await params

  if (!key || key.length < 8) {
    notFound()
  }

  return <PublicSectionReader sharedKey={key} />
}

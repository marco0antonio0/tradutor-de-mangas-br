import { notFound } from 'next/navigation'
import { SectionReader } from '@/components/section-reader'

type PageParams = {
  params: Promise<{ id: string }>
}

export default async function SecaoDetalhePage({ params }: PageParams) {
  const { id } = await params

  if (!/^\d+$/.test(id)) {
    notFound()
  }

  return <SectionReader sectionId={Number(id)} />
}

import { NextRequest, NextResponse } from 'next/server'
import { buildModelApiUrl, modelApiHeaders } from '@/lib/model-gateway'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Apenas imagens são aceitas.' }, { status: 400 })

    const upstream = new FormData()
    upstream.append('file', file)

    const response = await fetch(buildModelApiUrl('/api/v1/extract-text-boxes'), {
      method: 'POST',
      headers: modelApiHeaders(),
      body: upstream,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('extract-text-boxes error:', text || `HTTP ${response.status}`)
      return NextResponse.json({ error: 'Erro ao extrair texto da imagem.' }, { status: response.status })
    }

    return NextResponse.json(await response.json())
  } catch (error) {
    console.error('extract route error:', error)
    return NextResponse.json({ error: 'Erro ao processar extração.' }, { status: 500 })
  }
}

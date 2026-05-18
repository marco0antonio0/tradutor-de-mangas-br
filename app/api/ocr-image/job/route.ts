import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getUserFromToken } from '@/lib/local-backend/auth'
import { redisGetJson } from '@/lib/redis-cache'

const AUTH_TOKEN_COOKIE = 'manga-access-token'

type OcrLocalJob = {
  job_id?: string
  status?: string
  queue_key?: string
  error_message?: string
  extracted_text?: string
  elapsed_ms?: number
  timeout_sec?: number
  ocr_variant_best?: string | null
  ocr_error?: string | null
  created_at?: string
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value
  const user = getUserFromToken(token)

  if (!user) {
    return NextResponse.json(
      { message: 'Token inválido ou expirado', error: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }

  try {
    const url = new URL(request.url)
    const jobKey = url.searchParams.get('job_key')?.trim() || ''
    const queueKeyRaw = url.searchParams.get('queue_key')?.trim() || ''

    if (!jobKey) {
      return NextResponse.json({ message: 'Parâmetro job_key é obrigatório.' }, { status: 400 })
    }

    const job = await redisGetJson<OcrLocalJob>(jobKey)
    if (!job) {
      return NextResponse.json(
        { job_key: jobKey, status: 'not_found', message: 'Job não encontrado no armazenamento local.' },
        { status: 404 }
      )
    }

    const queueKey = queueKeyRaw || String(job.queue_key || 'local:ocr-queue')

    return NextResponse.json({
      job_key: jobKey,
      queue_key: queueKey,
      status: String(job.status || 'unknown'),
      queue_position: 0,
      queue_length: 1,
      lock_value: null,
      job,
    })
  } catch (error) {
    console.error('OCR job polling route error:', error)
    return NextResponse.json({ message: 'Erro ao consultar status do job OCR.' }, { status: 500 })
  }
}

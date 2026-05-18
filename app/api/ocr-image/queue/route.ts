import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'

import { getUserFromToken } from '@/lib/local-backend/auth'
import { buildModelApiUrl, modelApiHeaders } from '@/lib/model-gateway'
import { redisSetJson } from '@/lib/redis-cache'

const AUTH_TOKEN_COOKIE = 'manga-access-token'
const OCR_JOB_TTL_SECONDS = 60 * 60

export async function POST(request: Request) {
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
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ message: 'Nenhum arquivo válido para OCR.' }, { status: 400 })
    }

    const upstreamFormData = new FormData()
    const fileName = file instanceof File && file.name ? file.name : 'ocr-image.png'
    upstreamFormData.append('file', file, fileName)

    const response = await fetch(buildModelApiUrl('/api/v1/ocr-image'), {
      method: 'POST',
      headers: modelApiHeaders(),
      body: upstreamFormData,
      cache: 'no-store',
    })

    const payloadText = await response.text()
    let payload: any = {}
    try {
      payload = payloadText ? JSON.parse(payloadText) : {}
    } catch {
      payload = { message: payloadText }
    }

    const jobId = crypto.randomUUID()
    const jobKey = `local:ocr-job:${jobId}`
    const queueKey = 'local:ocr-queue'

    const job = response.ok
      ? {
          job_id: jobId,
          status: 'done',
          extracted_text: String(payload.extracted_text ?? ''),
          elapsed_ms: Number(payload.elapsed_ms ?? 0),
          timeout_sec: Number(payload.timeout_sec ?? 0),
          ocr_variant_best: payload.ocr_variant_best ?? null,
          ocr_error: payload.ocr_error ?? null,
          created_at: new Date().toISOString(),
          queue_key: queueKey,
        }
      : {
          job_id: jobId,
          status: 'failed',
          error_message: String(payload?.detail || payload?.message || 'Falha no OCR.'),
          created_at: new Date().toISOString(),
          queue_key: queueKey,
        }

    await redisSetJson(jobKey, job, OCR_JOB_TTL_SECONDS)

    return NextResponse.json({
      job_key: jobKey,
      queue_key: queueKey,
      status: job.status,
      queue_position: 0,
      queue_length: 1,
      job,
    }, { status: response.ok ? 200 : response.status })
  } catch (error) {
    console.error('OCR queue route error:', error)
    return NextResponse.json({ message: 'Erro ao enfileirar OCR da área selecionada.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

import { redisMGetStrings, redisSetString } from '@/lib/redis-cache'

type TranslationProvider = 'google'

const MAX_BATCH_ITEMS = 300
const MAX_TEXT_LENGTH = 5000
const MAX_CONCURRENCY = 4
const CACHE_SET_CONCURRENCY = 8
const TRANSLATION_CACHE_TTL_SECONDS = 0
const TRANSLATION_CACHE_PREFIX = 'manga:translate:v1'

interface TranslateBatchBody {
  source_lang?: unknown
  target_lang?: unknown
  provider_lang?: unknown
  texts?: unknown
}

function toLanguageCode(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed
}

function normalizeProvider(_value: unknown): TranslationProvider {
  return 'google'
}

function toSafeTexts(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, MAX_BATCH_ITEMS)
    .map((item) => item.slice(0, MAX_TEXT_LENGTH))
}

function parseGoogleTranslation(payload: unknown) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null

  const fragments = payload[0]
    .map((entry) => {
      if (!Array.isArray(entry)) return ''
      const translatedPart = entry[0]
      return typeof translatedPart === 'string' ? translatedPart : ''
    })
    .filter(Boolean)

  if (fragments.length === 0) return null
  return fragments.join('')
}

async function translateWithGoogle(text: string, sourceLang: string, targetLang: string) {
  const query = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
    dt: 't',
    q: text,
  })

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      accept: 'application/json, text/plain, */*',
    },
  })

  if (!response.ok) {
    throw new Error(`Google Translate HTTP ${response.status}`)
  }

  const raw = await response.text()
  const parsed = JSON.parse(raw) as unknown
  const translated = parseGoogleTranslation(parsed)
  if (!translated) {
    throw new Error('Resposta de tradução inválida')
  }

  return translated
}

function resolveProviderCacheToken(provider: TranslationProvider) {
  return provider
}

async function translateBatchTexts(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider
) {
  const translations = new Array<string>(texts.length).fill('')
  let currentIndex = 0

  async function worker() {
    while (true) {
      const index = currentIndex
      currentIndex += 1
      if (index >= texts.length) return

      const sourceText = texts[index]
      try {
        translations[index] = await translateWithGoogle(sourceText, sourceLang, targetLang)
      } catch {
        translations[index] = sourceText
      }
    }
  }

  const workerCount = Math.max(1, Math.min(MAX_CONCURRENCY, texts.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return translations
}

function buildTranslationCacheKey(
  text: string,
  sourceLang: string,
  targetLang: string,
  provider: string
) {
  const hash = createHash('sha256')
    .update(provider)
    .update('\u0000')
    .update(sourceLang)
    .update('\u0000')
    .update(targetLang)
    .update('\u0000')
    .update(text)
    .digest('hex')

  return `${TRANSLATION_CACHE_PREFIX}:${hash}`
}

async function persistTranslationsInCache(entries: Array<{ key: string; value: string }>) {
  if (entries.length === 0) return

  let currentIndex = 0

  async function worker() {
    while (true) {
      const index = currentIndex
      currentIndex += 1
      if (index >= entries.length) return

      const current = entries[index]
      await redisSetString(current.key, current.value, TRANSLATION_CACHE_TTL_SECONDS)
    }
  }

  const workerCount = Math.max(1, Math.min(CACHE_SET_CONCURRENCY, entries.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as TranslateBatchBody
    const sourceLang = toLanguageCode(payload.source_lang, 'auto')
    const targetLang = toLanguageCode(payload.target_lang, 'pt-BR')
    const provider = normalizeProvider(payload.provider_lang)
    const texts = toSafeTexts(payload.texts)

    if (texts.length === 0) {
      return NextResponse.json(
        {
          message: 'Nenhum texto válido para tradução.',
          translations: [],
          provider_lang: provider,
          source_lang: sourceLang,
          target_lang: targetLang,
        },
        { status: 400 }
      )
    }

    const providerCacheToken = resolveProviderCacheToken(provider)
    const cacheKeys = texts.map((text) => buildTranslationCacheKey(text, sourceLang, targetLang, providerCacheToken))
    const cachedTranslations = await redisMGetStrings(cacheKeys)

    const translations = new Array<string>(texts.length).fill('')
    const missingIndexes: number[] = []

    for (let index = 0; index < texts.length; index += 1) {
      const cached = cachedTranslations[index]
      if (typeof cached === 'string' && cached.length > 0) {
        translations[index] = cached
      } else {
        missingIndexes.push(index)
      }
    }

    if (missingIndexes.length > 0) {
      const missingTexts = missingIndexes.map((index) => texts[index])
      const translatedMissing = await translateBatchTexts(missingTexts, sourceLang, targetLang, provider)

      const toPersistInCache: Array<{ key: string; value: string }> = []
      missingIndexes.forEach((originalIndex, translatedIndex) => {
        const translatedText = translatedMissing[translatedIndex] || texts[originalIndex]
        translations[originalIndex] = translatedText
        toPersistInCache.push({
          key: cacheKeys[originalIndex],
          value: translatedText,
        })
      })

      await persistTranslationsInCache(toPersistInCache)
    }

    return NextResponse.json({
      translations,
      provider_lang: provider,
      provider_model: null,
      source_lang: sourceLang,
      target_lang: targetLang,
    })
  } catch (error) {
    console.error('Translate text batch route error:', error)
    return NextResponse.json(
      {
        message: 'Erro ao traduzir textos em lote.',
      },
      { status: 500 }
    )
  }
}

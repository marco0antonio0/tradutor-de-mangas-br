import fs from 'node:fs'
import path from 'node:path'
import { db } from '@/lib/backend/shared/database.module'
import { buildModelApiUrl, modelApiHeaders } from '@/lib/model-gateway'
import { decryptSecret } from '@/lib/security/secrets'
import type { ImageKind, ResolvedImageFile } from './sections.types'

const sectionsRoot = path.resolve(process.cwd(), 'storage', 'sections')
if (!fs.existsSync(sectionsRoot)) fs.mkdirSync(sectionsRoot, { recursive: true })

function extFromName(name: string) {
  const ext = path.extname(name || '').trim().toLowerCase()
  if (!ext || ext.length > 10) return '.bin'
  return ext
}

function parseGoogleTranslation(payload: unknown) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null
  const fragments = payload[0]
    .map((entry: unknown) => {
      if (!Array.isArray(entry)) return ''
      const part = entry[0]
      return typeof part === 'string' ? part : ''
    })
    .filter(Boolean)
  if (fragments.length === 0) return null
  return fragments.join('')
}

async function translateOneViaGoogle(text: string, sourceLang: string, targetLang: string) {
  const query = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
    dt: 't',
    q: text,
  })
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${query.toString()}`,
    { method: 'GET', cache: 'no-store', headers: { accept: 'application/json, text/plain, */*' } }
  )
  if (!response.ok) throw new Error(`Google Translate HTTP ${response.status}`)
  const raw = await response.text()
  const parsed = JSON.parse(raw) as unknown
  const translated = parseGoogleTranslation(parsed)
  if (!translated) throw new Error('Resposta de tradução inválida')
  return translated
}

async function translateBatchViaGoogle(texts: string[], sourceLang: string, targetLang: string) {
  const out = new Array<string>(texts.length).fill('')
  const concurrency = Math.max(1, Math.min(4, texts.length))
  let cursor = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++
        if (i >= texts.length) return
        try {
          out[i] = await translateOneViaGoogle(texts[i], sourceLang, targetLang)
        } catch {
          out[i] = texts[i]
        }
      }
    })
  )
  return out
}

function parseProvider(providerLang: string) {
  const normalized = (providerLang || '').trim()
  if (normalized.toLowerCase().startsWith('openrouter:')) {
    const model = normalized.slice('openrouter:'.length).trim()
    return { provider: 'openrouter' as const, model: model || 'google/gemma-4-31b-it' }
  }
  return { provider: 'google' as const, model: '' }
}

function getOpenRouterApiKeyFromDb() {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1')
    .get('manga:openrouter:api_key') as { value?: string } | undefined
  const raw = row?.value ? String(row.value) : ''
  if (!raw) return ''
  const decrypted = decryptSecret(raw)
  return (decrypted || raw || '').trim()
}

function parseOpenRouterMessageContent(content: unknown) {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (!part || typeof part !== 'object') return ''
        const rec = part as Record<string, unknown>
        const text = rec.text
        return typeof text === 'string' ? text : ''
      })
      .filter(Boolean)
      .join('\n')
    return joined.trim()
  }
  return ''
}

async function translateOneViaOpenRouter(
  text: string,
  sourceLang: string,
  targetLang: string,
  model: string,
  apiKey: string
) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Translate from ${sourceLang} to ${targetLang}. Return only the translated text.`,
        },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`)
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = parseOpenRouterMessageContent(payload?.choices?.[0]?.message?.content)
  if (!content) throw new Error('Resposta de tradução OpenRouter inválida')
  return content
}

async function translateBatchViaOpenRouter(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  model: string,
  apiKey: string
) {
  const out = new Array<string>(texts.length).fill('')
  const concurrency = Math.max(1, Math.min(3, texts.length))
  let cursor = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++
        if (i >= texts.length) return
        try {
          out[i] = await translateOneViaOpenRouter(texts[i], sourceLang, targetLang, model, apiKey)
        } catch {
          out[i] = texts[i]
        }
      }
    })
  )
  return out
}

export class SectionsRepository {
  listSections(userId: number) {
    const sectionRows = db.prepare(`
      SELECT s.*,
        COUNT(i.id) as images_count,
        SUM(CASE WHEN i.selected_for_processing = 1 THEN 1 ELSE 0 END) as selected_images_count,
        SUM(CASE WHEN i.status IN ('queued','processing') THEN 1 ELSE 0 END) as queued_images_count,
        SUM(CASE WHEN i.status = 'processing' THEN 1 ELSE 0 END) as processing_images_count
      FROM sections s
      LEFT JOIN section_images i ON i.section_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.id DESC
    `).all(userId) as any[]

    const firstImageBySectionId = new Map<number, { imageId: number; mime: string }>()
    const firstImageRows = db.prepare(`
      SELECT i.section_id, i.id, i.mime
      FROM section_images i
      JOIN (
        SELECT section_id, MIN(order_index) AS min_order_index
        FROM section_images
        GROUP BY section_id
      ) first_i
      ON first_i.section_id = i.section_id AND first_i.min_order_index = i.order_index
    `).all() as Array<{ section_id: number; id: number; mime: string | null }>

    for (const image of firstImageRows) {
      const sectionId = Number(image.section_id)
      if (!Number.isFinite(sectionId)) continue
      if (firstImageBySectionId.has(sectionId)) continue
      firstImageBySectionId.set(sectionId, {
        imageId: Number(image.id),
        mime: typeof image.mime === 'string' && image.mime.trim() ? image.mime : 'application/octet-stream',
      })
    }

    return sectionRows.map((row) => {
      const sectionId = Number(row.id)
      const coverImage = firstImageBySectionId.get(sectionId)

      return {
      id: sectionId,
      name: String(row.name),
      priority: Number(row.priority ?? 10),
      status: String(row.status ?? 'completed'),
      internal_status: String(row.internal_status ?? 'idle'),
      source_lang: String(row.source_lang ?? 'auto'),
      target_lang: String(row.target_lang ?? 'pt-BR'),
      include_logs: Boolean(row.include_logs),
      provider_lang: String(row.provider_lang ?? 'google'),
      images_count: Number(row.images_count ?? 0),
      selected_images_count: Number(row.selected_images_count ?? 0),
      queued_images_count: Number(row.queued_images_count ?? 0),
      processing_images_count: Number(row.processing_images_count ?? 0),
      cover: coverImage
        ? {
            image_id: coverImage.imageId,
            mime: coverImage.mime,
            view_url: `/api/sections/${sectionId}/images/${coverImage.imageId}/original/view`,
            download_url: `/api/sections/${sectionId}/images/${coverImage.imageId}/original/view`,
          }
        : null,
      public_access: null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      }
    })
  }

  async createSectionFromFormData(userId: number, formData: FormData) {
    const nameRaw = String(formData.get('name') ?? '').trim()
    const name = nameRaw || `Secao ${new Date().toLocaleString('pt-BR')}`
    const sourceLang = String(formData.get('source_lang') ?? 'auto').trim() || 'auto'
    const targetLang = String(formData.get('target_lang') ?? 'pt-BR').trim() || 'pt-BR'
    const providerLang = String(formData.get('provider_lang') ?? 'google').trim() || 'google'

    const files = formData.getAll('files').filter((x): x is File => x instanceof File)
    if (files.length === 0) {
      throw new Error('Envie ao menos um arquivo de imagem.')
    }

    const now = new Date().toISOString()
    const sectionInsert = db.prepare(`
      INSERT INTO sections (user_id, name, priority, status, internal_status, source_lang, target_lang, provider_lang, include_logs, created_at, updated_at)
      VALUES (?, ?, 10, 'processing', 'queued', ?, ?, ?, 0, ?, ?)
    `).run(userId, name, sourceLang, targetLang, providerLang, now, now)
    const sectionId = Number(sectionInsert.lastInsertRowid)

    const sectionDir = path.join(sectionsRoot, String(sectionId), 'images')
    fs.mkdirSync(sectionDir, { recursive: true })

    const insertImage = db.prepare(`
      INSERT INTO section_images (
        section_id, order_index, original_name, mime, size_bytes, original_path, translated_path,
        status, translation_status, selected_for_processing, source_lang, target_lang, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'queued', 'pending', 1, ?, ?, ?, ?)
    `)

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const ext = extFromName(file.name)
      const fileName = `${String(index + 1).padStart(4, '0')}${ext}`
      const localPath = path.join(sectionDir, fileName)
      const buffer = Buffer.from(await file.arrayBuffer())
      fs.writeFileSync(localPath, buffer)

      insertImage.run(
        sectionId,
        index,
        file.name || fileName,
        file.type || 'application/octet-stream',
        buffer.byteLength,
        localPath,
        sourceLang,
        targetLang,
        now,
        now
      )
    }

    void this.processSectionTranslations(sectionId, sourceLang, targetLang, providerLang)

    return sectionId
  }

  private async processSectionTranslations(
    sectionId: number,
    sourceLang: string,
    targetLang: string,
    providerLang: string
  ) {
    try {
      db.prepare('UPDATE sections SET internal_status = ?, updated_at = ? WHERE id = ?')
        .run('processing', new Date().toISOString(), sectionId)

      const images = db.prepare(`
        SELECT id, order_index, original_path, mime
        FROM section_images
        WHERE section_id = ? AND translation_status = 'pending'
        ORDER BY order_index ASC
      `).all(sectionId) as any[]

      for (const image of images) {
        await this.translateImage(sectionId, image, sourceLang, targetLang, providerLang)
      }

      const remaining = db.prepare(`
        SELECT COUNT(*) as count FROM section_images
        WHERE section_id = ? AND translation_status NOT IN ('translated','extracted','failed')
      `).get(sectionId) as any

      const finalStatus = Number(remaining?.count ?? 0) === 0 ? 'completed' : 'partial'
      db.prepare('UPDATE sections SET status = ?, internal_status = ?, updated_at = ? WHERE id = ?')
        .run(finalStatus, 'idle', new Date().toISOString(), sectionId)
    } catch (error) {
      console.error('[sections] processSectionTranslations error:', error)
      db.prepare('UPDATE sections SET internal_status = ?, updated_at = ? WHERE id = ?')
        .run('idle', new Date().toISOString(), sectionId)
    }
  }

  private async translateImage(
    sectionId: number,
    image: { id: number; order_index: number; original_path: string; mime: string },
    sourceLang: string,
    targetLang: string,
    providerLang: string
  ) {
    const now = new Date().toISOString()
    db.prepare(`UPDATE section_images SET status = 'processing', translation_status = 'translating', updated_at = ? WHERE id = ?`)
      .run(now, image.id)

    try {
      if (!fs.existsSync(image.original_path)) {
        throw new Error('Arquivo original não encontrado.')
      }
      const buffer = fs.readFileSync(image.original_path)
      const blob = new Blob([buffer], { type: image.mime || 'application/octet-stream' })

      const upstream = new FormData()
      upstream.append('file', blob, path.basename(image.original_path))

      const url = buildModelApiUrl('/api/v1/extract-text-boxes')
      const response = await fetch(url, {
        method: 'POST',
        headers: modelApiHeaders(),
        body: upstream,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Python API ${response.status}: ${text.slice(0, 200)}`)
      }

      const data = await response.json() as {
        detections?: Array<{
          det_id?: number
          cls_name?: string
          conf?: number
          box?: [number, number, number, number]
          ocr_text?: string
          ocr_error?: string
        }>
      }

      const detections = Array.isArray(data.detections) ? data.detections : []
      const textsToTranslate: { detIdx: number; text: string }[] = []
      detections.forEach((det, idx) => {
        const text = typeof det?.ocr_text === 'string' ? det.ocr_text.trim() : ''
        if (text) textsToTranslate.push({ detIdx: idx, text })
      })

      const provider = parseProvider(providerLang)
      let translations: string[] = []

      if (provider.provider === 'openrouter') {
        const apiKey = getOpenRouterApiKeyFromDb()
        if (!apiKey) {
          throw new Error('OpenRouter selecionado, mas nenhuma API key válida foi encontrada.')
        }
        translations = await translateBatchViaOpenRouter(
          textsToTranslate.map((t) => t.text),
          sourceLang,
          targetLang,
          provider.model,
          apiKey
        )
      } else {
        translations = await translateBatchViaGoogle(
          textsToTranslate.map((t) => t.text),
          sourceLang,
          targetLang
        )
      }

      const translatedByIdx = new Map<number, string>()
      textsToTranslate.forEach((entry, position) => {
        translatedByIdx.set(entry.detIdx, translations[position] || entry.text)
      })

      db.prepare('DELETE FROM section_image_ocr_items WHERE section_image_id = ?').run(image.id)

      const insertItem = db.prepare(`
        INSERT INTO section_image_ocr_items (
          section_image_id, det_id, cls_name, conf, x1, y1, x2, y2, ocr_text, translated_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const insertTx = db.transaction((entries: typeof detections) => {
        entries.forEach((det, idx) => {
          const box = Array.isArray(det.box) ? det.box : [0, 0, 0, 0]
          const [x1, y1, x2, y2] = box.map((n) => Math.floor(Number(n) || 0))
          const ocrText = typeof det.ocr_text === 'string' ? det.ocr_text : ''
          const translatedText = translatedByIdx.get(idx) ?? ''
          insertItem.run(
            image.id,
            Number(det.det_id ?? idx + 1),
            typeof det.cls_name === 'string' ? det.cls_name : null,
            typeof det.conf === 'number' ? det.conf : null,
            x1, y1, x2, y2,
            ocrText,
            translatedText,
            new Date().toISOString()
          )
        })
      })
      insertTx(detections)

      db.prepare(`
        UPDATE section_images
        SET status = 'completed', translation_status = 'extracted', updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), image.id)
    } catch (error) {
      console.error(`[sections] translateImage ${sectionId}/${image.id} error:`, error)
      db.prepare(`UPDATE section_images SET status = 'error', translation_status = 'failed', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), image.id)
    }
  }

  getSectionDetail(sectionId: number, userId: number) {
    const section = db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!section) return null

    const images = db.prepare('SELECT * FROM section_images WHERE section_id = ? ORDER BY order_index ASC').all(sectionId) as any[]

    return {
      id: Number(section.id),
      name: String(section.name),
      status: String(section.status ?? 'completed'),
      internal_status: String(section.internal_status ?? 'idle'),
      source_lang: String(section.source_lang ?? 'auto'),
      target_lang: String(section.target_lang ?? 'pt-BR'),
      provider_lang: String(section.provider_lang ?? 'google'),
      include_logs: Boolean(section.include_logs),
      queue: null,
      public_access: null,
      created_at: String(section.created_at),
      updated_at: String(section.updated_at),
      images: images.map((img) => {
        const items = db.prepare(`
          SELECT id, det_id, cls_name, conf, x1, y1, x2, y2, ocr_text, translated_text
          FROM section_image_ocr_items
          WHERE section_image_id = ?
          ORDER BY id ASC
        `).all(img.id) as any[]
        const overlayItems = items.map((row) => ({
          id: Number(row.id),
          det_id: Number(row.det_id),
          cls_name: row.cls_name ? String(row.cls_name) : null,
          conf: row.conf !== null && row.conf !== undefined ? Number(row.conf) : null,
          box: [Number(row.x1), Number(row.y1), Number(row.x2), Number(row.y2)] as [number, number, number, number],
          ocr_text: String(row.ocr_text || ''),
          translated_text: String(row.translated_text || ''),
        }))
        const translatedBoxes = overlayItems.filter((item) => item.translated_text).length
        return {
          id: Number(img.id),
          order_index: Number(img.order_index),
          original_name: String(img.original_name),
          mime: String(img.mime || 'application/octet-stream'),
          size_bytes: Number(img.size_bytes || 0),
          status: String(img.status || 'queued'),
          translation_status: String(img.translation_status || 'pending'),
          selected_for_processing: Boolean(img.selected_for_processing),
          translation_error: null,
          translated_mime: null,
          translated_size_bytes: 0,
          translated_width: null,
          translated_height: null,
          detections_count: overlayItems.length,
          elapsed_ms: 0,
          source_lang: img.source_lang ? String(img.source_lang) : null,
          target_lang: img.target_lang ? String(img.target_lang) : null,
          slowest_stage: null,
          ocr_cache_url: null,
          ocr: {
            total_boxes: overlayItems.length,
            translated_boxes: translatedBoxes,
            has_boxes: overlayItems.length > 0,
            items: overlayItems,
          },
          original_url: `/api/sections/${sectionId}/images/${img.id}/original/view`,
          translated_url: null,
        }
      }),
    }
  }

  deleteSection(sectionId: number, userId: number) {
    const section = db.prepare('SELECT id FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!section) return false

    db.prepare('DELETE FROM sections WHERE id = ?').run(sectionId)
    const sectionDir = path.join(sectionsRoot, String(sectionId))
    fs.rmSync(sectionDir, { recursive: true, force: true })
    return true
  }

  reprocessSection(sectionId: number, userId: number) {
    const section = db.prepare('SELECT id, source_lang, target_lang, provider_lang FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!section) return false
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE section_images
      SET translation_status = 'pending', status = 'queued', translated_path = NULL, updated_at = ?
      WHERE section_id = ?
    `).run(now, sectionId)
    db.prepare('UPDATE sections SET status = ?, internal_status = ?, updated_at = ? WHERE id = ?')
      .run('processing', 'queued', now, sectionId)
    void this.processSectionTranslations(
      sectionId,
      String(section.source_lang || 'auto'),
      String(section.target_lang || 'pt-BR'),
      String(section.provider_lang || 'google')
    )
    return true
  }

  renameSection(sectionId: number, userId: number, name: string) {
    const row = db.prepare('SELECT id FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!row) return false
    db.prepare('UPDATE sections SET name = ?, updated_at = ? WHERE id = ?').run(name, new Date().toISOString(), sectionId)
    return true
  }

  updateSectionPriority(sectionId: number, userId: number, priority: number) {
    const row = db.prepare('SELECT id FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!row) return false
    db.prepare('UPDATE sections SET priority = ?, updated_at = ? WHERE id = ?').run(priority, new Date().toISOString(), sectionId)
    return true
  }

  updateImageSelection(sectionId: number, userId: number, selection: Record<number, boolean>) {
    const section = db.prepare('SELECT id FROM sections WHERE id = ? AND user_id = ?').get(sectionId, userId) as any
    if (!section) return false
    const now = new Date().toISOString()
    const stmt = db.prepare('UPDATE section_images SET selected_for_processing = ?, updated_at = ? WHERE id = ? AND section_id = ?')
    const tx = db.transaction((entries: [number, boolean][]) => {
      for (const [imageId, selected] of entries) {
        stmt.run(selected ? 1 : 0, now, imageId, sectionId)
      }
    })
    tx(Object.entries(selection).map(([k, v]) => [Number(k), Boolean(v)]))
    return true
  }

  resolveImageFile(sectionId: number, imageId: number, kind: ImageKind, userId: number): ResolvedImageFile | null {
    const row = db.prepare(`
      SELECT i.*, s.user_id
      FROM section_images i
      JOIN sections s ON s.id = i.section_id
      WHERE i.id = ? AND i.section_id = ?
      LIMIT 1
    `).get(imageId, sectionId) as any

    if (!row || Number(row.user_id) !== userId) return null

    const filePath = kind === 'translated'
      ? (row.translated_path || row.original_path)
      : row.original_path

    if (!filePath || !fs.existsSync(filePath)) return null

    return {
      filePath: String(filePath),
      mime: String(row.mime || 'application/octet-stream'),
      size: Number(row.size_bytes || 0),
    }
  }
}

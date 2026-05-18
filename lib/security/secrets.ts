import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SECRET_VERSION = 'v1'
const KEY_FILE = path.resolve(process.cwd(), 'storage', 'instance.key')
let cachedKey: Buffer | null = null

function keyMaterial() {
  if (cachedKey) return cachedKey

  try {
    if (fs.existsSync(KEY_FILE)) {
      const fileKey = fs.readFileSync(KEY_FILE, 'utf8').trim()
      if (fileKey) {
        cachedKey = Buffer.from(fileKey, 'base64')
        if (cachedKey.length === 32) return cachedKey
      }
    }
  } catch {
    // fallback abaixo
  }

  const dir = path.dirname(KEY_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const generated = crypto.randomBytes(32)
  try {
    fs.writeFileSync(KEY_FILE, generated.toString('base64'), { mode: 0o600 })
  } catch {
    // se não conseguir gravar, mantém em memória para esta execução
  }
  cachedKey = generated
  return generated
}

export function encryptSecret(plainText: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    SECRET_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptSecret(payload: string) {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== SECRET_VERSION) return null

  try {
    const iv = Buffer.from(parts[1], 'base64')
    const tag = Buffer.from(parts[2], 'base64')
    const data = Buffer.from(parts[3], 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial(), iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    return plain
  } catch {
    return null
  }
}

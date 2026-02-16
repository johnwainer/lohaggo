import crypto from 'crypto'
import { env } from '@/lib/env'

function getKey() {
  const base = env.SECURITY_INTERNAL_TOKEN || env.NEXTAUTH_SECRET || ''
  if (!base) {
    throw new Error('Missing encryption base secret')
  }
  return crypto.createHash('sha256').update(base).digest()
}

export function encryptConfig(payload: unknown): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptConfig<T>(blob: string): T {
  const [ivB64, tagB64, dataB64] = blob.split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload')
  }
  const key = getKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8')) as T
}

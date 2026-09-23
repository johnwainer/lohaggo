import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Documents (PDF/Office/TXT/CSV) live in Supabase Storage: Cloudinary blocks PDF/ZIP delivery
 * on this account (401 "deny or ACL failure"), so Twilio/Meta could not download them.
 * Public bucket + unguessable path: Twilio and Meta need a URL they can fetch without auth.
 */
export const INBOX_BUCKET = 'inbox-attachments'

function supabaseBaseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
}

export function inboxBucketPublicPrefix() {
  const base = supabaseBaseUrl()
  return base ? `${base}/storage/v1/object/public/${INBOX_BUCKET}/` : null
}

export function isInboxBucketUrl(url: string) {
  const prefix = inboxBucketPublicPrefix()
  if (!prefix || !url.startsWith(prefix)) return false
  // No path traversal / query tricks
  return !url.slice(prefix.length).includes('..') && !url.includes('?')
}

let bucketReady = false
async function ensureBucket() {
  if (bucketReady) return
  const admin = getSupabaseAdmin()
  if (!admin) throw new Error('Supabase Storage no está configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  const { data } = await admin.storage.getBucket(INBOX_BUCKET)
  if (!data) {
    const { error } = await admin.storage.createBucket(INBOX_BUCKET, { public: true, fileSizeLimit: '5MB' })
    if (error && !/already exists/i.test(error.message)) throw new Error(`No se pudo crear el bucket: ${error.message}`)
  }
  bucketReady = true
}

export async function uploadInboxDocument(params: { buffer: Buffer; mime: string; name: string; workspaceId: string }) {
  await ensureBucket()
  const admin = getSupabaseAdmin()!
  const path = `${params.workspaceId}/${randomUUID()}/${params.name}`
  const { error } = await admin.storage.from(INBOX_BUCKET).upload(path, params.buffer, {
    contentType: params.mime,
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Error subiendo a Storage: ${error.message}`)
  const { data } = admin.storage.from(INBOX_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

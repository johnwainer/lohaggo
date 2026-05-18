/**
 * Idempotent schema patches — runs on every build via `npm run build`.
 * Uses direct SQL so it works on Supabase without full introspection.
 */
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SQL = `
ALTER TABLE "MagicToken" ADD COLUMN IF NOT EXISTS "requirePasswordChange" BOOLEAN NOT NULL DEFAULT false;
`.trim()

const tmp = join(__dirname, '_patch.tmp.sql')
writeFileSync(tmp, SQL)

try {
  execSync(`npx prisma db execute --file "${tmp}"`, { stdio: 'inherit' })
} finally {
  unlinkSync(tmp)
}

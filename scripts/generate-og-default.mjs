// Genera public/og-default.png (1200x630): imagen por defecto al compartir cualquier página de LoHaggo.
// Uso: node scripts/generate-og-default.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = 1200
const H = 630

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4c1d95"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1060" cy="90" r="210" fill="#f97316" opacity="0.22"/>
  <circle cx="1120" cy="560" r="150" fill="#f97316" opacity="0.18"/>
  <text x="80" y="330" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="800" fill="#ffffff">LoHaggo</text>
  <text x="84" y="420" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="600" fill="#fed7aa">Servicios profesionales a domicilio</text>
  <text x="84" y="486" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#ede9fe">Profesionales verificados en Medellín</text>
  <rect x="84" y="540" width="260" height="8" rx="4" fill="#f97316"/>
</svg>`

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(root, 'public', 'og-default.png'))
console.log('public/og-default.png listo')

import { getPriceIndexSafe } from '@/lib/seo/data'
import { indexCsv } from '@/lib/seo/price-index-core'

export const revalidate = 86400

export async function GET() {
  const idx = await getPriceIndexSafe()
  if (!idx) return new Response('Índice no disponible', { status: 503 })
  return new Response(indexCsv(idx), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="indice-precios-hogar-lohaggo.csv"',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

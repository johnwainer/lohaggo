import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { RemoteImage } from '@/components/ui/RemoteImage'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'LoHaggo en Instagram – Pide por WhatsApp',
  description: 'Las publicaciones recientes de LoHaggo: toca la que viste y escríbenos por WhatsApp para pedir el servicio.',
  robots: { index: false, follow: true },
}

/** The latest Instagram posts (no stories: they expire) with their first image. */
async function recentPosts() {
  const pubs = await prisma.marketingPublication.findMany({
    where: { channel: 'INSTAGRAM', status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: { postId: true, variantId: true },
    take: 40,
  })
  const stories = new Set((await prisma.marketingPostVariant.findMany({ where: { id: { in: pubs.map((p) => p.variantId) }, format: 'story' }, select: { id: true } })).map((v) => v.id))
  const ids = Array.from(new Set(pubs.filter((p) => !stories.has(p.variantId)).map((p) => p.postId))).slice(0, 12)
  if (!ids.length) return []
  const posts = await prisma.marketingPost.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, media: { where: { kind: 'image' }, orderBy: { position: 'asc' }, take: 1, select: { url: true, alt: true } } },
  })
  return ids.map((id) => posts.find((p) => p.id === id)).filter((p): p is (typeof posts)[number] => Boolean(p))
}

/**
 * «Link en la bio» of Instagram: each recent post with its own WhatsApp button (`/w/post-<id>`), so the chat
 * it opens, and any request it ends in, is credited to that post. Put lohaggo.com/ig in the profile's bio.
 */
export default async function InstagramLinksPage() {
  const posts = await recentPosts().catch(() => [])
  const site = '/servicios?utm_source=instagram&utm_medium=social&utm_campaign=bio'
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <header className="space-y-3 text-center">
          <h1 className="text-2xl font-bold text-gray-900">¿Viste algo que necesitas?</h1>
          <p className="text-sm text-gray-600">Toca la publicación que viste y escríbenos por WhatsApp: te ayudamos a pedir el servicio.</p>
          <a href="/w/web-ig" className="flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700">
            <MessageCircle size={18} /> Escríbenos por WhatsApp
          </a>
          <Link href={site} className="block text-sm font-medium text-primary-700">Ver todos los servicios</Link>
        </header>
        {posts.length > 0 && (
          <ul className="grid grid-cols-2 gap-3">
            {posts.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <a href={`/w/post-${p.id}`} className="block">
                  <div className="relative aspect-[4/5] bg-gray-100">
                    {p.media[0] && <RemoteImage src={p.media[0].url} alt={p.media[0].alt || p.title} fill sizes="(max-width: 448px) 50vw, 220px" className="object-cover" />}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-xs font-medium text-gray-800">{p.title}</p>
                    <span className="flex items-center justify-center gap-1 rounded-full bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-700"><MessageCircle size={13} /> Pedir por WhatsApp</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

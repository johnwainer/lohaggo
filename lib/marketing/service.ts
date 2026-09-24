import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateVariant, type MarketingChannel, type MediaInfo } from '@/lib/marketing/channel-rules'
import { latestSnapshots } from '@/lib/marketing/metrics'
import { BLOG_PATH } from '@/lib/marketing/seo'
import type { VariantPatch } from '@/lib/marketing/input'

export const mediaFolder = (workspaceId: string, postId: string) => `lohaggo/marketing/${workspaceId}/${postId}`

const detailInclude = {
  variants: { orderBy: { channel: 'asc' as const } },
  media: { orderBy: { position: 'asc' as const } },
  campaign: { select: { id: true, name: true, color: true } },
  publications: {
    where: { status: { not: 'cancelled' } },
    orderBy: { createdAt: 'desc' as const },
    include: { connection: { select: { id: true, name: true, channel: true } } },
  },
} satisfies Prisma.MarketingPostInclude

export type PostDetail = NonNullable<Awaited<ReturnType<typeof loadPostDetail>>>

/** Post with everything the editor shows: variants + their live validation, media, per-channel sends with latest metrics. */
export async function loadPostDetail(id: string) {
  const post = await prisma.marketingPost.findUnique({ where: { id }, include: detailInclude })
  if (!post) return null
  const snaps = await latestSnapshots(post.publications.map((p) => p.id))
  const views = await prisma.webPageView.groupBy({ by: ['variantId'], where: { variantId: { in: post.variants.map((v) => v.id) } }, _sum: { views: true } })
  const byId = new Map(post.media.map((m) => [m.id, m]))
  const info = (m: (typeof post.media)[number]): MediaInfo => ({ kind: m.kind === 'video' ? 'video' : 'image', mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, durationSec: m.durationSec })
  return {
    ...post,
    variants: post.variants.map((v) => {
      const media = (v.mediaIds.length ? v.mediaIds.map((i) => byId.get(i)).filter((m): m is (typeof post.media)[number] => Boolean(m)) : post.media).map(info)
      return {
        ...v,
        webViews: views.find((x) => x.variantId === v.id)?._sum.views ?? 0,
        validation: validateVariant(v.channel as MarketingChannel, {
          body: v.body, format: v.format, linkUrl: v.linkUrl, media, title: post.title, slug: v.slug, seoTitle: v.seoTitle, seoDescription: v.seoDescription, coverUrl: v.coverUrl,
        }),
      }
    }),
    publications: post.publications.map((p) => ({ ...p, metrics: snaps.get(p.id) ?? null })),
  }
}

/**
 * Upserts the channel variants. Changing the slug of a published article leaves a 301 from the old
 * URL so links and Google's index keep working.
 */
export async function saveVariants(postId: string, patches: VariantPatch[]) {
  for (const patch of patches) {
    const { channel, ...data } = patch
    const existing = await prisma.marketingPostVariant.findUnique({ where: { postId_channel: { postId, channel } } })
    if (channel === 'WEB' && typeof data.slug === 'string') {
      const taken = async (slug: string) => Boolean(await prisma.marketingPostVariant.findFirst({ where: { slug, NOT: { postId } }, select: { id: true } }))
      if (await taken(data.slug)) {
        // A live article keeps its address (the person must pick another); a draft just gets a free one
        if (existing?.webPublishedAt) throw new Error(`La URL /blog/${data.slug} ya la usa otro artículo`)
        let n = 2
        while (await taken(`${data.slug}-${n}`) && n < 50) n++
        data.slug = `${data.slug}-${n}`
      }
      if (existing?.slug && existing.slug !== data.slug && existing.webPublishedAt) {
        const from = `${BLOG_PATH}/${existing.slug}`
        const to = `${BLOG_PATH}/${data.slug}`
        await prisma.webRedirect.upsert({ where: { fromPath: from }, create: { fromPath: from, toPath: to }, update: { toPath: to } })
        // Chains: older redirects to the previous slug now point straight to the new one
        await prisma.webRedirect.updateMany({ where: { toPath: from }, data: { toPath: to } })
        await prisma.webRedirect.deleteMany({ where: { fromPath: to } })
      }
    }
    if (existing) await prisma.marketingPostVariant.update({ where: { id: existing.id }, data: data as Prisma.MarketingPostVariantUpdateInput })
    else await prisma.marketingPostVariant.create({ data: { ...(data as object), postId, channel } as Prisma.MarketingPostVariantUncheckedCreateInput })
  }
}

/** Social accounts of a workspace, with their token state, for the channel picker. */
export async function workspaceAccounts(workspaceId: string | null) {
  const conns = await prisma.channelConnection.findMany({
    where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] }, ...(workspaceId ? { workspaceId } : {}) },
    select: { id: true, name: true, channel: true, workspaceId: true, enabled: true, status: true, lastError: true, capabilities: true, meta: true },
    orderBy: [{ channel: 'asc' }, { name: 'asc' }],
  })
  return conns.map((c) => {
    const health = (c.capabilities as { tokenHealth?: { valid?: boolean; error?: string | null; checkedAt?: string; kind?: string; userTokenExpiresAt?: string | null } } | null)?.tokenHealth ?? null
    return {
      id: c.id, name: c.name, workspaceId: c.workspaceId, enabled: c.enabled,
      channel: c.channel === 'MESSENGER' ? 'FACEBOOK' as const : 'INSTAGRAM' as const,
      ok: c.enabled && c.status !== 'ERROR' && health?.valid !== false,
      problem: !c.enabled ? 'Cuenta pausada en Admin → Canales' : health?.valid === false ? health.error ?? 'Token inválido' : c.status === 'ERROR' ? c.lastError ?? 'Error en la cuenta' : null,
      tokenKind: health?.kind ?? ((c.meta as { tokenKind?: string } | null)?.tokenKind ?? null),
      tokenCheckedAt: health?.checkedAt ?? null,
      userTokenExpiresAt: health?.userTokenExpiresAt ?? null,
    }
  })
}

/**
 * Approval covers what was approved. Someone who cannot publish changing text or media of an
 * approved or scheduled post sends it back to review and takes it out of the queue.
 */
export async function reopenReviewIfNeeded(postId: string, canPublish: boolean) {
  if (canPublish) return false
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { status: true } })
  if (!post || !['approved', 'scheduled'].includes(post.status)) return false
  await prisma.marketingPublication.updateMany({ where: { postId, status: 'scheduled' }, data: { status: 'cancelled', lastError: 'Cambió después de aprobada: vuelve a revisión' } })
  await prisma.marketingPost.update({ where: { id: postId }, data: { status: 'review', approvedById: null, approvedAt: null } })
  return true
}

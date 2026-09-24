import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { fetchPostInfo } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, requireMetaApp } from '@/lib/messaging/meta-channels'
import { baseChannelOf, isCommentChannel } from '@/lib/ai/comments-core'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const isMetaCdn = (url: string) => {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && /(^|\.)(fbcdn\.net|cdninstagram\.com)$/i.test(hostname)
  } catch {
    return false
  }
}

const fetchImage = (url: string) => fetch(url, { cache: 'no-store' }).catch(() => null)

/**
 * Image of the post a comment conversation is about. Meta's CDN refuses to be embedded from another
 * site (503 in the browser) and its signed URLs expire, so the server fetches it and, when the stored
 * URL no longer works, asks Graph for a fresh one.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return new NextResponse('Unauthorized', { status: 401 })
  const { id } = await context.params

  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { connection: true } })
  if (!conversation || !isCommentChannel(conversation.channel)) return new NextResponse('Not found', { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return new NextResponse('Not found', { status: 404 })

  let res = conversation.postMediaUrl && isMetaCdn(conversation.postMediaUrl) ? await fetchImage(conversation.postMediaUrl) : null
  if ((!res || !res.ok) && conversation.postId && conversation.connection) {
    const token = getConnectionCredentials(conversation.connection)?.pageAccessToken
    const fresh = token
      ? await fetchPostInfo(await requireMetaApp(), token, baseChannelOf(conversation.channel), conversation.postId).catch(() => null)
      : null
    if (fresh?.mediaUrl && isMetaCdn(fresh.mediaUrl)) {
      await prisma.conversation.updateMany({ where: { postId: conversation.postId }, data: { postMediaUrl: fresh.mediaUrl } })
      res = await fetchImage(fresh.mediaUrl)
    }
  }
  if (!res || !res.ok) return new NextResponse('Image unavailable', { status: 404 })

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) return new NextResponse('Not an image', { status: 415 })
  return new NextResponse(res.body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' } })
}

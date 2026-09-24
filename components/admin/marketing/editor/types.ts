import type { MkChannel } from '@/components/admin/marketing/shared'

export type Issue = { code: string; message: string; field?: string }
export type Validation = { ok: boolean; errors: Issue[]; warnings: Issue[]; stats: { chars: number; hashtags: number; mentions: number; words: number } }

export type Media = { id: string; url: string; publicId: string | null; kind: 'image' | 'video'; mime: string | null; bytes: number | null; width: number | null; height: number | null; durationSec: number | null; alt: string | null; position: number; source?: string; credit?: string | null; creditUrl?: string | null; originalUrl?: string | null; branded?: boolean }

export type Variant = {
  id: string
  channel: MkChannel
  body: string
  format: string | null
  linkUrl: string | null
  mediaIds: string[]
  slug: string | null
  seoTitle: string | null
  seoDescription: string | null
  excerpt: string | null
  coverUrl: string | null
  category: string | null
  tags: string[]
  canonicalUrl: string | null
  noindex: boolean
  webPublishedAt: string | null
  aiGenerated: boolean
  webViews?: number
  validation?: Validation
}

export type Snapshot = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; capturedAt: string }

export type Publication = {
  id: string
  channel: MkChannel
  status: string
  scheduledAt: string
  publishedAt: string | null
  permalink: string | null
  lastError: string | null
  attempts: number
  connection: { id: string; name: string; channel: string } | null
  metrics: Snapshot | null
}

export type Post = {
  id: string
  workspaceId: string
  title: string
  brief: string | null
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  campaignId: string | null
  campaign: { id: string; name: string; color: string } | null
  variants: Variant[]
  media: Media[]
  publications: Publication[]
  updatedAt: string
}

/**
 * Parses the `changes` of a Meta webhook entry into comment events. Pure: no DB, no API.
 * Facebook Page: field "feed" with item "comment". Instagram: fields "comments" and "mentions".
 */

export type CommentEvent = {
  kind: 'comment' | 'mention'
  verb: 'add' | 'edited' | 'remove' | 'hide' | 'unhide'
  commentId: string
  postId: string | null
  parentId: string | null
  fromId: string | null
  fromName: string | null
  text: string
  createdAt: Date | null
  /** Known from the payload itself; null = ask Graph */
  isAd: boolean | null
  permalink: string | null
}

export type ParsedChanges = { events: CommentEvent[]; ignored: string[] }

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)

function fbTime(v: unknown) {
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v)
  if (typeof v === 'string' && v) {
    const d = new Date(/^\d+$/.test(v) ? Number(v) * 1000 : v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const FB_VERBS = new Set(['add', 'edited', 'remove', 'hide', 'unhide'])

function parseFacebook(change: Obj): CommentEvent | string {
  if (change.field !== 'feed') return `feed:${String(change.field || 'unknown')}`
  const v = obj(change.value)
  if (v.item !== 'comment') return `feed:${String(v.item || 'unknown')}`
  const verb = String(v.verb || 'add')
  if (!FB_VERBS.has(verb)) return `comment:${verb}`
  const commentId = str(v.comment_id)
  if (!commentId) return 'comment:sin_id'
  const post = obj(v.post)
  const from = obj(v.from)
  const promotion = str(post.promotion_status)
  return {
    kind: 'comment',
    verb: verb as CommentEvent['verb'],
    commentId,
    postId: str(v.post_id) || str(post.id),
    parentId: str(v.parent_id),
    fromId: str(from.id),
    fromName: str(from.name),
    text: typeof v.message === 'string' ? v.message : '',
    createdAt: fbTime(v.created_time),
    isAd: post.is_published === false || promotion === 'active' ? true : null,
    permalink: str(post.permalink_url),
  }
}

function parseInstagram(change: Obj): CommentEvent | string {
  const v = obj(change.value)
  if (change.field === 'mentions') {
    const commentId = str(v.comment_id)
    if (!commentId) return 'mention:sin_comentario'
    return {
      kind: 'mention', verb: 'add', commentId, postId: str(v.media_id), parentId: null, fromId: null, fromName: null,
      text: '', createdAt: null, isAd: false, permalink: null,
    }
  }
  if (change.field !== 'comments') return `instagram:${String(change.field || 'unknown')}`
  const commentId = str(v.id)
  if (!commentId) return 'comment:sin_id'
  const media = obj(v.media)
  const from = obj(v.from)
  const username = str(from.username)
  return {
    kind: 'comment',
    verb: 'add',
    commentId,
    postId: str(media.id),
    parentId: str(v.parent_id),
    fromId: str(from.id),
    fromName: username ? `@${username}` : null,
    text: typeof v.text === 'string' ? v.text : '',
    createdAt: null,
    // Comments on ads carry the ad id; everything else is resolved by asking for the media
    isAd: str(media.ad_id) || media.media_product_type === 'AD' ? true : null,
    permalink: null,
  }
}

export function parseCommentChanges(channel: 'MESSENGER' | 'INSTAGRAM', changes: unknown[] | undefined): ParsedChanges {
  const events: CommentEvent[] = []
  const ignored: string[] = []
  for (const raw of changes || []) {
    const parsed = channel === 'INSTAGRAM' ? parseInstagram(obj(raw)) : parseFacebook(obj(raw))
    if (typeof parsed === 'string') ignored.push(parsed)
    else events.push(parsed)
  }
  return { events, ignored }
}

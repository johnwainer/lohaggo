import { describe, expect, it } from 'vitest'
import {
  PRIVATE_REPLY_WINDOW_MS,
  canModerate,
  commentLimitReached,
  commentPrefilter,
  commentSettingsOf,
  fillTemplate,
  isOwnComment,
  isTagOnly,
  missingScopes,
  planCommentReply,
  privateReplyAvailability,
  replyModeFor,
  requiredCommentScopes,
  splitCommentSuggestion,
  splitPublicPrivate,
  type CommentSignals,
} from '@/lib/ai/comments-core'
import { parseMarkers } from '@/lib/ai/format'
import { shouldTakeOverCore, type AgentLike, type TakeOverConversation } from '@/lib/ai/runtime-core'
import { copilotAgentFor, type CopilotAgentLike } from '@/lib/ai/copilot-core'
import { parseCommentChanges } from '@/lib/messaging/comment-events'
import { buildSystem } from '@/lib/ai/prompt'

const filterAgent = (over: Partial<Parameters<typeof commentPrefilter>[0]> = {}) => ({
  commentNeverKeywords: [] as string[], commentAlwaysKeywords: [] as string[], commentIgnoreTagOnly: true, commentScope: 'intent', ...over,
})

describe('filtro previo (sin gastar llamada)', () => {
  it('palabra para no responder → ignora', () => {
    expect(commentPrefilter(filterAgent({ commentNeverKeywords: ['sorteo'] }), 'Quiero participar en el sorteo')).toEqual({ action: 'ignore', reason: 'never_keyword', detail: 'sorteo' })
  })
  it('palabra para responder siempre → responde', () => {
    expect(commentPrefilter(filterAgent({ commentAlwaysKeywords: ['precio'] }), '¿Qué PRECIO tiene?')).toMatchObject({ action: 'answer', reason: 'always_keyword' })
  })
  it('solo etiquetas a otras personas → ignora', () => {
    expect(commentPrefilter(filterAgent(), '@ana.perez @luis_2 👀🔥')).toEqual({ action: 'ignore', reason: 'tag_only' })
    expect(commentPrefilter(filterAgent({ commentIgnoreTagOnly: false }), '@ana.perez @luis_2')).toEqual({ action: 'model' })
  })
  it('una etiqueta con una pregunta no es "solo etiqueta"', () => {
    expect(isTagOnly('@ana ¿esto sirve para baños?')).toBe(false)
    expect(isTagOnly('sin menciones')).toBe(false)
  })
  it('alcance "todos" → responde; "intención" → decide el modelo', () => {
    expect(commentPrefilter(filterAgent({ commentScope: 'all' }), 'Qué lindo')).toEqual({ action: 'answer', reason: 'scope_all' })
    expect(commentPrefilter(filterAgent(), 'Qué lindo')).toEqual({ action: 'model' })
  })
  it('comentario vacío → ignora', () => {
    expect(commentPrefilter(filterAgent({ commentScope: 'all' }), '   ')).toEqual({ action: 'ignore', reason: 'empty' })
  })
  it('precedencia: nunca > siempre > etiquetas > alcance', () => {
    const a = filterAgent({ commentNeverKeywords: ['gratis'], commentAlwaysKeywords: ['precio'], commentScope: 'all' })
    expect(commentPrefilter(a, 'precio gratis?').action).toBe('ignore')
    expect(commentPrefilter(filterAgent({ commentAlwaysKeywords: ['info'] }), '@ana info').action).toBe('answer')
    expect(commentPrefilter(filterAgent({ commentScope: 'all' }), '@ana @luis')).toMatchObject({ action: 'ignore', reason: 'tag_only' })
  })
})

describe('marcas del modelo', () => {
  it('extrae [[IGNORAR]], [[SENSIBLE]] y [[OFENSIVO]] junto con las existentes', () => {
    const m = parseMarkers('Hola [[SENSIBLE]] [[PRIVADO]] Te escribo [[HANDOFF]] [[IGNORAR]] [[OFENSIVO]] [[SPAM]] [[DONE]]')
    expect(m).toMatchObject({ handoff: true, done: true, spam: true, ignore: true, sensitive: true, offensive: true })
    expect(m.text).not.toMatch(/HANDOFF|SENSIBLE|IGNORAR|OFENSIVO|SPAM|DONE/)
    // [[PRIVADO]] separates the two texts, so it survives parseMarkers
    expect(m.text).toContain('[[PRIVADO]]')
  })
  it('separa público y privado', () => {
    expect(splitPublicPrivate('¡Hola! Te escribimos por privado.\n[[ privado ]]\nEl precio es 80.000.')).toEqual({
      publicText: '¡Hola! Te escribimos por privado.', privateText: 'El precio es 80.000.',
    })
    expect(splitPublicPrivate('Solo público')).toEqual({ publicText: 'Solo público', privateText: '' })
    expect(splitPublicPrivate('[[PRIVADO]] Solo privado')).toEqual({ publicText: '', privateText: 'Solo privado' })
  })
  it('sugerencia del copiloto: público, privado y nota en cualquier orden', () => {
    expect(splitCommentSuggestion('Hola [[PRIVADO]] Detalle [[CONTEXTO]] Tiene una reserva')).toEqual({ publicText: 'Hola', privateText: 'Detalle', context: 'Tiene una reserva' })
    expect(splitCommentSuggestion('Hola [[CONTEXTO]] Ojo con esto [[PRIVADO]] Detalle')).toEqual({ publicText: 'Hola', privateText: 'Detalle', context: 'Ojo con esto' })
  })
  it('plantilla con {nombre}', () => {
    expect(fillTemplate('¡Hola {nombre}! Te escribimos por privado', 'Ana Pérez')).toBe('¡Hola Ana! Te escribimos por privado')
    expect(fillTemplate('{nombre}, te escribimos por privado', '@ana.perez')).toBe('Ana.perez, te escribimos por privado')
    expect(fillTemplate('{nombre}, te escribimos por privado', null)).toBe('Te escribimos por privado')
  })
})

let seq = 0
function agent(over: Partial<CopilotAgentLike> = {}): CopilotAgentLike {
  seq++
  return {
    id: `a${seq}`, name: `A${seq}`, status: 'active', createdAt: new Date(2026, 0, seq), isDefault: false, channels: ['WHATSAPP'],
    autopilot: false, autopilotChannels: [], autopilotAccounts: [], autopilotSkipTags: [], handoffKeywords: [], handoffAfterTurns: 0,
    hoursEnabled: false, hoursTimezone: null, hoursDays: [1, 2, 3, 4, 5], hoursStart: '08:00', hoursEnd: '18:00', outsideHours: 'notice',
    outsideHoursMessage: null, memoryWindow: 20,
    copilotChannels: [], copilotSuggest: 'auto', copilotTakeover: true, copilotTakeoverMinutes: 10, copilotWarnMinutes: 2,
    commentChannels: [], commentCopilotChannels: [], commentAccounts: [],
    ...over,
  }
}
const conv = (over: Partial<TakeOverConversation> = {}): TakeOverConversation => ({
  channel: 'FACEBOOK_COMMENT', connectionId: 'c1', connectionExternalId: '877082332165769', isTest: false, assignedToId: null, automationsPaused: false,
  aiSpam: false, threadOwner: null, tags: [], aiAgentId: null, aiHandoffAt: null, ...over,
})
const take = (agents: AgentLike[], c = conv()) => shouldTakeOverCore(c, { agents, recentHumanActivity: false })

describe('qué agente atiende los comentarios', () => {
  it('piloto: lo decide commentChannels, no el piloto de mensajes', () => {
    const a = agent({ commentChannels: ['FACEBOOK_COMMENT'] })
    expect(take([a])).toMatchObject({ take: true, agent: { id: a.id } })
    // Autopilot on Messenger does not mean it answers comments of that page
    expect(take([agent({ autopilot: true, autopilotChannels: ['MESSENGER'], channels: ['MESSENGER'] })])).toEqual({ take: false, reason: 'no_agent' })
    expect(take([agent({ commentChannels: ['INSTAGRAM_COMMENT'] })])).toEqual({ take: false, reason: 'no_agent' })
  })
  it('"canales que atiende" (mensajes) no bloquea los comentarios', () => {
    expect(take([agent({ channels: ['WHATSAPP'], commentChannels: ['FACEBOOK_COMMENT'] })]).take).toBe(true)
  })
  it('cuentas de comentarios aparte de las de mensajes', () => {
    const only = agent({ commentChannels: ['FACEBOOK_COMMENT'], commentAccounts: ['FACEBOOK_COMMENT:218019538745380'] })
    expect(take([only])).toEqual({ take: false, reason: 'account_not_enabled' })
    const mine = agent({ commentChannels: ['FACEBOOK_COMMENT'], commentAccounts: ['FACEBOOK_COMMENT:877082332165769'], autopilotAccounts: ['WHATSAPP:default'] })
    expect(take([mine]).take).toBe(true)
  })
  it('copiloto: el agente con el canal de comentarios en copiloto', () => {
    const c = agent({ commentCopilotChannels: ['INSTAGRAM_COMMENT'] })
    expect(copilotAgentFor([c], 'INSTAGRAM_COMMENT')?.id).toBe(c.id)
    expect(copilotAgentFor([agent({ copilotChannels: ['INSTAGRAM'] })], 'INSTAGRAM_COMMENT')).toBeNull()
    // Not on autopilot: the AI does not answer alone
    expect(take([c], conv({ channel: 'INSTAGRAM_COMMENT' }))).toEqual({ take: false, reason: 'no_agent' })
    // Handed to the AI (person or takeover): the copilot agent answers it
    expect(take([c], conv({ channel: 'INSTAGRAM_COMMENT', aiHandled: true, aiAgentId: c.id })).take).toBe(true)
  })
  it('cuando un canal tiene piloto y copiloto, manda el piloto', () => {
    const both = agent({ commentChannels: ['FACEBOOK_COMMENT'], commentCopilotChannels: ['FACEBOOK_COMMENT'] })
    expect(take([both])).toMatchObject({ take: true, agent: { id: both.id } })
  })
})

describe('respuesta privada', () => {
  const now = new Date('2026-09-24T15:00:00Z')
  const target = { commentId: 'c1', sentAt: new Date(now.getTime() - 60_000) }
  it('una sola vez por comentario', () => {
    expect(privateReplyAvailability(target, [], now).ok).toBe(true)
    expect(privateReplyAvailability(target, ['c1'], now)).toMatchObject({ ok: false })
    // A newer comment of the same person can get its own private reply
    expect(privateReplyAvailability({ ...target, commentId: 'c2' }, ['c1'], now).ok).toBe(true)
  })
  it('solo dentro de 7 días', () => {
    const old = { commentId: 'c1', sentAt: new Date(now.getTime() - PRIVATE_REPLY_WINDOW_MS - 1) }
    expect(privateReplyAvailability(old, [], now)).toMatchObject({ ok: false })
    const edge = { commentId: 'c1', sentAt: new Date(now.getTime() - PRIVATE_REPLY_WINDOW_MS) }
    expect(privateReplyAvailability(edge, [], now).ok).toBe(true)
  })
  it('nunca en menciones ni sin comentario', () => {
    expect(privateReplyAvailability(target, [], now, 'mention').ok).toBe(false)
    expect(privateReplyAvailability(null, [], now).ok).toBe(false)
  })
})

describe('límites', () => {
  const a = { commentMaxPerPostPerHour: 3, commentMaxPerAccountPerDay: 10 }
  it('por publicación y hora', () => {
    expect(commentLimitReached(a, { postLastHour: 2, accountLastDay: 2 }).reached).toBe(false)
    expect(commentLimitReached(a, { postLastHour: 3, accountLastDay: 3 }).reached).toBe(true)
  })
  it('por cuenta y día', () => {
    expect(commentLimitReached(a, { postLastHour: 0, accountLastDay: 10 })).toMatchObject({ reached: true })
  })
})

describe('nunca contesta sus propios comentarios', () => {
  it('compara con la página y con la cuenta', () => {
    expect(isOwnComment('877082332165769', ['17841407143223615', '877082332165769'])).toBe(true)
    expect(isOwnComment('24242424242', ['17841407143223615', '877082332165769'])).toBe(false)
    expect(isOwnComment(null, ['877082332165769'])).toBe(false)
  })
})

const signals = (over: Partial<CommentSignals> = {}): CommentSignals => ({ text: '', handoff: false, sensitive: false, ignore: false, offensive: false, spam: false, ...over })
const plan = (over: Partial<Parameters<typeof planCommentReply>[0]> = {}) => planCommentReply({
  signals: signals(), mode: 'public_and_private', sensitiveAction: 'private_and_handoff', template: null, contactName: 'Ana Pérez',
  hideOffensive: false, hideSpam: false, canHide: true, privateAvailable: true, forced: false, ...over,
})

describe('plan de respuesta', () => {
  it('público breve y detalle por privado', () => {
    expect(plan({ signals: signals({ text: '¡Claro! Te escribimos por privado. [[PRIVADO]] La limpieza cuesta 80.000.' }) })).toMatchObject({
      outcome: 'reply', publicText: '¡Claro! Te escribimos por privado.', privateText: 'La limpieza cuesta 80.000.', handoff: false,
    })
  })
  it('el texto público fijo reemplaza al del modelo', () => {
    expect(plan({ template: '¡Hola {nombre}! Te escribimos 🙌', signals: signals({ text: 'Otra cosa [[PRIVADO]] Detalle' }) })).toMatchObject({ publicText: '¡Hola Ana! Te escribimos 🙌', privateText: 'Detalle' })
  })
  it('sin respuesta privada disponible, solo público', () => {
    expect(plan({ privateAvailable: false, signals: signals({ text: 'Hola [[PRIVADO]] Detalle' }) })).toMatchObject({ publicText: 'Hola', privateText: null })
  })
  it('solo público y solo privado', () => {
    expect(plan({ mode: 'public_only', signals: signals({ text: 'Hola, sí lo hacemos' }) })).toMatchObject({ publicText: 'Hola, sí lo hacemos', privateText: null })
    expect(plan({ mode: 'private_only', signals: signals({ text: '[[PRIVADO]] Detalle' }) })).toMatchObject({ publicText: null, privateText: 'Detalle' })
    expect(plan({ mode: 'private_only', template: '👍', signals: signals({ text: '[[PRIVADO]] Detalle' }) })).toMatchObject({ publicText: '👍', privateText: 'Detalle' })
    expect(plan({ mode: 'private_only', privateAvailable: false, signals: signals({ text: '[[PRIVADO]] Detalle' }) })).toMatchObject({ outcome: 'handoff', handoff: true })
  })
  it('[[IGNORAR]] no responde, salvo que el filtro obligue', () => {
    expect(plan({ signals: signals({ ignore: true }) }).outcome).toBe('ignored')
    expect(plan({ forced: true, signals: signals({ ignore: true, text: 'Hola' }) }).outcome).toBe('reply')
  })
})

describe('temas sensibles: nunca contenido en público', () => {
  const detail = 'Tu reembolso de 120.000 por la reserva 4411 está en trámite.'
  const s = signals({ sensitive: true, text: `Te devolvemos el dinero de la reserva 4411 [[PRIVADO]] ${detail}` })
  it('privado breve y traspaso', () => {
    const p = plan({ signals: s })
    expect(p).toMatchObject({ outcome: 'reply', privateText: detail, handoff: true })
    expect(p.publicText).toBe('Ana, te escribimos por mensaje privado para ayudarte.')
    expect(p.publicText).not.toMatch(/4411|reembolso|dinero/)
  })
  it('solo privado', () => {
    expect(plan({ signals: s, sensitiveAction: 'private_only' })).toMatchObject({ privateText: detail, handoff: false })
  })
  it('solo traspaso', () => {
    expect(plan({ signals: s, sensitiveAction: 'handoff_only' })).toEqual({ outcome: 'handoff', publicText: null, privateText: null, hide: false, handoff: true, detail: 'Tema sensible' })
  })
  it('sin privado posible pasa a una persona sin publicar nada', () => {
    expect(plan({ signals: s, privateAvailable: false })).toMatchObject({ outcome: 'handoff', publicText: null, privateText: null })
  })
  it('en modo solo público tampoco publica el tema', () => {
    const p = plan({ signals: s, mode: 'public_only' })
    expect(p.publicText).toBeNull()
    expect(p.privateText).toBe(detail)
  })
  it('[[HANDOFF]] del modelo sigue la misma regla', () => {
    expect(plan({ signals: signals({ handoff: true, text: 'No sé, lo reviso' }) }).publicText).not.toContain('reviso')
  })
})

describe('datos consultados con herramientas: nunca en público', () => {
  const s = signals({ usedTools: true, text: 'Tu reserva 4411 es mañana a las 9 [[PRIVADO]] Tu reserva 4411 es mañana a las 9 con Pedro.' })
  it('lo que el modelo puso en público se descarta: acuse neutro y todo por privado', () => {
    const p = plan({ signals: s })
    expect(p.publicText).toBe('Ana, te escribimos por mensaje privado para ayudarte.')
    expect(p.privateText).toContain('Pedro')
  })
  it('aunque el modo sea solo público', () => {
    const p = plan({ signals: s, mode: 'public_only' })
    expect(p.publicText).not.toContain('4411')
  })
  it('sin privado posible pasa a una persona', () => {
    expect(plan({ signals: s, privateAvailable: false })).toMatchObject({ outcome: 'handoff', publicText: null, privateText: null })
  })
})

describe('moderación: solo oculta con la opción activa', () => {
  it('ofensivo', () => {
    expect(plan({ signals: signals({ offensive: true }) })).toMatchObject({ outcome: 'moderation_noted', hide: false, publicText: null })
    expect(plan({ signals: signals({ offensive: true }), hideOffensive: true })).toMatchObject({ outcome: 'hidden', hide: true })
    expect(plan({ signals: signals({ offensive: true }), hideOffensive: true, canHide: false })).toMatchObject({ hide: false })
  })
  it('spam', () => {
    expect(plan({ signals: signals({ spam: true }) }).hide).toBe(false)
    expect(plan({ signals: signals({ spam: true }), hideSpam: true }).hide).toBe(true)
    expect(plan({ signals: signals({ spam: true }), hideOffensive: true }).hide).toBe(false)
  })
})

describe('configuración y permisos', () => {
  it('modo por canal, con valor por defecto', () => {
    expect(replyModeFor({ commentReplyMode: { INSTAGRAM_COMMENT: 'public_only' } }, 'INSTAGRAM_COMMENT')).toBe('public_only')
    expect(replyModeFor({ commentReplyMode: { INSTAGRAM_COMMENT: 'raro' } }, 'INSTAGRAM_COMMENT')).toBe('public_and_private')
    expect(replyModeFor({ commentReplyMode: null }, 'FACEBOOK_COMMENT')).toBe('public_and_private')
  })
  it('ajustes de la cuenta con valores por defecto', () => {
    expect(commentSettingsOf(null)).toEqual({ enabled: false, includeAds: true, mentions: false, grantedScopes: null, checkedAt: null })
  })
  it('permisos que faltan', () => {
    expect(requiredCommentScopes('MESSENGER', false)).toEqual(['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'])
    expect(requiredCommentScopes('INSTAGRAM', true)).toEqual(['instagram_manage_comments', 'instagram_manage_mentions'])
    expect(missingScopes(['a', 'b'], ['a'])).toEqual(['b'])
    expect(missingScopes(['a'], null)).toBeNull()
    expect(canModerate('MESSENGER', { grantedScopes: ['pages_read_engagement'] })).toBe(false)
    expect(canModerate('INSTAGRAM', { grantedScopes: null })).toBe(true)
  })
})

describe('prompt para comentarios', () => {
  const base = {
    name: 'Sofía', goal: '', instructions: '', tone: '', language: 'auto', handoffOnUnknown: true, ignoreSpam: true, signatureMode: 'off', signatureText: null,
  }
  const ctx = (comment: Parameters<typeof buildSystem>[1]['comment']) => buildSystem(base, {
    knowledge: { mode: 'none', chunks: [] } as never, nowText: 'hoy', timezone: 'America/Bogota', channel: 'INSTAGRAM_COMMENT',
    contact: { name: null, tags: [], fields: {}, linkedUser: false }, summary: null, toolGuidance: '', comment,
  })
  it('va en el bloque de contexto (sin caché) con la publicación y si es anuncio', () => {
    const blocks = ctx({ postCaption: 'Promo limpieza', isAd: true, isMention: false, replyMode: 'public_and_private', privateAvailable: true, forced: false, hasTemplate: false })
    const last = blocks[3].text
    expect(last).toContain('comentario público en Instagram')
    expect(last).toContain('«Promo limpieza»')
    expect(last).toContain('anuncio pagado')
    expect(last).toContain('[[IGNORAR]]')
    expect(last).toContain('[[PRIVADO]]')
    expect(blocks[1].text).not.toContain('[[IGNORAR]]')
  })
  it('obligado a responder: sin [[IGNORAR]]; sin privado: solo público', () => {
    const last = ctx({ postCaption: null, isAd: false, isMention: false, replyMode: 'public_and_private', privateAvailable: false, forced: true, hasTemplate: false })[3].text
    expect(last).toContain('no uses [[IGNORAR]]')
    expect(last).toContain('escribe solo la respuesta pública')
  })
})

// ─── Webhook payloads (shapes from Meta's Webhooks reference) ────────────────

const fbComment = (value: Record<string, unknown>) => ({ field: 'feed', value })
const FB_ADD = fbComment({
  from: { id: '24242424242', name: 'Ana Pérez' },
  post: { status_type: 'added_photos', is_published: true, updated_time: '2026-09-24T15:00:00+0000', permalink_url: 'https://www.facebook.com/lohaggo/posts/pfbid0abc', promotion_status: 'inactive', id: '877082332165769_111' },
  message: '¿Cuánto cuesta la limpieza de sofás?',
  post_id: '877082332165769_111',
  comment_id: '111_222',
  created_time: 1790262000,
  item: 'comment',
  parent_id: '877082332165769_111',
  verb: 'add',
})

describe('parser de webhooks', () => {
  it('Facebook feed: comentario nuevo', () => {
    const { events, ignored } = parseCommentChanges('MESSENGER', [FB_ADD])
    expect(ignored).toEqual([])
    expect(events[0]).toEqual({
      kind: 'comment', verb: 'add', commentId: '111_222', postId: '877082332165769_111', parentId: '877082332165769_111',
      fromId: '24242424242', fromName: 'Ana Pérez', text: '¿Cuánto cuesta la limpieza de sofás?', createdAt: new Date(1790262000 * 1000),
      isAd: null, permalink: 'https://www.facebook.com/lohaggo/posts/pfbid0abc',
    })
  })
  it('Facebook feed: comentario en un anuncio (publicación no publicada)', () => {
    const ad = fbComment({ ...(FB_ADD.value as object), post: { id: '877082332165769_999', is_published: false, promotion_status: 'active' }, post_id: '877082332165769_999' })
    expect(parseCommentChanges('MESSENGER', [ad]).events[0].isAd).toBe(true)
  })
  it('Facebook feed: comentario eliminado y editado', () => {
    const removed = fbComment({ item: 'comment', verb: 'remove', comment_id: '111_222', post_id: '877082332165769_111', from: { id: '24242424242' }, created_time: 1790262100 })
    const edited = fbComment({ ...(FB_ADD.value as object), verb: 'edited', message: 'Editado' })
    const { events } = parseCommentChanges('MESSENGER', [removed, edited])
    expect(events.map((e) => e.verb)).toEqual(['remove', 'edited'])
    expect(events[1].text).toBe('Editado')
  })
  it('Facebook feed: lo que no es un comentario se ignora', () => {
    const reaction = fbComment({ item: 'reaction', verb: 'add', reaction_type: 'like', post_id: '1_2', from: { id: '3' } })
    const status = fbComment({ item: 'status', verb: 'add', post_id: '1_2' })
    expect(parseCommentChanges('MESSENGER', [reaction, status, { field: 'ratings', value: {} }])).toEqual({ events: [], ignored: ['feed:reaction', 'feed:status', 'feed:ratings'] })
  })
  it('Instagram comments', () => {
    const change = { field: 'comments', value: { from: { id: '232323232', username: 'cliente.feliz' }, media: { id: '123123123', media_product_type: 'FEED' }, id: '17865799348089039', parent_id: '1231231234', text: '¿Hacen domicilios?' } }
    expect(parseCommentChanges('INSTAGRAM', [change]).events[0]).toMatchObject({
      kind: 'comment', commentId: '17865799348089039', postId: '123123123', fromId: '232323232', fromName: '@cliente.feliz', text: '¿Hacen domicilios?', isAd: null,
    })
  })
  it('Instagram comments en un anuncio', () => {
    const change = { field: 'comments', value: { from: { id: '1', username: 'x' }, media: { id: '555', ad_id: '120210000000', ad_title: 'Promo', original_media_id: '444', media_product_type: 'FEED' }, id: '9', text: 'Info' } }
    expect(parseCommentChanges('INSTAGRAM', [change]).events[0].isAd).toBe(true)
  })
  it('Instagram mentions', () => {
    const change = { field: 'mentions', value: { media_id: '17887498072083520', comment_id: '17887498072083521' } }
    expect(parseCommentChanges('INSTAGRAM', [change]).events[0]).toMatchObject({ kind: 'mention', commentId: '17887498072083521', postId: '17887498072083520', text: '' })
  })
})

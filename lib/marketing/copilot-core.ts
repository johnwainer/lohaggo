/**
 * Writing assistant for posts: prompts per action and channel, and parsing of the answer. Pure.
 */
import { LIMITS, type MarketingChannel } from '@/lib/marketing/channel-rules'

export const COPILOT_ACTIONS = ['draft', 'adapt', 'improve', 'ideas', 'hashtags', 'seo', 'images'] as const
export type CopilotAction = (typeof COPILOT_ACTIONS)[number]

export type CopilotRequest = {
  action: CopilotAction
  channel: MarketingChannel
  brief?: string
  /** Current text of the target channel (improve / hashtags) or of the source channel (adapt) */
  text?: string
  sourceChannel?: MarketingChannel
  /** Free instruction: "más corto", "más formal", "con llamada a la acción" */
  instruction?: string
  title?: string
  tone?: string
  /** The post's campaign: its objective and description frame every text */
  campaign?: { name: string; objective: string; description: string | null } | null
}

export type BrandContext = { brand: string; services: string[]; cities: string[]; siteUrl: string }

const CHANNEL_STYLE: Record<MarketingChannel, string> = {
  WEB: `Artículo de blog en Markdown para el sitio web: tono editorial, claro y útil; subtítulos con "## ", párrafos cortos, listas cuando ayuden, sin emojis ni hashtags. Entre 500 y 900 palabras salvo que se pida otra cosa. No repitas el título como encabezado: empieza con un párrafo de introducción. Termina con una llamada a la acción suave hacia LoHaggo.`,
  INSTAGRAM: `Texto para Instagram: visual y cercano, primera línea que enganche (se corta a ~125 caracteres), frases cortas con saltos de línea, emojis con moderación, una llamada a la acción y entre 5 y 12 hashtags relevantes al final (máximo ${LIMITS.INSTAGRAM.hashtags}). Máximo ${LIMITS.INSTAGRAM.caption} caracteres. Los enlaces no son clicables en Instagram: si hace falta, di "enlace en la bio".`,
  FACEBOOK: `Texto para Facebook: conversacional y directo, 1 a 3 párrafos cortos, pocos emojis, como mucho ${LIMITS.FACEBOOK.recommendedHashtags} hashtags, una llamada a la acción clara. Puede incluir un enlace.`,
}

const CHANNEL_NAME: Record<MarketingChannel, string> = { WEB: 'el blog del sitio web', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook' }

export function systemPrompt(ctx: BrandContext, tone?: string) {
  return [
    `Eres el redactor de marketing de ${ctx.brand}, una plataforma colombiana que conecta clientes con profesionales verificados de servicios para el hogar (${ctx.siteUrl}).`,
    ctx.services.length ? `Servicios que ofrece: ${ctx.services.slice(0, 40).join(', ')}.` : '',
    ctx.cities.length ? `Ciudades: ${ctx.cities.slice(0, 20).join(', ')}.` : '',
    `Escribe en español de Colombia, tratando al lector de tú.${tone?.trim() ? ` Tono pedido: ${tone.trim()}.` : ''}`,
    'No inventes precios, descuentos, cifras, testimonios ni promociones que no estén en el pedido. Si hace falta un dato que no tienes, escribe un marcador entre corchetes, por ejemplo [precio].',
    'Entrega solo el contenido pedido, sin explicaciones, sin comillas alrededor y sin prefacios como "Aquí tienes".',
  ].filter(Boolean).join('\n')
}

/** User message for each action. */
const OBJECTIVE_LABEL: Record<string, string> = { reach: 'alcance', traffic: 'tráfico al sitio web', leads: 'conseguir clientes potenciales', engagement: 'interacción', sales: 'solicitudes de servicio', brand: 'marca' }

export function userPrompt(r: CopilotRequest) {
  const style = CHANNEL_STYLE[r.channel]
  const extra = r.instruction?.trim() ? `\nIndicación adicional: ${r.instruction.trim()}` : ''
  const campaign = r.campaign
    ? `\nCampaña: ${r.campaign.name} (objetivo: ${OBJECTIVE_LABEL[r.campaign.objective] || r.campaign.objective}).${r.campaign.description?.trim() ? ` ${r.campaign.description.trim().slice(0, 1000)}` : ''}`
    : ''
  const title = `${r.title?.trim() ? `\nTítulo de la publicación: ${r.title.trim()}` : ''}${campaign}`
  switch (r.action) {
    case 'draft':
      return `Escribe una publicación para ${CHANNEL_NAME[r.channel]}.\n${style}${title}\nIdea o brief: ${r.brief?.trim() || '(sin brief: propón algo útil sobre los servicios)'}${extra}`
    case 'adapt':
      return `Adapta este contenido${r.sourceChannel ? ` publicado desde ${CHANNEL_NAME[r.sourceChannel]}` : ''} para ${CHANNEL_NAME[r.channel]}, conservando el mensaje pero con el estilo del canal.\n${style}${title}\n\nContenido original:\n${r.text || ''}${extra}`
    case 'improve':
      return `Mejora este texto para ${CHANNEL_NAME[r.channel]}.\n${style}${title}\n\nTexto actual:\n${r.text || ''}${extra || '\nIndicación adicional: hazlo más claro y atractivo.'}`
    case 'hashtags':
      return `Sugiere entre 8 y 15 hashtags para esta publicación de ${CHANNEL_NAME[r.channel]} (mezcla generales, de nicho y locales de Colombia). Responde solo con los hashtags separados por espacios.\n\nPublicación:\n${r.text || r.brief || ''}`
    case 'ideas':
      return `Propón 6 ideas de contenido para ${CHANNEL_NAME[r.channel]}${r.brief?.trim() ? ` sobre: ${r.brief.trim()}` : ''}. Responde solo con JSON: {"ideas":[{"title":"...","angle":"una frase con el enfoque","format":"${r.channel === 'INSTAGRAM' ? 'feed | reel | carousel' : r.channel === 'WEB' ? 'guía | lista | comparativa | caso' : 'texto | foto | video | enlace'}"}]}`
    case 'images':
      return `Propón imágenes para esta publicación de ${CHANNEL_NAME[r.channel]}. Responde solo con JSON: {"queries":["3 a 5 búsquedas cortas EN INGLÉS para un banco de fotos (2 a 4 palabras cada una, concretas y visuales, p. ej. \"plumber fixing sink\")"],"prompt":"en español, una descripción visual de 1 a 3 frases para generar la imagen con IA: escena, sujeto, encuadre, luz y ambiente; sin textos ni logos en la imagen","alt":"texto alternativo en español, una frase que describa la imagen"}${title}\n\nPublicación:\n${(r.text || r.brief || '').slice(0, 4000)}`
    case 'seo':
      return `Para este artículo de blog, propone los datos SEO. Responde solo con JSON: {"seoTitle":"máx. 60 caracteres, con la palabra clave al inicio","seoDescription":"entre 120 y 160 caracteres, con llamada a la acción","slug":"minusculas-con-guiones, 3 a 6 palabras","excerpt":"una o dos frases","tags":["3 a 6 etiquetas"]}${title}\n\nArtículo:\n${(r.text || '').slice(0, 6000)}`
  }
}

/** First JSON object in the answer (the model may wrap it in a fenced block). */
export function parseJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

export function cleanText(raw: string) {
  return raw.replace(/^```[a-z]*\n?|```$/g, '').replace(/^["“]|["”]$/g, '').trim()
}

export function parseHashtags(raw: string) {
  return Array.from(new Set((raw.match(/#[A-Za-z0-9_\u00C0-\u024F]+/g) || []).map((h) => h.trim()))).slice(0, 30)
}

export function maxTokensFor(r: CopilotRequest) {
  if (r.action === 'hashtags' || r.action === 'seo' || r.action === 'images') return 500
  if (r.action === 'ideas') return 900
  return r.channel === 'WEB' ? 2600 : 900
}

/**
 * Blocks real contact details in the client↔partner chat: phone numbers, emails, social handles, contact
 * links and «write me outside the app». Pure.
 *
 * Only what is really a way to reach someone is blocked: times («a las 11:00»), prices («$150.000 -
 * $200.000»), dates, addresses («Cra 43A #12-34, Laureles»), booking references and words like
 * «instalación», «igual» or «se llama Pablo» go through. The check returns the exact fragment that tripped
 * it, so whoever wrote it (a person or the AI agent) can reword just that part.
 */

export type ContactCheck = { isValid: true } | { isValid: false; reason: string; fragment: string }

const REASON = {
  phone: 'números de teléfono',
  email: 'correos electrónicos',
  social: 'redes sociales',
  link: 'enlaces de contacto',
  outside: 'solicitudes de contacto externo',
} as const

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const clip = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 80)

/** Words that, right before a number, make it a phone even when it does not look like a mobile. */
const PHONE_WORDS = /(?:^|[^a-z0-9])(?:cel|celu|celular|movil|tel|telefono|whatsapp|whats|wsp|wpp|numero|num|nro|llamame|llameme|marcame|marqueme|escribeme al|escribame al|contacto)\s*[:.#]?\s*(?:es|al|el|de)?\s*[:.]?\s*$/
const MONEY_BEFORE = /(?:\$|cop|usd|precio|valor|cuesta|cobro|cobra|pago|total|presupuesto)\s*$/
const MONEY_AFTER = /^\s*(?:pesos|mil|cop|usd|k\b|millones|millon)/
/** «150.000», «150.000 - 200.000»: thousands with dots are money (a phone ends in a group of 4). */
const MONEY_SHAPE = /^\d{1,3}(?:\.\d{3})+(?:\s*-\s*\d{1,3}(?:\.\d{3})+)*$/

function findPhone(message: string): string | null {
  const folded = fold(message)
  // A run of digits with the separators people put in phone numbers (no «:» or «/», so times and dates stay out)
  const re = /\+?\d[\d \t().-]{5,}\d/g
  let m: RegExpExecArray | null
  while ((m = re.exec(message))) {
    const raw = m[0]
    const digits = raw.replace(/\D/g, '')
    const before = folded.slice(Math.max(0, m.index - 24), m.index)
    const after = folded.slice(m.index + raw.length, m.index + raw.length + 12)
    const mobile = digits.length === 10 && digits.startsWith('3')
    const intl = (digits.length === 12 && digits.startsWith('573')) || (raw.trim().startsWith('+') && digits.length >= 10 && digits.length <= 13)
    const moneyContext = MONEY_BEFORE.test(before) || MONEY_AFTER.test(after)
    // A mobile written with dots («3.001.234.567») is still a phone; only an amount said as money is not
    if ((mobile || intl) && !moneyContext) return raw
    if (MONEY_SHAPE.test(raw.trim()) || moneyContext) continue
    const landline = digits.length === 10 && /^60[1-8]/.test(digits)
    const announced = digits.length >= 7 && digits.length <= 13 && PHONE_WORDS.test(before)
    if (landline || announced) return raw
  }
  return null
}

const EMAIL_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i,
  /[a-z0-9._%+-]+\s*@\s*(?:gmail|hotmail|outlook|yahoo|icloud|live|msn|aol|proton(?:mail)?)\s*\.\s*[a-z]{2,}/i,
  /\b[a-z0-9._%+-]{2,}\s*(?:\(\s*(?:at|@)\s*\)|\[\s*(?:at|@)\s*\]|\s+arroba\s+)\s*[a-z0-9-]+\s*(?:\.|\(\s*(?:dot|punto)\s*\)|\[\s*(?:dot|punto)\s*\]|\s+punto\s+)\s*[a-z]{2,}\b/i,
  /\b[a-z0-9._%+-]{3,}\s+(?:gmail|hotmail|outlook|yahoo|icloud|live)\s*(?:\.|\s+punto\s+)?\s*com\b/i,
]

const SOCIAL_NET = '(?:instagram|insta|ig|facebook|face|fb|tiktok|telegram|twitter|snapchat|snap|threads|linkedin)'
const SOCIAL_PATTERNS = [
  // «@juan.perez» as a handle (an email was already ruled out)
  /(?:^|[\s(,;:])@[a-z0-9._]{3,30}\b/i,
  // «ig: juanperez», «instagram = @juan», «mi insta es juanperez»
  new RegExp(`\\b${SOCIAL_NET}\\b\\s*[:=]\\s*@?[a-z0-9._]{3,30}`, 'i'),
  new RegExp(`\\b(?:mi|mí|nuestro|nuestra)\\s+${SOCIAL_NET}\\b(?:\\s+es)?\\s*:?\\s*@?[a-z0-9._]{3,30}`, 'i'),
  new RegExp(`\\b(?:buscame|búscame|agregame|agrégame|sigueme|sígueme|escribeme|escríbeme)\\s+(?:en|por|al)\\s+(?:el\\s+|mi\\s+)?${SOCIAL_NET}\\b`, 'i'),
]

const LINK_PATTERNS = [
  /\b(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|m\.me|instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|linktr\.ee|telegram\.me)\/\S*/i,
]

/** Folded (no accents) text: asking to talk outside the platform. */
const OUTSIDE_PATTERNS = [
  /\b(?:llamame|llameme|me llamas|me llama al|marcame|marqueme|timbrame)\b/,
  /\b(?:escribeme|escribame|hablame|hableme)\s+(?:al|por|a mi)\s+(?:whats|whatsapp|wsp|wpp|interno|privado|cel|celular|numero|telefono|correo|mail|email)\b/,
  /\b(?:te|le)\s+(?:escribo|llamo|marco|hablo)\s+(?:al|por|a tu|a su)\s+(?:whats|whatsapp|wsp|wpp|interno|privado|cel|celular|numero|telefono)\b/,
  /\b(?:hablemos|sigamos|cuadremos|cuadramos|arreglemos|arreglamos)\s+(?:por|al)\s+(?:whats|whatsapp|wsp|wpp|interno|privado|fuera|aparte|telefono|cel)\b/,
  /\b(?:pasame|pasa me|dame|mandame|enviame|regalame|me pasas|me das|me regalas)\s+(?:tu|su)\s+(?:numero|cel|celular|whats|whatsapp|wpp|telefono|correo|email|mail|insta|instagram|ig|facebook)\b(?!\s+de\s+(?:la\s+)?(?:reserva|referencia|solicitud|pedido|cuenta|documento|cedula|identificacion))/,
  /\b(?:te|le)\s+(?:paso|doy|envio|mando|dejo|comparto)\s+(?:mi|el)\s+(?:numero|cel|celular|whats|whatsapp|wpp|telefono|correo|email|mail|contacto)\b/,
  /\b(?:por|de)\s+fuera\s+de\s+(?:la\s+)?(?:app|aplicacion|plataforma|lohaggo|pagina)\b/,
  /\b(?:sin|saltandonos|sin pasar por)\s+(?:la\s+)?(?:app|aplicacion|plataforma|lohaggo)\b/,
  /\bpor\s+(?:interno|privado)\b/,
]

export function detectContactInfo(message: string): ContactCheck {
  const text = message ?? ''
  if (!text.trim()) return { isValid: true }

  for (const p of LINK_PATTERNS) {
    const m = text.match(p)
    if (m) return { isValid: false, reason: REASON.link, fragment: clip(m[0]) }
  }
  for (const p of EMAIL_PATTERNS) {
    const m = text.match(p)
    if (m) return { isValid: false, reason: REASON.email, fragment: clip(m[0]) }
  }
  const phone = findPhone(text)
  if (phone) return { isValid: false, reason: REASON.phone, fragment: clip(phone) }
  for (const p of SOCIAL_PATTERNS) {
    const m = text.match(p)
    if (m) return { isValid: false, reason: REASON.social, fragment: clip(m[0]) }
  }
  const folded = fold(text)
  for (const p of OUTSIDE_PATTERNS) {
    const m = folded.match(p)
    if (m) return { isValid: false, reason: REASON.outside, fragment: clip(text.slice(m.index ?? 0, (m.index ?? 0) + m[0].length) || m[0]) }
  }
  return { isValid: true }
}

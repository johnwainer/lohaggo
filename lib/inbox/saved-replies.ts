/** Saved replies of the team: {nombre} and {ref} are filled with the contact's first name and their latest booking. Pure. */

export const REPLY_VARIABLES = ['{nombre}', '{ref}'] as const

/** First name worth greeting: not a phone, an @handle or the «Instagram · …1234» names channels invent. */
export function greetingName(name: string | null | undefined): string | null {
  const text = name?.trim()
  if (!text) return null
  if (/^(Instagram|Messenger|WhatsApp|SMS) · /.test(text) || /^\+?\d[\d\s]+$/.test(text) || text.startsWith('@')) return null
  const first = text.split(/\s+/)[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null
}

export function usesVariable(body: string, variable: 'nombre' | 'ref') {
  return new RegExp(`\\{\\s*${variable}\\s*\\}`, 'i').test(body)
}

/** Fills the variables it knows; an unknown value keeps its placeholder so the person notices and completes it. */
export function fillReplyVariables(body: string, values: { nombre?: string | null; ref?: string | null }): string {
  return body.replace(/\{\s*(nombre|ref)\s*\}/gi, (match, key: string) => {
    const k = key.toLowerCase()
    const value = k === 'nombre' ? greetingName(values.nombre) : values.ref ? `#${values.ref.replace(/^#/, '')}` : null
    return value ?? match
  })
}

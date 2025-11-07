 // Sanitización simple sin dependencias de jsdom
 // Para evitar conflictos ESM/CommonJS en Vercel

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'p', 'br']

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  // Remover todos los tags excepto los permitidos
  let clean = dirty

  // Primero, eliminar bloques peligrosos
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
  clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
  clean = clean.replace(/<link\b[^<]*>/gi, '')
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remover event handlers completos (onclick="..." or onclick=...)
  clean = clean.replace(/on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
  clean = clean.replace(/on\w+\s*=\s*[^\s>]+/gi, '')

  // Remover javascript: y data: schemes en atributos y texto
  clean = clean.replace(/javascript:/gi, '')
  clean = clean.replace(/data:text\/html/gi, '')

  // Remover tags no permitidos pero conservar su contenido
  clean = clean.replace(/<\/?([a-zA-Z0-9\-]+)(\s[^>]*)?>/gi, (match, tagName) => {
    tagName = tagName.toLowerCase()
    if (ALLOWED_TAGS.includes(tagName)) {
      // Para tags permitidos, limpiar atributos peligrosos (dejamos ninguno)
      if (tagName === 'br' || tagName === 'p' || tagName === 'b' || tagName === 'i' || tagName === 'em' || tagName === 'strong') {
        // devolver tag limpio sin atributos
        return match.startsWith('</') ? `</${tagName}>` : `<${tagName}>`
      }
      return ''
    }
    // reemplazar tag no permitido por su texto vacío (el contenido ya queda)
    return ''
  })

  return clean.trim()
}

export function sanitizeText(text: string): string {
  if (!text) return ''

  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeText(value) as T[keyof T]
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item =>
        typeof item === 'string' ? sanitizeText(item) : item
      ) as T[keyof T]
    } else if (value && typeof value === 'object') {
      sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}

export function sanitizeUrl(url: string): string {
  if (!url) throw new Error('URL inválida')

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Protocolo no permitido')
    }
    return parsed.toString()
  } catch {
    throw new Error('URL inválida')
  }
}

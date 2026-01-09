const badWords = [
  'puta', 'puto', 'mierda', 'carajo', 'verga', 'pendejo', 'pendeja',
  'culero', 'culera', 'chingar', 'joder', 'coño', 'marica', 'maricon',
  'gonorrea', 'hijueputa', 'malparido', 'malparida', 'berraco',
  'carechimba', 'chimba', 'guevon', 'huevon', 'boludo', 'pelotudo',
  'concha', 'conchudo', 'chucha', 'pirobo', 'piroba', 'sapo', 'sapa',
  'mamaguevo', 'mamagüevo', 'güevon', 'imbecil', 'idiota', 'estupido',
  'estúpido', 'maldito', 'maldita', 'desgraciado', 'desgraciada',
  'cabron', 'cabrón', 'cabrona', 'zorra', 'perra', 'perro',
  'rata', 'basura', 'porqueria', 'porquería', 'mierda', 'caca',
  'culo', 'tetas', 'pene', 'vagina', 'sexo', 'porno', 'xxx',
  'drogas', 'cocaina', 'cocaína', 'marihuana', 'mota', 'hierba',
  'prostituta', 'prostituto', 'escort', 'dama de compañia',
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock',
  'damn', 'hell', 'bastard', 'cunt', 'whore', 'slut'
]

const irrelevantTerms = [
  'a', 'e', 'i', 'o', 'u', 'el', 'la', 'los', 'las', 'un', 'una',
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'sin', 'sobre',
  'y', 'o', 'pero', 'si', 'no', 'que', 'como', 'cuando', 'donde',
  'quien', 'cual', 'cuanto', 'muy', 'mas', 'menos', 'mucho', 'poco',
  'todo', 'nada', 'algo', 'alguien', 'nadie', 'siempre', 'nunca',
  'hola', 'adios', 'gracias', 'por favor', 'ok', 'vale', 'bien',
  'mal', 'si', 'no', 'tal vez', 'quizas', 'quizás',
  'test', 'prueba', 'testing', 'asdf', 'qwerty', '123', '1234',
  'aaa', 'bbb', 'ccc', 'xxx', 'zzz', 'lol', 'jaja', 'jeje',
  'xd', 'xdd', 'jajaja', 'jejeje', 'hahaha', 'hehehe'
]

const spamPatterns = [
  /^(.)\1{3,}$/,
  /^\d+$/,
  /^[^a-záéíóúñ]+$/i,
  /(.{2,})\1{2,}/,
  /^[!@#$%^&*()_+=\[\]{};':"\\|,.<>/?]+$/
]

export function isInappropriate(query: string): boolean {
  const normalized = query.toLowerCase().trim()
  
  if (normalized.length < 2) return true
  
  if (irrelevantTerms.includes(normalized)) return true
  
  for (const badWord of badWords) {
    if (normalized.includes(badWord)) return true
  }
  
  for (const pattern of spamPatterns) {
    if (pattern.test(normalized)) return true
  }
  
  return false
}

export function sanitizeSearchQuery(query: string): string | null {
  const trimmed = query.trim()
  
  if (trimmed.length < 2 || trimmed.length > 100) return null
  
  if (isInappropriate(trimmed)) return null
  
  return trimmed
}

export function isValidSearchTerm(query: string): boolean {
  const sanitized = sanitizeSearchQuery(query)
  return sanitized !== null
}

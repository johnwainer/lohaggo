/** Blocks phones, emails, social handles and «contact me outside» in the client↔partner chat. Pure. */
export function detectContactInfo(message: string): { isValid: boolean; reason?: string } {
  const lowerMessage = message.toLowerCase()
  const normalizedMessage = message.replace(/\s+/g, '')

  const phonePatterns = [
    /\b\d{10}\b/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\d{3}[-.\s]?\d{7}\b/g,
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
    /\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\b3\d{9}\b/g,
    /\b[3][0-9]{2}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    /\bcel[:\s]*\d+/gi,
    /\bcelular[:\s]*\d+/gi,
    /\bwhatsapp[:\s]*\d+/gi,
    /\bwpp[:\s]*\d+/gi,
    /\btel[:\s]*\d+/gi,
    /\bteléfono[:\s]*\d+/gi,
    /\btelefono[:\s]*\d+/gi,
    /\bmóvil[:\s]*\d+/gi,
    /\bmovil[:\s]*\d+/gi,
  ]

  for (const pattern of phonePatterns) {
    if (pattern.test(message) || pattern.test(normalizedMessage)) {
      return {
        isValid: false,
        reason: 'números de teléfono'
      }
    }
  }

  const emailPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*\[\s*@\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*\.\s*\]\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*\(\s*@\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*\.\s*\)\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s+arroba\s+[A-Za-z0-9.-]+\s+punto\s+[A-Z|a-z]{2,}\b/gi,
    /\bcorreo[:\s]*[A-Za-z0-9._%+-]+/gi,
    /\bemail[:\s]*[A-Za-z0-9._%+-]+/gi,
    /\be-mail[:\s]*[A-Za-z0-9._%+-]+/gi,
  ]

  for (const pattern of emailPatterns) {
    if (pattern.test(message)) {
      return {
        isValid: false,
        reason: 'correos electrónicos'
      }
    }
  }

  const socialMediaPatterns = [
    /\b(?:instagram|insta|ig)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:facebook|fb)[:\s]*[A-Za-z0-9._]+/gi,
    /\b(?:twitter|x\.com)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:telegram|tg)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:tiktok|tt)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:linkedin)[:\s]*[A-Za-z0-9._]+/gi,
    /\b(?:snapchat|snap)[:\s]*[A-Za-z0-9._]+/gi,
    /\b@[A-Za-z0-9._]{3,}/g,
  ]

  for (const pattern of socialMediaPatterns) {
    if (pattern.test(message)) {
      return {
        isValid: false,
        reason: 'redes sociales'
      }
    }
  }

  const contactKeywords = [
    'llámame', 'llamame', 'llama me', 'llamá', 'llama',
    'escríbeme', 'escribeme', 'escribe me', 'escribí',
    'contáctame', 'contactame', 'contacta me',
    'mi número', 'mi numero', 'mi cel', 'mi celular', 'mi móvil', 'mi movil',
    'mi correo', 'mi email', 'mi e-mail', 'mi mail',
    'mi whatsapp', 'mi wpp', 'mi whats',
    'mi instagram', 'mi insta', 'mi ig',
    'mi facebook', 'mi fb',
    'mi telegram', 'mi tg',
    'agrégame', 'agregame', 'agrega me',
    'búscame', 'buscame', 'busca me',
    'añádeme', 'añademe', 'añade me',
    'fuera de la plataforma', 'fuera de aquí', 'fuera de aqui',
    'por fuera', 'afuera',
  ]

  for (const keyword of contactKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        isValid: false,
        reason: 'solicitudes de contacto externo'
      }
    }
  }

  const obfuscatedPatterns = [
    /\b\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\b/g,
    /\b\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d\b/g,
    /\b[a-z0-9]+\s*\*+\s*[a-z0-9]+\s*@/gi,
    /\b[a-z0-9]+\s*\[at\]\s*[a-z0-9]+/gi,
    /\b[a-z0-9]+\s*\(at\)\s*[a-z0-9]+/gi,
  ]

  for (const pattern of obfuscatedPatterns) {
    if (pattern.test(message) || pattern.test(normalizedMessage)) {
      return {
        isValid: false,
        reason: 'información de contacto ofuscada'
      }
    }
  }

  return { isValid: true }
}

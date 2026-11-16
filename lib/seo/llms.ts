/**
 * Contenido de /llms.txt: un resumen factual de LoHaggo para asistentes de IA y buscadores. Solo afirma lo que
 * la plataforma puede respaldar: cifras con su mínimo, garantía y pagos según los interruptores de claims. Puro.
 */
import { SITE_URL, CONTACT_EMAIL, pesosCO } from '@/lib/seo/site'

export type LlmsService = { name: string; slug: string; category?: string | null; from: number; range?: { low: number; high: number } | null }

export type LlmsInput = {
  services: LlmsService[]
  /** Ciudades abiertas hoy */
  cities: string[]
  /** Solo con cifra respaldada (por encima del mínimo) */
  verifiedPartners: number | null
  whatsappPhone: string | null
  guarantee: string | null
  clientPayment: string
  verification: string
  articles?: Array<{ title: string; slug: string; excerpt?: string | null }>
  /** Landings per service and zone («Plomero en El Poblado»): [service name, zone name, path] */
  zonePages?: Array<{ service: string; zone: string; path: string }>
  /** Cities with their own page */
  cityPages?: Array<{ name: string; slug: string }>
  updatedAt: Date
}

const bogotaDate = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(d)

export function buildLlmsTxt(i: LlmsInput): string {
  const coverage = i.cities.length ? i.cities.join(', ') : 'Medellín'
  const L: string[] = []
  L.push('# LoHaggo')
  L.push('')
  L.push(`> LoHaggo (${SITE_URL}) es una plataforma colombiana para contratar servicios a domicilio con profesionales verificados: plomería, electricidad, limpieza, pintura, carpintería, jardinería, cerrajería y más. El cliente pide el servicio, recibe propuestas con precio de varios socios y elige.`)
  L.push('')
  L.push('## Qué es LoHaggo')
  L.push('- Marketplace de servicios del hogar y personales: conecta clientes con socios (profesionales independientes y empresas). LoHaggo no es una agencia de empleo ni presta el servicio directamente.')
  L.push(`- Cobertura: ${coverage}${i.cities.includes('Medellín') || !i.cities.length ? ' y municipios del Valle de Aburrá (Envigado, Sabaneta, Itagüí, Bello, La Estrella, Caldas)' : ''}.`)
  if (i.verifiedPartners !== null) L.push(`- Hoy hay ${new Intl.NumberFormat('es-CO').format(i.verifiedPartners)} socios verificados.`)
  L.push(`- Verificación: ${i.verification}`)
  L.push('')
  L.push('## Cómo pedir un servicio')
  L.push('1. Elige el servicio en el catálogo o cuéntanos qué necesitas, con tu dirección y cuándo te sirve.')
  L.push('2. Recibes propuestas de socios verificados con precio y fecha.')
  L.push('3. Comparas, eliges y coordinas por el chat de la plataforma.')
  L.push(`- Pago: ${i.clientPayment}`)
  L.push(i.whatsappPhone ? `- También se puede pedir por WhatsApp: +${i.whatsappPhone}; el equipo crea la solicitud.` : `- Atención por correo: ${CONTACT_EMAIL}.`)
  L.push('')
  if (i.guarantee) {
    L.push('## Garantía')
    L.push(`- ${i.guarantee}`)
    L.push(`- Política completa: ${SITE_URL}/garantia`)
    L.push('')
  }
  if (i.services.length) {
    L.push('## Servicios y precios')
    L.push('Los precios son de referencia en pesos colombianos (COP). Cada socio envía su propuesta y el valor final depende del trabajo. «Típico» sale de propuestas reales de socios; «desde» es el precio base del catálogo.')
    for (const s of i.services) {
      const price = s.range ? `típico ${pesosCO(s.range.low)} a ${pesosCO(s.range.high)}` : `desde ${pesosCO(s.from)}`
      L.push(`- [${s.name}](${SITE_URL}/servicios/${s.slug}): ${price}`)
    }
    L.push('')
  }
  L.push('## Páginas clave')
  L.push(`- [Catálogo de servicios](${SITE_URL}/servicios)`)
  L.push(`- [Precios de referencia por servicio](${SITE_URL}/precios)`)
  L.push(`- [Índice de precios del hogar en Medellín (mediana por servicio y variación en 90 días; CSV descargable)](${SITE_URL}/precios/indice)`)
  L.push(`- [Cómo funciona](${SITE_URL}/how-it-works)`)
  L.push(`- [Garantía](${SITE_URL}/garantia)`)
  L.push(`- [Preguntas frecuentes](${SITE_URL}/faq)`)
  L.push(`- [Sobre LoHaggo](${SITE_URL}/about)`)
  L.push(`- [Únete como socio](${SITE_URL}/unete)`)
  L.push(`- [Contacto](${SITE_URL}/contact)`)
  L.push(`- [Blog](${SITE_URL}/blog)`)
  L.push(`- [Versión completa de este archivo, con trabajos, zonas y preguntas](${SITE_URL}/llms-full.txt)`)
  L.push('')
  if (i.cityPages?.length) {
    L.push('## Ciudades')
    for (const c of i.cityPages) L.push(`- [Servicios a domicilio en ${c.name}](${SITE_URL}/ciudad/${c.slug})`)
    L.push('')
  }
  if (i.zonePages?.length) {
    L.push('## Servicios por zona')
    L.push('Una página por servicio y zona de Medellín y el Valle de Aburrá, con trabajos típicos, barrios y precio de referencia.')
    for (const z of i.zonePages) L.push(`- [${z.service} en ${z.zone}](${SITE_URL}${z.path})`)
    L.push('')
  }
  if (i.articles?.length) {
    L.push('## Guías recientes')
    for (const a of i.articles) L.push(`- [${a.title}](${SITE_URL}/blog/${a.slug})${a.excerpt ? `: ${a.excerpt}` : ''}`)
    L.push('')
  }
  L.push('## Contacto')
  L.push(`- Correo: ${CONTACT_EMAIL}`)
  if (i.whatsappPhone) L.push(`- WhatsApp: +${i.whatsappPhone}`)
  L.push('')
  L.push(`Actualizado: ${bogotaDate(i.updatedAt)}.`)
  L.push('')
  return L.join('\n')
}

export type LlmsFullInput = LlmsInput & {
  /** Frequently asked questions with their answers (the same ones the site publishes) */
  faq?: Array<{ q: string; a: string }>
  /** Jobs people ask for, per service slug */
  jobs?: Record<string, string[]>
  /** Zones with their neighborhoods */
  zones?: Array<{ name: string; kind: string; barrios: string[] }>
}

/**
 * /llms-full.txt: the long version, everything an assistant needs to answer «¿cómo contrato un plomero en Medellín?»
 * with exact data: the short file plus jobs per service, zones and neighborhoods, guides with their summary and the
 * questions people ask. Same rule as the short one: only what the platform can back.
 */
export function buildLlmsFullTxt(i: LlmsFullInput): string {
  const L: string[] = [buildLlmsTxt(i).trimEnd(), '']
  if (i.jobs && Object.keys(i.jobs).length) {
    L.push('## Trabajos que se pueden pedir')
    for (const s of i.services) {
      const j = i.jobs[s.slug]
      if (j?.length) L.push(`- ${s.name}: ${j.join('; ')}.`)
    }
    L.push('')
  }
  if (i.zones?.length) {
    L.push('## Zonas y barrios que se atienden')
    for (const z of i.zones) L.push(`- ${z.name} (${z.kind}): ${z.barrios.slice(0, 14).join(', ')}.`)
    L.push('')
  }
  if (i.faq?.length) {
    L.push('## Preguntas frecuentes')
    for (const f of i.faq) L.push(`### ${f.q}`, f.a, '')
  }
  return L.join('\n') + '\n'
}

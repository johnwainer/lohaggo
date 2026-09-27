/**
 * Search intent for the public catalogue: drops filler words ("necesito un…", "de", "la") and maps the words
 * people actually type ("fuga", "enchufe", "uñas") to the service they mean. Targets are fragments of
 * service names, so an intent only ever points at services that exist in the catalogue.
 */

export const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'para', 'un', 'una', 'mi', 'por', 'con', 'y', 'a', 'que', 'se',
  'necesito', 'quiero', 'busco', 'los', 'las', 'del', 'al', 'me', 'mis', 'lo', 'le', 'o', 'es',
  'hay', 'alguien', 'servicio', 'servicios', 'ayuda', 'hola', 'favor',
])

type Intent = {
  /** Multi-word phrases (normalized, stopwords removed) that win over single words. */
  phrases?: string[]
  /** Single words; plurals and longer forms match by prefix (4+ letters). */
  words: string[]
  /** Fragments of normalized service names, most specific first. */
  targets: string[]
}

export const INTENTS: Intent[] = [
  {
    phrases: ['llave perdida', 'llaves perdidas', 'perdi llave', 'perdi llaves', 'abrir puerta', 'quede afuera', 'cambio chapa'],
    words: ['cerradura', 'cerrajero', 'cerrajeria', 'chapa', 'candado'],
    targets: ['cerrajer'],
  },
  {
    phrases: ['corto circuito', 'se fue luz'],
    words: ['corto', 'cortocircuito', 'enchufe', 'toma', 'tomacorriente', 'breaker', 'breker', 'luz', 'bombillo', 'electrico', 'electrica', 'electricista', 'electricidad', 'cableado', 'interruptor', 'lampara', 'tablero'],
    targets: ['electric', 'cortocircuito'],
  },
  {
    words: ['fuga', 'tuberia', 'tubo', 'gotera', 'grifo', 'llave', 'sanitario', 'inodoro', 'desague', 'destapar', 'destape', 'agua', 'plomero', 'plomeria', 'fontanero', 'lavamanos', 'lavaplatos', 'ducha', 'sifon', 'canilla'],
    targets: ['plomer', 'fuga', 'grifo', 'destape'],
  },
  {
    words: ['techo', 'techos', 'gotera', 'teja', 'tejas', 'impermeabilizar', 'impermeabilizacion', 'filtracion', 'humedad'],
    targets: ['techo', 'impermeabiliz'],
  },
  {
    words: ['pintar', 'pintura', 'pintor', 'pared', 'paredes', 'estuco', 'estucar', 'resanar', 'fachada'],
    targets: ['pintur'],
  },
  {
    phrases: ['aseo hogar', 'aseo casa'],
    words: ['aseo', 'limpiar', 'limpieza', 'trapear', 'desinfectar', 'desinfeccion'],
    targets: ['limpieza de hogar', 'limpieza del hogar', 'limpieza', 'aseo'],
  },
  {
    words: ['mueble', 'muebles', 'closet', 'carpintero', 'carpinteria', 'madera', 'cajon', 'repisa'],
    targets: ['carpinter', 'mueble'],
  },
  {
    words: ['unas', 'manicure', 'manicura', 'pedicure', 'pedicura', 'esmaltado'],
    targets: ['manicur', 'pedicur', 'unas'],
  },
  {
    words: ['camara', 'camaras', 'cctv', 'vigilancia'],
    targets: ['camara'],
  },
  {
    words: ['jardin', 'jardineria', 'jardinero', 'pasto', 'cesped', 'poda', 'podar', 'guadana'],
    targets: ['jardin'],
  },
  {
    words: ['plaga', 'plagas', 'cucaracha', 'cucarachas', 'fumigar', 'fumigacion', 'ratones', 'zancudos', 'chinches'],
    targets: ['fumig'],
  },
  {
    words: ['trasteo', 'mudanza', 'mudanzas', 'acarreo', 'flete'],
    targets: ['mudanza', 'transporte de carga'],
  },
  {
    phrases: ['aire acondicionado', 'aires acondicionados'],
    words: ['aire', 'aires', 'minisplit'],
    targets: ['aire'],
  },
  { words: ['nevera', 'neveras', 'refrigerador', 'congelador'], targets: ['nevera', 'electrodomest'] },
  { words: ['lavadora', 'lavadoras', 'secadora'], targets: ['lavadora', 'electrodomest'] },
  { words: ['estufa', 'estufas', 'horno'], targets: ['estufa', 'electrodomest'] },
  { words: ['electrodomestico', 'electrodomesticos', 'microondas', 'licuadora'], targets: ['electrodomest'] },
  { words: ['calentador', 'calentadores', 'boiler'], targets: ['calentador'] },
  { phrases: ['olor gas'], words: ['gas', 'pipeta'], targets: ['gas'] },
  { phrases: ['soporte tv', 'colgar tv'], words: ['tv', 'televisor', 'television'], targets: ['tv'] },
  { words: ['wifi', 'internet', 'router', 'red', 'redes', 'cableado'], targets: ['redes'] },
  { words: ['celular', 'celulares', 'telefono'], targets: ['celular'] },
  {
    phrases: ['corte pelo', 'corte cabello'],
    words: ['peluqueria', 'peluquero', 'cabello', 'pelo', 'barba', 'barberia', 'barbero'],
    targets: ['peluquer', 'barber', 'corte'],
  },
  {
    words: ['depilar', 'depilacion', 'depilarme'],
    targets: ['depila'],
  },
  {
    words: ['masaje', 'masajes', 'masajista'],
    targets: ['masaje'],
  },
  {
    words: ['maquillaje', 'maquillar', 'maquilladora'],
    targets: ['maquill'],
  },
  {
    words: ['enchape', 'enchapar', 'baldosa', 'baldosas', 'ceramica', 'porcelanato'],
    targets: ['enchap'],
  },
  {
    words: ['computador', 'computadora', 'portatil', 'pc', 'laptop'],
    targets: ['comput', 'soporte tecnico'],
  },
  {
    words: ['diligencia', 'diligencias', 'encargo', 'mandado', 'domicilio'],
    targets: ['lohaggo ya', 'favor'],
  },
]

export function normalizeText(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Normalized words of the query without filler words. */
export function queryTokens(q: string): string[] {
  return normalizeText(q).split(' ').filter((t) => t && !STOPWORDS.has(t))
}

function wordMatches(token: string, word: string) {
  return token === word || (word.length >= 4 && token.startsWith(word) && token.length - word.length <= 3)
}

/** Name-fragment targets the query points to, most relevant intent first. */
export function detectIntentTargets(q: string): string[][] {
  const tokens = queryTokens(q)
  if (!tokens.length) return []
  const joined = ` ${tokens.join(' ')} `
  const consumed = new Set<number>()
  const hits: Array<{ targets: string[]; weight: number; order: number }> = []

  INTENTS.forEach((intent, order) => {
    for (const phrase of intent.phrases ?? []) {
      if (!joined.includes(` ${phrase} `)) continue
      const parts = phrase.split(' ')
      for (let i = 0; i <= tokens.length - parts.length; i++) {
        if (parts.every((p, k) => tokens[i + k] === p)) parts.forEach((_, k) => consumed.add(i + k))
      }
      hits.push({ targets: intent.targets, weight: 100, order })
      return
    }
  })

  INTENTS.forEach((intent, order) => {
    if (hits.some((h) => h.order === order)) return
    const count = tokens.filter((t, i) => !consumed.has(i) && intent.words.some((w) => wordMatches(t, w))).length
    if (count > 0) hits.push({ targets: intent.targets, weight: count, order })
  })

  return hits.sort((a, b) => b.weight - a.weight || a.order - b.order).map((h) => h.targets)
}

type SearchableService = {
  name: string
  slug?: string
  category?: { name?: string | null } | null
  partnerStats?: { availableCount?: number }
  _count?: { partners?: number }
}

function available(s: SearchableService) {
  return s.partnerStats?.availableCount ?? s._count?.partners ?? 0
}

/**
 * Intent ranking: services the query clearly points to, best first. Returns null when the query has no
 * known intent, so the caller falls back to the text search.
 */
export function rankByIntent<T extends SearchableService>(services: T[], q: string): T[] | null {
  const intents = detectIntentTargets(q)
  if (!intents.length) return null
  const tokens = queryTokens(q).filter((t) => t.length >= 3)

  const scored = services.map((s) => {
    const name = normalizeText(s.name)
    const category = normalizeText(s.category?.name ?? '')
    let score = 0
    intents.forEach((targets, i) => {
      targets.forEach((t, j) => {
        if (name.includes(t)) score = Math.max(score, 1000 - i * 100 - j * 10)
        else if (category.includes(t)) score = Math.max(score, 500 - i * 100 - j * 10)
      })
    })
    if (!score && tokens.some((t) => name.split(' ').some((w) => w.startsWith(t)))) score = 100
    return { s, score }
  })

  const matched = scored.filter((x) => x.score > 0)
  if (!matched.length) return null
  return matched
    .sort((a, b) => b.score - a.score || available(b.s) - available(a.s) || a.s.name.localeCompare(b.s.name, 'es'))
    .map((x) => x.s)
}

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
    phrases: ['plancha aligerada', 'placa aligerada', 'losa aligerada', 'maestro obra'],
    words: ['albanil', 'albanileria', 'construccion', 'obra', 'losa', 'placa', 'aligerada', 'ladrillo', 'cemento', 'muro', 'remodelacion', 'ampliacion', 'mamposteria'],
    targets: ['albanil', 'construcc', 'obra', 'remodel'],
  },
  { words: ['piscina', 'piscinas', 'alberca', 'jacuzzi', 'sauna'], targets: ['piscina'] },
  { words: ['mensajero', 'mensajeria', 'domiciliario', 'domicilios', 'paquete', 'paquetes', 'envio', 'envios'], targets: ['mensajer', 'lohaggo ya'] },
  { words: ['polarizar', 'polarizado', 'polarizados'], targets: ['polariz'] },
  {
    phrases: ['fiesta infantil', 'fiestas infantiles', 'show infantil'],
    words: ['globos', 'payaso', 'recreacionista', 'recreacion', 'animador', 'animacion', 'cumpleanos', 'pinata'],
    targets: ['animacion', 'decoracion de eventos'],
  },
  { words: ['adiestrador', 'adiestramiento', 'obediencia', 'amaestrar', 'entrenador canino'], phrases: ['entrenar perro', 'educar perro'], targets: ['entrenamiento canino'] },
  { words: ['guitarra', 'piano', 'violin', 'canto', 'bateria', 'ukelele', 'musica', 'musical'], targets: ['clases de musica', 'musica'] },
  { words: ['ingles', 'frances', 'aleman', 'portugues', 'idioma', 'idiomas', 'italiano'], targets: ['idiomas'] },
  { words: ['modista', 'sastre', 'costura', 'costurera', 'dobladillo', 'bastilla', 'cremallera', 'bordado'], phrases: ['arreglar ropa', 'arreglo ropa', 'arreglos ropa', 'ajustar ropa'], targets: ['costura'] },
  { words: ['veterinario', 'veterinaria', 'vacuna', 'vacunas', 'desparasitar'], targets: ['veterinaria'] },
  { words: ['psicologo', 'psicologa', 'psicologia', 'ansiedad', 'depresion', 'terapeuta'], targets: ['psicolog'] },
  { words: ['enfermera', 'enfermero', 'enfermeria', 'inyeccion', 'inyecciones', 'curaciones'], targets: ['enfermeria', 'inyecciones'] },
  { words: ['fotografo', 'fotografa', 'fotografia', 'fotos'], targets: ['fotograf'] },
  { words: ['contador', 'contadora', 'contabilidad', 'contable', 'impuestos', 'dian', 'tributario'], targets: ['contable'] },
  { words: ['abogado', 'abogada', 'legal'], targets: ['legal'] },
  { words: ['arquitecto', 'arquitecta', 'arquitectura', 'planos'], targets: ['arquitect'] },
  { words: ['fisioterapeuta', 'fisioterapia', 'fisio', 'rehabilitacion'], targets: ['fisioterapia'] },
  { words: ['entrenador', 'entrenadora', 'gimnasio'], phrases: ['personal trainer'], targets: ['entrenador personal'] },
  { words: ['nutricionista', 'nutricion', 'dieta'], targets: ['nutricion'] },
  { words: ['mecanico', 'mecanica', 'frenos', 'embrague', 'suspension', 'bateria carro'], phrases: ['mecanico domicilio'], targets: ['mecanica', 'cambio de aceite'] },
  { words: ['aceite', 'lubricante'], phrases: ['cambio aceite', 'cambiar aceite'], targets: ['cambio de aceite', 'mecanica'] },
  { words: ['autolavado', 'lavadero'], phrases: ['lavar carro', 'lavar carros', 'lavado carro', 'lavado carros', 'lavar moto', 'lavado auto', 'lavar auto'], targets: ['lavado de autos'] },
  { words: ['gasfitero', 'gasfiter'], targets: ['plomer'] },
  { words: ['formatear', 'formateo', 'virus', 'antivirus', 'windows'], phrases: ['tarjeta video', 'pantalla azul', 'no prende'], targets: ['computadoras', 'soporte tecnico'] },
  { words: ['playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'consola', 'consolas'], targets: ['consolas'] },
  { words: ['persiana', 'persianas', 'cortina', 'cortinas', 'blackout'], targets: ['persianas', 'cortinas'] },
  { words: ['drywall', 'cielorraso', 'superboard', 'dry wall'], phrases: ['cielo raso'], targets: ['cielo raso'] },
  { words: ['solares', 'fotovoltaico', 'paneles'], targets: ['paneles solares'] },
  { words: ['bicicleta', 'bicicletas', 'bici', 'ciclismo'], targets: ['bicicletas'] },
  { words: ['catering', 'banquete', 'banquetes', 'pasaboca', 'pasabocas'], targets: ['catering'] },
  { words: ['chef', 'cocinero', 'cocinera'], targets: ['chef'] },
  { words: ['torta', 'tortas', 'pastel', 'pasteles', 'cupcakes', 'postre', 'postres', 'reposteria'], targets: ['reposter'] },
  { words: ['sofa', 'sofas', 'colchon', 'colchones', 'tapizado', 'tapiceria', 'tapicero'], targets: ['tapiceria', 'tapizados'] },
  { words: ['herrero', 'herreria', 'reja', 'rejas', 'porton', 'portones', 'baranda', 'barandas', 'soldador', 'soldadura'], targets: ['herreria', 'soldadura'] },
  { words: ['paseador', 'paseo', 'pasear'], phrases: ['pasear perro', 'paseo perros', 'paseador perros'], targets: ['paseo de perros'] },
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

/** True when the two strings differ by at most one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length || i === b.length) return true
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

function wordMatches(token: string, word: string) {
  if (token === word || (word.length >= 4 && token.startsWith(word) && token.length - word.length <= 3)) return true
  // A one-letter typo («madajes», «plomeo») only counts for longer words, so short ones never match by accident
  return word.length >= 6 && token.length >= 6 && withinOneEdit(token, word)
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

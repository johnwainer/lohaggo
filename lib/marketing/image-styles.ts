/**
 * Image styles for the pieces: what each one looks like (for people choosing in the settings), when it
 * fits (for the agent choosing per piece) and the instruction the image generator receives.
 * Pure: shared by the agent, the settings screen and the example generator.
 */

export type ImageStyle = {
  id: string
  label: string
  /** One line for the settings card */
  description: string
  /** For the agent: which pieces it suits */
  whenToUse: string
  /** Sent to the image generator */
  prompt: string
  /** Stock-photo search for a reference example when AI generation is not available; null when stock photos cannot show the style (illustration, 3D) */
  exampleQuery: string | null
}

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: 'profesional',
    label: 'Profesional',
    description: 'Foto editorial limpia: el profesional trabajando, uniformado, con buena luz.',
    whenToUse: 'confianza y seriedad: presentar un servicio, verificación, garantía, reparaciones técnicas',
    prompt: 'fotografía profesional editorial, encuadre limpio y ordenado, iluminación suave de estudio, profesional con uniforme trabajando con sus herramientas, alta nitidez, colores naturales',
    exampleQuery: 'electrician at work',
  },
  {
    id: 'hiperrealista',
    label: 'Hiperrealista',
    description: 'Detalle extremo, texturas y profundidad de campo, como una foto de cámara profesional.',
    whenToUse: 'mostrar un problema o un resultado de cerca: humedad, grietas, acabados, antes y después de un trabajo',
    prompt: 'fotografía hiperrealista, detalle extremo y texturas visibles, luz natural lateral, lente 50 mm, poca profundidad de campo, aspecto de cámara réflex',
    exampleQuery: 'hands repairing pipe close up',
  },
  {
    id: 'cercana',
    label: 'Cotidiana y cercana',
    description: 'Escena real en un hogar colombiano, cálida, como una foto de la vida diaria.',
    whenToUse: 'consejos para el hogar, contar una situación del cliente, contenido de conversación y comunidad',
    prompt: 'fotografía cotidiana y cálida en un hogar colombiano, luz de ventana, momento auténtico y espontáneo, ambiente acogedor',
    exampleQuery: 'cozy home family kitchen natural light',
  },
  {
    id: 'ilustracion',
    label: 'Ilustración plana',
    description: 'Dibujo vectorial moderno con formas simples y los colores de la marca.',
    whenToUse: 'explicar pasos, listas y consejos de forma sencilla; temas donde una foto se vería forzada',
    prompt: 'ilustración vectorial plana y moderna, formas simples y redondeadas, paleta morado y naranja con fondos claros, sin sombras realistas',
    exampleQuery: null,
  },
  {
    id: 'animada',
    label: 'Animada 3D',
    description: 'Render 3D estilo película animada: personajes amigables y colores vivos.',
    whenToUse: 'piezas divertidas o para todo público: mascotas, niños, belleza, campañas de temporada',
    prompt: 'render 3D estilo película animada, personajes amigables y expresivos, colores vivos, iluminación suave y cálida, acabado tipo plastilina brillante',
    exampleQuery: null,
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    description: 'Un objeto protagonista sobre fondo de color sólido, mucho espacio libre.',
    whenToUse: 'mensajes cortos, historias y reels con texto en pantalla, promociones: deja espacio para el titular',
    prompt: 'composición minimalista, un solo objeto o herramienta protagonista, fondo de color sólido de la marca, mucho espacio negativo, sombras suaves',
    exampleQuery: 'minimal objects pastel background',
  },
]

export const IMAGE_STYLE_IDS = IMAGE_STYLES.map((s) => s.id)
export const DEFAULT_IMAGE_STYLES = ['profesional', 'cercana', 'hiperrealista', 'ilustracion']

/** A style the team writes itself: a name and the instruction for the generator */
export type CustomImageStyle = { id: string; label: string; prompt: string }

export type ImageStyleConfig = {
  /** Styles the agent may use */
  enabled: string[]
  /** 'auto': the agent picks per piece; otherwise every image uses this style */
  pick: 'auto' | string
  custom: CustomImageStyle[]
  /** Example image per style id (generated with the workspace's model, or a stock reference) */
  examples: Record<string, { url: string; source: 'ai' | 'pexels'; at: string }>
}

export const defaultImageStyleConfig = (): ImageStyleConfig => ({ enabled: [...DEFAULT_IMAGE_STYLES], pick: 'auto', custom: [], examples: {} })

/** Every style the workspace has: the catalog plus its own */
export function allStyles(c: Pick<ImageStyleConfig, 'custom'>): Array<Pick<ImageStyle, 'id' | 'label' | 'prompt'> & Partial<ImageStyle>> {
  return [...IMAGE_STYLES, ...c.custom.map((x) => ({ ...x, description: x.prompt, whenToUse: 'cuando encaje con la pieza (estilo propio del equipo)' }))]
}

export function styleById(c: Pick<ImageStyleConfig, 'custom'>, id: string | null | undefined) {
  return id ? allStyles(c).find((s) => s.id === id) ?? null : null
}

/** The styles the agent may choose from now, with the fixed one alone when the team fixed it */
export function usableStyles(c: ImageStyleConfig) {
  const all = allStyles(c)
  if (c.pick !== 'auto') return all.filter((s) => s.id === c.pick)
  const on = all.filter((s) => c.enabled.includes(s.id))
  return on.length ? on : all.filter((s) => DEFAULT_IMAGE_STYLES.includes(s.id))
}

/** The style that applies to a piece: the fixed one, or the agent's choice if it is allowed, or the first allowed */
export function resolveStyle(c: ImageStyleConfig, chosen: string | null | undefined) {
  const usable = usableStyles(c)
  return usable.find((s) => s.id === chosen) ?? usable[0] ?? null
}

/** Settings input → a clean config (unknown ids dropped, at most 4 custom styles) */
export function sanitizeImageStyles(raw: unknown, prev: ImageStyleConfig = defaultImageStyleConfig()): ImageStyleConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const custom = Array.isArray(r.custom)
    ? (r.custom as unknown[]).map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
        const label = typeof o.label === 'string' ? o.label.trim().slice(0, 40) : ''
        const prompt = typeof o.prompt === 'string' ? o.prompt.trim().slice(0, 400) : ''
        const id = typeof o.id === 'string' && /^custom-[a-z0-9-]{1,40}$/.test(o.id) ? o.id : `custom-${i + 1}`
        return label && prompt ? { id, label, prompt } : null
      }).filter((x): x is CustomImageStyle => Boolean(x)).slice(0, 4)
    : prev.custom
  const known = new Set([...IMAGE_STYLE_IDS, ...custom.map((c) => c.id)])
  const enabled = Array.isArray(r.enabled) ? (r.enabled as unknown[]).filter((x): x is string => typeof x === 'string' && known.has(x)) : prev.enabled.filter((x) => known.has(x))
  const pick = typeof r.pick === 'string' && (r.pick === 'auto' || known.has(r.pick)) ? r.pick : prev.pick && (prev.pick === 'auto' || known.has(prev.pick)) ? prev.pick : 'auto'
  const examples: ImageStyleConfig['examples'] = {}
  const ex = r.examples && typeof r.examples === 'object' ? (r.examples as Record<string, unknown>) : prev.examples
  for (const [k, v] of Object.entries(ex ?? {})) {
    const o = v as { url?: unknown; source?: unknown; at?: unknown } | null
    if (known.has(k) && o && typeof o.url === 'string' && /^https:\/\//.test(o.url)) examples[k] = { url: o.url, source: o.source === 'pexels' ? 'pexels' : 'ai', at: typeof o.at === 'string' ? o.at : new Date().toISOString() }
  }
  return { enabled: enabled.length ? Array.from(new Set(enabled)) : [...DEFAULT_IMAGE_STYLES], pick, custom, examples }
}

/** The lines the agent reads to pick a style per piece */
export function styleGuide(c: ImageStyleConfig) {
  const usable = usableStyles(c)
  if (c.pick !== 'auto' && usable[0]) return `Estilo de imagen: el equipo fijó «${usable[0].label}» para todas las piezas; pon image.style = "${usable[0].id}".`
  return [
    'Estilo de imagen: elige en image.style el que mejor sirva a cada pieza (varía entre piezas para que el perfil no se vea repetido):',
    ...usable.map((s) => `- ${s.id} («${s.label}»): ${s.whenToUse ?? 'cuando encaje'}`),
  ].join('\n')
}

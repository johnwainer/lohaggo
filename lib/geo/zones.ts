/**
 * Coverage zones of Medellín: its 16 comunas and the Valle de Aburrá municipalities we serve. Partners pick
 * the ones they cover; a request gets its zone from the address (barrio, comuna or municipality). Pure.
 */

export type Zone = { key: string; name: string; kind: 'comuna' | 'municipio'; city: 'MEDELLIN'; barrios: string[] }

export const ZONES: Zone[] = [
  { key: 'el-poblado', name: 'El Poblado', kind: 'comuna', city: 'MEDELLIN', barrios: ['poblado', 'provenza', 'manila', 'lleras', 'castropol', 'patio bonito', 'los balsos', 'el tesoro', 'astorga', 'alejandria', 'la frontera', 'las lomas', 'san lucas', 'santa maria de los angeles', 'la aguacatala', 'el diamante', 'los naranjos', 'villa carlota', 'milla de oro', 'el campestre'] },
  { key: 'laureles', name: 'Laureles - Estadio', kind: 'comuna', city: 'MEDELLIN', barrios: ['laureles', 'estadio', 'conquistadores', 'florida nueva', 'velodromo', 'suramericana', 'carlos e restrepo', 'los colores', 'naranjal', 'bolivariana', 'san joaquin', 'las acacias', 'lorena', 'el nogal', 'los almendros', 'cuarta brigada'] },
  { key: 'belen', name: 'Belén', kind: 'comuna', city: 'MEDELLIN', barrios: ['belen', 'fatima', 'rosales', 'la mota', 'los alpes', 'loma de los bernal', 'rodeo alto', 'las playas', 'granada', 'diego echavarria', 'la gloria', 'nueva villa de aburra', 'la palma', 'los bernal', 'san bernardo', 'la hondonada', 'altavista'] },
  { key: 'la-america', name: 'La América', kind: 'comuna', city: 'MEDELLIN', barrios: ['la america', 'calasanz', 'floresta', 'santa monica', 'simon bolivar', 'santa lucia', 'ferrini', 'la castellana', 'los pinos', 'el danubio'] },
  { key: 'guayabal', name: 'Guayabal', kind: 'comuna', city: 'MEDELLIN', barrios: ['guayabal', 'cristo rey', 'campo amor', 'trinidad', 'santa fe', 'la colina', 'shellmar', 'tenche'] },
  { key: 'la-candelaria', name: 'La Candelaria (Centro)', kind: 'comuna', city: 'MEDELLIN', barrios: ['candelaria', 'centro', 'prado', 'boston', 'villanueva', 'san benito', 'jesus nazareno', 'chagualo', 'estacion villa', 'colon', 'perpetuo socorro', 'calle nueva', 'san diego', 'las palmas', 'bombona', 'guayaquil'] },
  { key: 'san-javier', name: 'San Javier', kind: 'comuna', city: 'MEDELLIN', barrios: ['san javier', '20 de julio', 'veinte de julio', 'el salado', 'eduardo santos', 'juan xxiii', 'belencito', 'la independencia', 'las independencias', 'antonio narino'] },
  { key: 'robledo', name: 'Robledo', kind: 'comuna', city: 'MEDELLIN', barrios: ['robledo', 'pilarica', 'bello horizonte', 'cucaracho', 'villa flora', 'cordoba', 'lopez de mesa', 'el volador', 'altamira', 'aures', 'el diamante robledo', 'monteclaro'] },
  { key: 'castilla', name: 'Castilla', kind: 'comuna', city: 'MEDELLIN', barrios: ['castilla', 'tricentenario', 'florencia', 'boyaca', 'toscana', 'belalcazar', 'francisco antonio zea', 'caribe', 'girardot', 'alfonso lopez', 'las brisas', 'tejelo'] },
  { key: 'doce-de-octubre', name: 'Doce de Octubre', kind: 'comuna', city: 'MEDELLIN', barrios: ['doce de octubre', '12 de octubre', 'pedregal', 'santander', 'kennedy', 'picacho', 'mirador del doce', 'la esperanza', 'progreso'] },
  { key: 'aranjuez', name: 'Aranjuez', kind: 'comuna', city: 'MEDELLIN', barrios: ['aranjuez', 'campo valdes', 'berlin', 'san isidro', 'moravia', 'palermo', 'brasilia', 'miranda', 'bermejal', 'sevilla', 'san pedro', 'los angeles'] },
  { key: 'manrique', name: 'Manrique', kind: 'comuna', city: 'MEDELLIN', barrios: ['manrique', 'la salle', 'las granjas', 'el raizal', 'versalles', 'campo valdes 2', 'santa ines', 'el pomar', 'la cruz', 'oriente'] },
  { key: 'villa-hermosa', name: 'Villa Hermosa', kind: 'comuna', city: 'MEDELLIN', barrios: ['villa hermosa', 'villahermosa', 'enciso', 'la mansion', 'sucre', 'el pinal', 'la ladera', 'batallon girardot', 'los mangos', 'san miguel'] },
  { key: 'buenos-aires', name: 'Buenos Aires', kind: 'comuna', city: 'MEDELLIN', barrios: ['buenos aires', 'miraflores', 'loreto', 'caicedo', 'alejandro echavarria', 'la milagrosa', 'gerona', 'el salvador', 'barrio de jesus', 'bomboná'] },
  { key: 'popular', name: 'Popular', kind: 'comuna', city: 'MEDELLIN', barrios: ['popular', 'santo domingo', 'granizal', 'villa guadalupe', 'san pablo', 'el compromiso', 'la avanzada', 'carpinelo'] },
  { key: 'santa-cruz', name: 'Santa Cruz', kind: 'comuna', city: 'MEDELLIN', barrios: ['santa cruz', 'la rosa', 'villa del socorro', 'moscu', 'andalucia', 'la francia', 'villa niza', 'la isla', 'playon de los comuneros'] },
  { key: 'envigado', name: 'Envigado', kind: 'municipio', city: 'MEDELLIN', barrios: ['envigado', 'zuniga', 'el portal', 'la magnolia', 'jardines', 'loma del escobero', 'las vegas', 'otra parte', 'la paz envigado', 'alcala', 'el dorado', 'loma de las brujas'] },
  { key: 'sabaneta', name: 'Sabaneta', kind: 'municipio', city: 'MEDELLIN', barrios: ['sabaneta', 'aves maria', 'mayorca', 'las lomitas', 'la doctora', 'prados de sabaneta', 'calle larga'] },
  { key: 'itagui', name: 'Itagüí', kind: 'municipio', city: 'MEDELLIN', barrios: ['itagui', 'ditaires', 'suramerica', 'san pio', 'santa maria itagui', 'la gloria itagui', 'el rosario', 'calatrava', 'san francisco itagui'] },
  { key: 'bello', name: 'Bello', kind: 'municipio', city: 'MEDELLIN', barrios: ['bello', 'niquia', 'cabanas', 'la madera', 'suarez', 'pachelly', 'zamora', 'navarra', 'fontidueno', 'el trapiche', 'hato viejo', 'pajarito'] },
  { key: 'la-estrella', name: 'La Estrella', kind: 'municipio', city: 'MEDELLIN', barrios: ['la estrella', 'pueblo viejo', 'la tablaza', 'suramerica la estrella'] },
  { key: 'caldas', name: 'Caldas', kind: 'municipio', city: 'MEDELLIN', barrios: ['caldas', 'la valeria', 'primavera caldas'] },
]

export const ZONE_KEYS = ZONES.map((z) => z.key)
const BY_KEY = new Map(ZONES.map((z) => [z.key, z]))

export const zoneByKey = (key: string | null | undefined) => (key ? BY_KEY.get(key) ?? null : null)
export const zoneName = (key: string | null | undefined) => zoneByKey(key)?.name ?? null
export const isZoneKey = (k: unknown): k is string => typeof k === 'string' && BY_KEY.has(k)

const norm = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `

/**
 * The zone of an address from its free text (barrio, municipality, comuna name). Municipalities win over
 * a barrio name they share (an address "... Envigado" with barrio "El Dorado" is Envigado); the longest
 * match wins otherwise. Null when nothing matches.
 */
export function zoneFromText(...parts: Array<string | null | undefined>): string | null {
  const text = norm(parts.filter(Boolean).join(' '))
  if (text.trim().length < 3) return null
  for (const z of ZONES) if (z.kind === 'municipio' && text.includes(norm(z.name))) return z.key
  let best: { key: string; len: number } | null = null
  for (const z of ZONES) {
    for (const b of [z.name, ...z.barrios]) {
      const n = norm(b)
      if (text.includes(n) && (!best || n.length > best.len)) best = { key: z.key, len: n.length }
    }
  }
  return best?.key ?? null
}

/** Partners that cover a zone: those that listed it, and those with no zones (they cover the whole city). */
export function coversZone(coverage: string[] | null | undefined, zone: string | null | undefined) {
  if (!zone || !coverage || coverage.length === 0) return true
  return coverage.includes(zone)
}

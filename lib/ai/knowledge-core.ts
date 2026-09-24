/** Pure knowledge-base helpers: token estimate, chunking with overlap, lexical ranking. */

export const CHUNK_TARGET = 650
export const CHUNK_MIN = 500
export const CHUNK_MAX = 800
export const CHUNK_OVERLAP = 80

/** ~4 characters per token for Spanish/English prose; good enough to size chunks. */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

function splitUnits(text: string): string[] {
  const units: string[] = []
  for (const para of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const p = para.trim()
    if (!p) continue
    if (estimateTokens(p) <= CHUNK_TARGET) {
      units.push(p)
      continue
    }
    const sentences = p.match(/[^.!?\n]+(?:[.!?]+|\n|$)\s*/g) || [p]
    for (const s of sentences) {
      const sentence = s.trim()
      if (!sentence) continue
      if (estimateTokens(sentence) <= CHUNK_MAX) {
        units.push(sentence)
        continue
      }
      // Very long run-on text (tables, CSV rows): cut by words
      const words = sentence.split(/\s+/)
      let buf: string[] = []
      for (const w of words) {
        buf.push(w)
        if (estimateTokens(buf.join(' ')) >= CHUNK_TARGET) {
          units.push(buf.join(' '))
          buf = []
        }
      }
      if (buf.length) units.push(buf.join(' '))
    }
  }
  return units
}

function tailWords(text: string, tokens: number) {
  const words = text.split(/\s+/)
  const out: string[] = []
  for (let i = words.length - 1; i >= 0; i--) {
    out.unshift(words[i])
    if (estimateTokens(out.join(' ')) >= tokens) break
  }
  return out.join(' ')
}

/**
 * Greedy packing of paragraphs/sentences into 500–800 token chunks, each one starting with the last
 * ~80 tokens of the previous chunk so an answer split across a boundary is still retrievable.
 */
export function chunkText(text: string): Array<{ text: string; tokens: number }> {
  const units = splitUnits(text)
  const chunks: string[] = []
  let current: string[] = []
  let size = 0
  const close = () => {
    if (current.length) chunks.push(current.join('\n\n'))
    const overlap = chunks.length ? tailWords(chunks[chunks.length - 1], CHUNK_OVERLAP) : ''
    current = overlap ? [overlap] : []
    size = overlap ? estimateTokens(overlap) : 0
  }
  for (const unit of units) {
    const t = estimateTokens(unit)
    if (size + t <= CHUNK_TARGET || (size < CHUNK_MIN && size + t <= CHUNK_MAX)) {
      current.push(unit)
      size += t
      continue
    }
    close()
    current.push(unit)
    size += t
  }
  // Last chunk: drop it if it is only the overlap of the previous one
  const onlyOverlap = chunks.length > 0 && current.length === 1 && size <= CHUNK_OVERLAP + 5
  if (current.length && !onlyOverlap) chunks.push(current.join('\n\n'))
  return chunks.map((c) => ({ text: c, tokens: estimateTokens(c) }))
}

// ─── Lexical fallback ────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  'de la el los las un una unos unas y o u a en por para con sin sobre que qué como cómo cuando cuándo donde dónde es son ser fue era del al lo le les se su sus mi mis tu tus yo me te nos hay muy mas más pero si sí no ya este esta esto estos estas ese esa eso the and or of to in is are for with on at be it this that'
    .split(' ')
    .map((w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')),
)

export function terms(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** BM25-lite: idf over the candidate set, term frequency saturation, title matches weigh double. */
export function rankLexical<T extends { text: string; title: string }>(query: string, chunks: T[], k = 8): Array<T & { score: number }> {
  const q = Array.from(new Set(terms(query)))
  if (!q.length || !chunks.length) return []
  const docs = chunks.map((c) => ({ c, body: terms(c.text), title: new Set(terms(c.title)) }))
  const df: Record<string, number> = {}
  for (const d of docs) {
    const seen = new Set(d.body)
    for (const t of q) if (seen.has(t) || d.title.has(t)) df[t] = (df[t] || 0) + 1
  }
  const n = docs.length
  const scored = docs.map((d) => {
    let score = 0
    for (const t of q) {
      if (!df[t]) continue
      const idf = Math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
      const tf = d.body.filter((w) => w === t).length
      score += idf * ((tf * 2.2) / (tf + 1.2)) + (d.title.has(t) ? idf : 0)
    }
    return { ...d.c, score }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k)
}

export function cosine(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** Pure: reading the link code out of what the person wrote. */

/** «123 456», «123-456», «mi código es 123456», «*123456*» → «123456»; null when it is not 6 digits. */
export function extractLinkCode(text: string) {
  const runs = text.match(/\d[\d\s.-]*\d/g) ?? []
  for (const run of runs) {
    const digits = run.replace(/\D/g, '')
    if (digits.length === 6) return digits
  }
  // «123456 3001234567»: a 6-digit word next to other numbers
  const word = text.split(/[^\d]+/).find((w) => w.length === 6)
  return word ?? null
}

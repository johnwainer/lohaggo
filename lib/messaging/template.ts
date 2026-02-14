type Vars = Record<string, string | number | null | undefined>

export function renderTextTemplate(template: string, vars: Vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

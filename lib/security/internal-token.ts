/**
 * Token the proxy uses to ask /api/security/internal whether an IP is blocked. Both sides must derive it the same
 * way: SECURITY_INTERNAL_TOKEN, else the auth secret. (Before, the proxy fell back to the auth secret while the
 * endpoint required SECURITY_INTERNAL_TOKEN, so with it unset every check was refused and IP blocking was silently off.)
 */
export function resolveSecurityInternalToken(vars: { SECURITY_INTERNAL_TOKEN?: string; NEXTAUTH_SECRET_CURRENT?: string; NEXTAUTH_SECRET?: string }): string | undefined {
  return vars.SECURITY_INTERNAL_TOKEN || vars.NEXTAUTH_SECRET_CURRENT || vars.NEXTAUTH_SECRET || undefined
}

let lastUnsetWarnAt = 0

/**
 * The SendGrid webhook stays strict (SECURITY_INTERNAL_TOKEN only, no fallback), so when it is unset delivery events
 * are refused with 503. Logs that loudly at most once per hour so it is not silent. Returns whether it logged.
 */
export function warnInternalTokenUnset(log: { error: (msg: string, meta?: unknown) => void }, now = Date.now()): boolean {
  if (now - lastUnsetWarnAt < 3600_000) return false
  lastUnsetWarnAt = now
  log.error('SECURITY_INTERNAL_TOKEN no está configurado: el webhook de SendGrid rechaza todos los eventos (503) y los estados de entrega de correo no se actualizan')
  return true
}

export function resetInternalTokenWarning() {
  lastUnsetWarnAt = 0
}

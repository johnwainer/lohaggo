/**
 * Token the proxy uses to ask /api/security/internal whether an IP is blocked. Both sides must derive it the same
 * way: SECURITY_INTERNAL_TOKEN, else the auth secret. (Before, the proxy fell back to the auth secret while the
 * endpoint required SECURITY_INTERNAL_TOKEN, so with it unset every check was refused and IP blocking was silently off.)
 */
export function resolveSecurityInternalToken(vars: { SECURITY_INTERNAL_TOKEN?: string; NEXTAUTH_SECRET_CURRENT?: string; NEXTAUTH_SECRET?: string }): string | undefined {
  return vars.SECURITY_INTERNAL_TOKEN || vars.NEXTAUTH_SECRET_CURRENT || vars.NEXTAUTH_SECRET || undefined
}

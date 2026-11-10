/**
 * Which paused services to switch on when a partner's identity document is approved, without passing the
 * active-services cap (MAX_ACTIVE_SERVICES). Services already active stay as they are (never switched off
 * here); the free slots go to the services the partner added most recently (the latest choice). Pure.
 */
export function servicesToActivate(services: Array<{ id: string; active: boolean; createdAt: Date }>, max: number): string[] {
  const active = services.filter((s) => s.active).length
  const free = Math.max(0, max - active)
  if (!free) return []
  return services
    .filter((s) => !s.active)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, free)
    .map((s) => s.id)
}

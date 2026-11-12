/**
 * A booking born from an accepted proposal starts CONFIRMED when the partner already committed to a day AND
 * an hour in the proposal and the client took it as it was. If the client picks another day or hour, the
 * partner has not agreed to it: the booking stays PENDING until they confirm.
 */
export function shouldAutoConfirm(
  proposal: { proposedDate?: Date | string | null; proposedTime?: string | null },
  clientOverride?: { scheduledDate?: Date | null } | null,
): boolean {
  if (clientOverride?.scheduledDate) return false
  return Boolean(proposal.proposedDate) && /^([01]\d|2[0-3]):[0-5]\d$/.test(proposal.proposedTime ?? '')
}

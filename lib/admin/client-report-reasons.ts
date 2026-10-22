/** Reasons a partner can report a client for (pure: the partner panel and lib/admin/client-reports.ts). */
export const CLIENT_REPORT_REASONS = {
  NOT_SERIOUS: 'No es serio',
  NO_RESPONSE: 'No responde',
  CANCELLED_NO_NOTICE: 'Canceló sin aviso',
  PAY_OUTSIDE: 'Pidió pagar por fuera',
  OTHER: 'Otro',
} as const
export type ClientReportReason = keyof typeof CLIENT_REPORT_REASONS

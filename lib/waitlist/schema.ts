import { z } from 'zod'

export const WAITLIST_ROLES = ['client', 'partner'] as const
export type WaitlistRole = (typeof WAITLIST_ROLES)[number]

export const waitlistSchema = z.object({
  citySlug: z.string().trim().min(1).max(100),
  /** Optional when a WhatsApp number is given (the service page asks only for the number) */
  email: z.string().trim().toLowerCase().email().max(254).optional().nullable().transform((v) => (v ? v : null)),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  role: z.enum(WAITLIST_ROLES),
  /** Optional WhatsApp to announce the opening; needs its own consent */
  phone: z.string().trim().max(30).optional().nullable().transform((v) => (v ? v : null)),
  phoneConsent: z.boolean().optional(),
  // Ley 1581 (habeas data): explicit consent is mandatory
  consent: z.literal(true),
  website: z.string().optional().nullable(),
  /** Where the sign-up came from: the city page (default) or a service page with no partners yet */
  serviceSlug: z.string().trim().max(100).optional().nullable().transform((v) => (v ? v : null)),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>

export type WaitlistParse =
  | { ok: true; data: WaitlistInput }
  | { ok: false; reason: 'invalid'; issues: z.ZodIssue[] }
  | { ok: false; reason: 'honeypot' }

export function parseWaitlist(body: unknown): WaitlistParse {
  const r = waitlistSchema.safeParse(body)
  if (!r.success) return { ok: false, reason: 'invalid', issues: r.error.issues }
  if (r.data.website && r.data.website.trim() !== '') return { ok: false, reason: 'honeypot' }
  if (!r.data.email && !r.data.phone) {
    return { ok: false, reason: 'invalid', issues: [{ code: 'custom', path: ['email'], message: 'Escribe tu correo o tu WhatsApp' }] }
  }
  if (r.data.phone && r.data.phoneConsent !== true) {
    return { ok: false, reason: 'invalid', issues: [{ code: 'custom', path: ['phoneConsent'], message: 'Autoriza el aviso por WhatsApp' }] }
  }
  return { ok: true, data: r.data }
}

/** Only cities that are not live yet (or are partner-registry only) accept sign-ups. */
export function cityAcceptsWaitlist(status: string | null | undefined, partnerRegistry = false, serviceInterest = false): boolean {
  // A city in «registro de socios» mode is selectable but cannot take requests yet: it also keeps a list.
  // A live city keeps «avísame cuando haya» for a service with no partners (source service:<slug>).
  return status === 'COMING_SOON' || status === 'INACTIVE' || (status === 'ACTIVE' && (partnerRegistry || serviceInterest))
}

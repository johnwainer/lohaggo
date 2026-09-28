import { z } from 'zod'

export const WAITLIST_ROLES = ['client', 'partner'] as const
export type WaitlistRole = (typeof WAITLIST_ROLES)[number]

export const waitlistSchema = z.object({
  citySlug: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
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
  if (r.data.phone && r.data.phoneConsent !== true) {
    return { ok: false, reason: 'invalid', issues: [{ code: 'custom', path: ['phoneConsent'], message: 'Autoriza el aviso por WhatsApp' }] }
  }
  return { ok: true, data: r.data }
}

/** Only cities that are not live yet accept sign-ups. */
export function cityAcceptsWaitlist(status: string | null | undefined): boolean {
  return status === 'COMING_SOON' || status === 'INACTIVE'
}

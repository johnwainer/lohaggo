import { z } from "zod"

export const registerSchema = z.object({
    /** Optional only for a partner with a phone proof (`phoneProof`): the account then gets the placeholder address. */
    email: z.union([z.literal(''), z.string().email("Email inválido")]).optional(),
    /** From /api/auth/phone/prove: server-checked proof that the person confirmed this phone by WhatsApp code. */
    phoneProof: z.string().max(300).optional(),
    /** Optional only for partners: without one the server picks a random password and emails an access link. */
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    phone: z.string().optional(),
    role: z.enum(["CLIENT", "PARTNER"]).optional().default("CLIENT"),
    city: z.string().optional(),
    services: z.array(z.string()).optional(),
    oficio: z.array(z.string()).optional(),
    captchaToken: z.string().optional(),
    honeypot: z.string().optional(),
    formStartedAt: z.string().optional(),
    /** Optional checkbox: WhatsApp/SMS marketing consent (Ley 1581) */
    marketingConsent: z.boolean().optional(),
    /** Referral code from ?ref= */
    ref: z.string().max(32).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>

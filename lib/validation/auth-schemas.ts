import { z } from "zod"

export const registerSchema = z.object({
    email: z.string().email("Email inválido"),
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
})

export type RegisterInput = z.infer<typeof registerSchema>

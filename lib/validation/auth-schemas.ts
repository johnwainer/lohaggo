import { z } from "zod"

export const registerSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    phone: z.string().optional(),
    role: z.enum(["CLIENT", "PARTNER"]).optional().default("CLIENT"),
    city: z.string().optional(),
    services: z.array(z.string()).optional(),
    oficio: z.string().optional(),
    captchaToken: z.string().optional(),
    honeypot: z.string().optional(),
    formStartedAt: z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>

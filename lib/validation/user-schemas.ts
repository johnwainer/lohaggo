import { z } from "zod"

export const userUpdateSchema = z.object({
    userId: z.string().min(1, "ID de usuario requerido"),
    role: z.enum(["CLIENT", "PARTNER", "ADMIN"], {
        errorMap: () => ({ message: "Rol inválido" }),
    }),
})

export type UserUpdateInput = z.infer<typeof userUpdateSchema>

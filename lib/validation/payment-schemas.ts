import { z } from "zod"

export const paymentProcessSchema = z.object({
    bookingId: z.string().min(1, "ID de reserva requerido"),
    paymentMethodId: z.string().optional(),
})

export type PaymentProcessInput = z.infer<typeof paymentProcessSchema>

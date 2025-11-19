import { z } from "zod"

export const proposalCreateSchema = z.object({
    serviceRequestId: z.string().min(1, "ID de solicitud requerido"),
    price: z.coerce.number().min(0, "Precio inválido"),
    notes: z.string().optional(),
})

export type ProposalCreateInput = z.infer<typeof proposalCreateSchema>

import { z } from "zod"

export const proposalCreateSchema = z.object({
    serviceRequestId: z.string().min(1, "ID de solicitud requerido"),
    price: z.coerce.number().min(0, "Precio inválido"),
    notes: z.string().optional(),
    proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable().optional(),
    proposedTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida").nullable().optional(),
})

export type ProposalCreateInput = z.infer<typeof proposalCreateSchema>

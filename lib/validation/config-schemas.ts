import { z } from "zod"

export const commissionConfigSchema = z.object({
    clientCommissionRate: z.number()
        .min(0, "La comisión del cliente debe ser mayor o igual a 0%")
        .max(50, "La comisión del cliente debe ser menor o igual a 50%"),
    partnerCommissionRate: z.number()
        .min(0, "La comisión del socio debe ser mayor o igual a 0%")
        .max(50, "La comisión del socio debe ser menor o igual a 50%"),
    minServicePrice: z.number().min(0).optional(),
    maxServicePrice: z.number().min(0).optional(),
    commissionEnabled: z.boolean().optional(),
    cashEnabled: z.boolean().optional(),
    transferEnabled: z.boolean().optional(),
    mercadoPagoEnabled: z.boolean().optional(),
})

export type CommissionConfigInput = z.infer<typeof commissionConfigSchema>

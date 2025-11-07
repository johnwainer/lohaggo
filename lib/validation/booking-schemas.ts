import { z } from 'zod'

export const bookingCreateSchema = z.object({
  serviceId: z.string().min(1, 'El servicio es requerido'),
  scheduledDate: z.string().datetime('Fecha inválida'),
  scheduledTime: z.string().min(1, 'La hora es requerida').max(50),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres').max(500),
  notes: z.string().max(2000, 'Las notas son demasiado largas').optional(),
  totalPrice: z.number().positive('El precio debe ser mayor a 0').max(100000000),
  partnerId: z.string().min(1, 'El partner es requerido').optional(),
  proposalId: z.string().optional()
})

export const bookingUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Estado inválido' })
  }),
  cancellationReason: z.string().max(500).optional()
})

import { z } from 'zod'

export const serviceRequestSchema = z.object({
  serviceId: z.string().min(1, 'El servicio es requerido'),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres').max(500, 'La dirección es demasiado larga'),
  notes: z.string().max(2000, 'Las notas son demasiado largas').optional(),
  city: z.string().max(100).optional(),
  preferredDate: z.string().datetime().optional(),
  preferredTime: z.string().max(50).optional(),
  isUrgent: z.boolean().optional(),
  photoUrls: z.array(z.string().url('URL de foto inválida')).max(10, 'Máximo 10 fotos').optional()
}).refine(
  (data) => data.isUrgent || data.preferredDate,
  { message: 'Debes indicar si necesitas el servicio urgente o seleccionar una fecha' }
)

export const proposalSchema = z.object({
  serviceRequestId: z.string().min(1, 'La solicitud de servicio es requerida'),
  price: z.number().positive('El precio debe ser mayor a 0').max(100000000, 'El precio es demasiado alto'),
  estimatedDuration: z.string().min(1, 'La duración estimada es requerida').max(100),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres').max(2000, 'La descripción es demasiado larga'),
  availability: z.string().min(1, 'La disponibilidad es requerida').max(500)
})

export const reviewSchema = z.object({
  bookingId: z.string().min(1, 'La reserva es requerida'),
  rating: z.number().int().min(1, 'La calificación mínima es 1').max(5, 'La calificación máxima es 5'),
  comment: z.string().min(10, 'El comentario debe tener al menos 10 caracteres').max(1000, 'El comentario es demasiado largo').optional()
})

export const addressSchema = z.object({
  street: z.string().min(5, 'La calle debe tener al menos 5 caracteres').max(200),
  city: z.string(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().min(2).max(100).optional(),
  isDefault: z.boolean().optional()
})

export const partnerProfileSchema = z.object({
  bio: z.string().max(1000, 'La biografía es demasiado larga').optional(),
  experience: z.string().max(2000, 'La experiencia es demasiado larga').optional(),
  certifications: z.array(z.string().max(200)).max(20, 'Máximo 20 certificaciones').optional(),
  serviceIds: z.array(z.string()).min(1, 'Debes seleccionar al menos un servicio').max(50, 'Máximo 50 servicios')
})

export const userProfileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Número de teléfono inválido').optional(),
  email: z.string().email('Email inválido').optional()
})

export const chatMessageSchema = z.object({
  chatId: z.string().min(1, 'El chat es requerido'),
  content: z.string().min(1, 'El mensaje no puede estar vacío').max(5000, 'El mensaje es demasiado largo')
})

export const paymentMethodSchema = z.object({
  type: z.enum(['CARD', 'BANK_ACCOUNT'], { errorMap: () => ({ message: 'Tipo de pago inválido' }) }),
  cardNumber: z.string().regex(/^\d{13,19}$/, 'Número de tarjeta inválido').optional(),
  cardholderName: z.string().min(2).max(100).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(new Date().getFullYear()).optional(),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV inválido').optional(),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  accountType: z.enum(['SAVINGS', 'CHECKING']).optional()
})

export const bookingActionSchema = z.object({
  action: z.enum(['accept', 'reject', 'complete', 'cancel'], { errorMap: () => ({ message: 'Acción inválida' }) }),
  reason: z.string().max(500).optional()
})

export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  smsNotifications: z.boolean()
})

# Validación y Sanitización de Entrada

## Implementación de Seguridad

### 1. Validación con Zod
- ✅ Todos los endpoints de API validan entrada con schemas Zod
- ✅ Validación de tipos, longitudes y formatos
- ✅ Mensajes de error descriptivos

### 2. Sanitización XSS
- ✅ Sanitización automática de strings con DOMPurify
- ✅ Escape de HTML en inputs de usuario
- ✅ Validación de URLs para prevenir javascript: y data: URIs
- ✅ Limpieza de caracteres peligrosos

### 3. Validación Robusta
- ✅ Schemas centralizados en `/lib/validation/schemas.ts`
- ✅ Helper de validación en `/lib/validation/validator.ts`
- ✅ Sanitización en `/lib/validation/sanitize.ts`
- ✅ Middleware de seguridad con rate limiting

### Endpoints Protegidos
- `/api/service-requests` - Validación de solicitudes de servicio
- `/api/proposals` - Validación de propuestas
- `/api/reviews` - Validación de reseñas
- `/api/addresses` - Validación de direcciones
- `/api/user/profile` - Validación de perfil de usuario
- `/api/chats/[chatId]/messages` - Validación de mensajes
- `/api/payment-methods` - Validación de métodos de pago
- `/api/bookings` - Validación de reservas

### Características de Seguridad
1. **Validación de Entrada**: Todos los campos validados con Zod
2. **Sanitización XSS**: DOMPurify para limpiar HTML
3. **Validación de URLs**: Solo http/https permitidos
4. **Límites de Longitud**: Prevención de ataques de buffer
5. **Validación de Tipos**: Números, emails, teléfonos, etc.
6. **Rate Limiting**: Protección contra abuso
7. **Headers de Seguridad**: X-Content-Type-Options, X-Frame-Options, etc.

### Uso
```typescript
import { validateRequest, serviceRequestSchema } from '@/lib/validation'

const validation = await validateRequest(serviceRequestSchema, body)
if (!validation.success) {
  return validation.error
}
const validatedData = validation.data
```

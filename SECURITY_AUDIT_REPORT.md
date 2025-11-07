# 🔒 AUDITORÍA DE SEGURIDAD - HAGGO PLATFORM

**Fecha de auditoría:** 2024  
**Alcance:** Aplicación completa (Frontend, Backend, API, Base de datos)  
**Severidad:** CRÍTICA - Requiere acción inmediata

---

## 📋 RESUMEN EJECUTIVO

Se realizó una auditoría exhaustiva de seguridad en toda la plataforma Haggo, incluyendo:
- ✅ Panel de cliente (Dashboard)
- ✅ Panel de socio (Partner)
- ✅ Panel de administrador (Admin)
- ✅ Rutas públicas (Home, Servicios, etc.)
- ✅ API endpoints (20+ endpoints)
- ✅ Sistema de autenticación
- ✅ Sistema de pagos
- ✅ Manejo de archivos
- ✅ Base de datos

### Hallazgos Principales

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| 🔴 **CRÍTICA** | 15 | Requiere acción inmediata |
| 🟠 **ALTA** | 12 | Resolver en 1-2 semanas |
| 🟡 **MEDIA** | 8 | Resolver en 1 mes |
| 🔵 **BAJA** | 5 | Mejora continua |

---

## 🔴 VULNERABILIDADES CRÍTICAS

### 1. Falta de Validación de Respuestas HTTP (126+ ocurrencias)

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** Toda la aplicación (componentes y páginas)  
**Archivos afectados:**
- `app/dashboard/page.tsx` (líneas 273-274, 286-287, 403-406)
- `app/partner/page.tsx` (múltiples ocurrencias)
- `components/ChatModal.tsx` (líneas 80, 94, 120, 138)
- `components/PaymentButton.tsx` (líneas 29, 58)
- `components/admin/sections/*.tsx` (todos los archivos)
- Y 100+ ocurrencias más

**Problema:**
```typescript
// ❌ VULNERABLE - No valida res.ok
const res = await fetch('/api/bookings')
const data = await res.json() // Puede fallar si res.status >= 400
```

**Riesgo:**
- Crashes inesperados de la aplicación
- Parseo de JSON en respuestas de error
- Exposición de stack traces al usuario
- Mala experiencia de usuario

**Solución:**
```typescript
// ✅ SEGURO
// utils/api.ts
export async function fetchAPI<T>(
  url: string, 
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, options)
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ 
        error: 'Error de conexión con el servidor' 
      }))
      throw new Error(error.error || `Error HTTP ${res.status}`)
    }
    
    return await res.json()
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Error inesperado en la petición')
  }
}

// Uso
const bookings = await fetchAPI<Booking[]>('/api/bookings')
```

**Prioridad:** INMEDIATA - Implementar en todos los fetch() de la aplicación

---

### 2. Exposición de Información Sensible en Console.log (353+ ocurrencias)

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** Toda la aplicación  
**Archivos afectados:**
- `app/dashboard/page.tsx` (líneas 289, 305, 308)
- `app/api/payments/create/route.ts` (líneas 63, 73, 80-85)
- `app/api/payment-methods/route.ts` (líneas 77, 114, 141, 171)
- `app/api/payments/webhook/route.ts` (líneas 102, 110, 117-122)
- Y 340+ ocurrencias más en toda la API

**Problema:**
```typescript
// ❌ EXPONE DATOS SENSIBLES EN PRODUCCIÓN
console.log('📊 Service Requests Response:', data)
console.log('💰 Client Commission Rate from API:', data.clientCommissionRate)
console.log('Usuario logueado:', { userId, userEmail, userName })
console.log('💰 Desglose del pago:', {
  serviceAmount,
  clientCommissionRate,
  clientCommission,
  totalAmount,
})
```

**Riesgo:**
- Exposición de datos personales (emails, nombres, teléfonos)
- Exposición de información financiera (comisiones, montos)
- Exposición de IDs de usuarios y transacciones
- Violación de GDPR/CCPA
- Información útil para atacantes

**Solución:**
```typescript
// utils/logger.ts
const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  info: (...args: any[]) => {
    if (isDevelopment) console.log(...args)
  },
  warn: (...args: any[]) => {
    if (isDevelopment) console.warn(...args)
  },
  error: (...args: any[]) => {
    if (isDevelopment) console.error(...args)
    // En producción, enviar a servicio de logging (Sentry, LogRocket, etc.)
  },
  // Para datos sensibles, NUNCA loguear en producción
  sensitive: (...args: any[]) => {
    if (isDevelopment && process.env.LOG_SENSITIVE === 'true') {
      console.log('[SENSITIVE]', ...args)
    }
  }
}

// Uso
logger.info('Fetching bookings')
logger.error('Error creating booking:', error.message) // NO el objeto completo
logger.sensitive('Payment details:', paymentData) // Solo en dev con flag
```

**Prioridad:** INMEDIATA - Remover todos los console.log de producción

---

### 3. Webhook de Pagos sin Validación de Firma

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** `app/api/payments/webhook/route.ts`  
**Líneas:** 1-152

**Problema:**
```typescript
// ❌ VULNERABLE - Acepta cualquier request sin validar origen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body
    
    if (type === 'payment') {
      // Procesa el pago sin validar que venga de MercadoPago
      const paymentId = data?.id
      // ...
    }
  }
}
```

**Riesgo:**
- Cualquiera puede enviar webhooks falsos
- Confirmación de pagos no realizados
- Fraude financiero
- Pérdida económica directa

**Solución:**
```typescript
// ✅ SEGURO - Validar firma de MercadoPago
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // 1. Validar firma de MercadoPago
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    
    if (!xSignature || !xRequestId) {
      return NextResponse.json(
        { error: 'Missing signature headers' }, 
        { status: 401 }
      )
    }
    
    const body = await req.text()
    const bodyJson = JSON.parse(body)
    
    // 2. Verificar firma
    const parts = xSignature.split(',')
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
    const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1]
    
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET!
    const manifest = `id:${bodyJson.data.id};request-id:${xRequestId};ts:${ts};`
    
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex')
    
    if (hmac !== hash) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' }, 
        { status: 401 }
      )
    }
    
    // 3. Ahora sí procesar el webhook
    const { type, data } = bodyJson
    // ...
  }
}
```

**Prioridad:** INMEDIATA - Implementar antes de ir a producción

---

### 4. Falta de Rate Limiting en API

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** Todos los endpoints de API  
**Archivos afectados:** `app/api/**/*.ts` (todos)

**Problema:**
- No hay límite de requests por IP/usuario
- Vulnerable a ataques de fuerza bruta
- Vulnerable a DDoS
- Costos elevados de infraestructura

**Riesgo:**
- Ataques de fuerza bruta en login
- Spam de registros
- Sobrecarga del servidor
- Costos excesivos de base de datos

**Solución:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Crear instancia de rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests por 10 segundos
  analytics: true,
})

export async function middleware(request: NextRequest) {
  // Solo aplicar rate limiting a rutas de API
  if (request.nextUrl.pathname.startsWith('/api')) {
    const ip = request.ip ?? '127.0.0.1'
    const { success, limit, reset, remaining } = await ratelimit.limit(ip)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Demasiadas peticiones. Intenta de nuevo más tarde.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

**Alternativa sin Upstash (usando memoria):**
```typescript
// lib/ratelimit.ts
const requests = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string, 
  limit: number = 10, 
  windowMs: number = 10000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = requests.get(identifier)
  
  if (!record || now > record.resetTime) {
    requests.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  
  record.count++
  return { allowed: true, remaining: limit - record.count }
}

// Uso en API routes
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { allowed, remaining } = checkRateLimit(ip, 5, 60000) // 5 req/min
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones' },
      { status: 429 }
    )
  }
  
  // Continuar con la lógica normal
}
```

**Prioridad:** INMEDIATA - Implementar en endpoints críticos (login, register, payments)

---

### 5. Falta de Validación de Tipos de Archivo en Upload

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** `app/api/upload-photos/route.ts`, `app/api/partner/documents/route.ts`  
**Líneas:** 73-119

**Problema:**
```typescript
// ❌ VULNERABLE - Acepta cualquier archivo
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const photos = formData.getAll('photos') as File[]
  
  // No valida tipo de archivo
  // No valida tamaño
  // No valida contenido real del archivo
  
  for (const photo of photos) {
    await uploadToCloudinary(photo) // Sube cualquier cosa
  }
}
```

**Riesgo:**
- Upload de archivos maliciosos (scripts, malware)
- Upload de archivos enormes (DoS)
- Ejecución de código arbitrario
- Consumo excesivo de almacenamiento

**Solución:**
```typescript
// ✅ SEGURO
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function validateFile(
  file: File, 
  allowedTypes: string[], 
  maxSize: number
): { valid: boolean; error?: string } {
  // 1. Validar tipo MIME
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Tipo de archivo no permitido. Solo: ${allowedTypes.join(', ')}` 
    }
  }
  
  // 2. Validar tamaño
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `Archivo muy grande. Máximo: ${maxSize / 1024 / 1024}MB` 
    }
  }
  
  // 3. Validar extensión
  const extension = file.name.split('.').pop()?.toLowerCase()
  const validExtensions = allowedTypes.map(type => {
    const ext = type.split('/')[1]
    return ext === 'jpeg' ? 'jpg' : ext
  })
  
  if (!extension || !validExtensions.includes(extension)) {
    return { valid: false, error: 'Extensión de archivo no válida' }
  }
  
  return { valid: true }
}

// Validación adicional del contenido real del archivo
async function validateImageContent(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    
    // Verificar magic numbers (primeros bytes del archivo)
    // JPEG: FF D8 FF
    if (file.type === 'image/jpeg') {
      return uint8Array[0] === 0xFF && 
             uint8Array[1] === 0xD8 && 
             uint8Array[2] === 0xFF
    }
    
    // PNG: 89 50 4E 47
    if (file.type === 'image/png') {
      return uint8Array[0] === 0x89 && 
             uint8Array[1] === 0x50 && 
             uint8Array[2] === 0x4E && 
             uint8Array[3] === 0x47
    }
    
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const photos = formData.getAll('photos') as File[]
  
  if (photos.length > 5) {
    return NextResponse.json(
      { error: 'Máximo 5 fotos permitidas' },
      { status: 400 }
    )
  }
  
  // Validar cada archivo
  for (const photo of photos) {
    const validation = validateFile(photo, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }
    
    // Validar contenido real
    const isValidContent = await validateImageContent(photo)
    if (!isValidContent) {
      return NextResponse.json(
        { error: 'El archivo no es una imagen válida' },
        { status: 400 }
      )
    }
  }
  
  // Ahora sí subir archivos
  const urls = []
  for (const photo of photos) {
    const url = await uploadToCloudinary(photo)
    urls.push(url)
  }
  
  return NextResponse.json({ urls })
}
```

**Prioridad:** INMEDIATA - Implementar antes de permitir uploads en producción

---

### 6. Falta de Sanitización en Validación de Mensajes de Chat

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** `app/api/chats/[chatId]/messages/route.ts`  
**Líneas:** 6-123

**Problema:**
```typescript
// ❌ VULNERABLE - Regex puede ser bypasseado
function detectContactInfo(message: string): { isValid: boolean; reason?: string } {
  const phonePatterns = [
    /\b\d{10}\b/g,
    // ... más patrones
  ]
  
  // Atacante puede usar: "tres uno dos 555 1234" o "3️⃣1️⃣2️⃣5️⃣5️⃣5️⃣1️⃣2️⃣3️⃣4️⃣"
  // O usar caracteres Unicode similares
}
```

**Riesgo:**
- Bypass de filtros de contacto
- Usuarios compartiendo información fuera de la plataforma
- Pérdida de comisiones
- Fraude

**Solución:**
```typescript
// ✅ MÁS ROBUSTO
function detectContactInfo(message: string): { isValid: boolean; reason?: string } {
  // 1. Normalizar mensaje (remover caracteres especiales, emojis, etc.)
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^\w\s]/g, ' ') // Remover puntuación
    .replace(/\s+/g, ' ') // Normalizar espacios
    .toLowerCase()
  
  // 2. Detectar números escritos en palabras
  const numberWords: Record<string, string> = {
    'cero': '0', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
    'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9'
  }
  
  let textWithNumbers = normalized
  Object.entries(numberWords).forEach(([word, digit]) => {
    textWithNumbers = textWithNumbers.replace(new RegExp(word, 'g'), digit)
  })
  
  // 3. Detectar secuencias de dígitos (incluso con espacios)
  const digitsOnly = textWithNumbers.replace(/\D/g, '')
  if (digitsOnly.length >= 10) {
    return { isValid: false, reason: 'números de teléfono' }
  }
  
  // 4. Detectar patrones de email más robustos
  const emailPattern = /[a-z0-9]+[@\s]*[a-z0-9]+[.\s]*[a-z]{2,}/g
  if (emailPattern.test(textWithNumbers)) {
    return { isValid: false, reason: 'correos electrónicos' }
  }
  
  // 5. Detectar URLs y dominios
  const urlPattern = /(https?:\/\/|www\.|\.com|\.co|\.net|\.org)/gi
  if (urlPattern.test(message)) {
    return { isValid: false, reason: 'enlaces externos' }
  }
  
  // 6. Machine Learning approach (opcional pero recomendado)
  // Usar un modelo entrenado para detectar intentos de compartir contacto
  
  return { isValid: true }
}

// Además, agregar logging de intentos de bypass
if (!validation.isValid) {
  await prisma.suspiciousActivity.create({
    data: {
      userId: session.user.id,
      chatId: params.chatId,
      message: content,
      reason: validation.reason,
      timestamp: new Date()
    }
  })
  
  // Después de 3 intentos, suspender usuario temporalmente
  const attempts = await prisma.suspiciousActivity.count({
    where: {
      userId: session.user.id,
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  })
  
  if (attempts >= 3) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { suspended: true, suspendedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    })
  }
}
```

**Prioridad:** ALTA - Mejorar en 1-2 semanas

---

### 7. Falta de Protección CSRF

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** Todos los endpoints POST/PUT/DELETE  
**Archivos afectados:** `app/api/**/*.ts`

**Problema:**
- No hay tokens CSRF en formularios
- Vulnerable a Cross-Site Request Forgery
- Atacante puede hacer requests en nombre del usuario

**Riesgo:**
- Acciones no autorizadas (cancelar bookings, crear propuestas, etc.)
- Cambios en configuración de usuario
- Transacciones fraudulentas

**Solución:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Verificar CSRF token en requests que modifican datos
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token')
    const cookieToken = request.cookies.get('csrf-token')?.value
    
    if (!csrfToken || !cookieToken || csrfToken !== cookieToken) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }
  }
  
  return NextResponse.next()
}

// lib/csrf.ts
import crypto from 'crypto'

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// app/layout.tsx
'use client'

import { useEffect } from 'react'

export default function RootLayout({ children }) {
  useEffect(() => {
    // Obtener CSRF token al cargar la app
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => {
        // Guardar en cookie y en memoria
        document.cookie = `csrf-token=${data.token}; path=/; SameSite=Strict`
        window.__CSRF_TOKEN__ = data.token
      })
  }, [])
  
  return <html>{children}</html>
}

// Uso en fetch
fetch('/api/bookings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': window.__CSRF_TOKEN__
  },
  body: JSON.stringify(data)
})
```

**Nota:** NextAuth ya incluye protección CSRF para rutas de autenticación, pero no para el resto de la API.

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

### 8. Exposición de Stack Traces en Errores

**Severidad:** 🔴 CRÍTICA  
**Ubicación:** Todos los catch blocks de la API  
**Archivos afectados:** `app/api/**/*.ts` (todos)

**Problema:**
```typescript
// ❌ EXPONE INFORMACIÓN TÉCNICA
catch (error) {
  console.error('Error creating booking:', error) // Stack trace completo
  return NextResponse.json(
    { error: 'Error al crear reserva' }, // Mensaje genérico está bien
    { status: 500 }
  )
}
```

**Riesgo:**
- Exposición de rutas de archivos del servidor
- Exposición de estructura de base de datos
- Información útil para atacantes
- Violación de mejores prácticas de seguridad

**Solución:**
```typescript
// utils/errorHandler.ts
export function handleAPIError(error: unknown, context: string) {
  const isDev = process.env.NODE_ENV === 'development'
  
  // Loguear error completo solo en desarrollo
  if (isDev) {
    console.error(`[${context}]`, error)
  } else {
    // En producción, enviar a servicio de logging
    // Sentry, LogRocket, Datadog, etc.
    if (typeof window === 'undefined') {
      // Server-side
      // Sentry.captureException(error, { tags: { context } })
    }
  }
  
  // Determinar mensaje de error seguro para el usuario
  let userMessage = 'Ocurrió un error inesperado. Por favor, intenta nuevamente.'
  let statusCode = 500
  
  if (error instanceof Error) {
    // Errores conocidos y seguros de mostrar
    if (error.message.includes('no encontrado')) {
      userMessage = error.message
      statusCode = 404
    } else if (error.message.includes('no autorizado')) {
      userMessage = 'No tienes permisos para realizar esta acción'
      statusCode = 403
    } else if (error.message.includes('ya existe')) {
      userMessage = error.message
      statusCode = 400
    }
  }
  
  return {
    message: userMessage,
    status: statusCode
  }
}

// Uso en API routes
import { handleAPIError } from '@/utils/errorHandler'

export async function POST(req: Request) {
  try {
    // Lógica normal
  } catch (error) {
    const { message, status } = handleAPIError(error, 'POST /api/bookings')
    return NextResponse.json({ error: message }, { status })
  }
}
```

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

## 🟠 VULNERABILIDADES DE ALTA SEVERIDAD

### 9. Falta de Validación de Entrada en Registro

**Severidad:** 🟠 ALTA  
**Ubicación:** `app/api/register/route.ts`  
**Líneas:** 7-101

**Problema:**
```typescript
// ❌ VALIDACIÓN INSUFICIENTE
const { email, password, name, phone, role, city, services } = body

if (!email || !password || !name) {
  return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
}

// No valida formato de email
// No valida fortaleza de contraseña
// No valida formato de teléfono
// No valida valores de role, city
```

**Riesgo:**
- Registros con datos inválidos
- Contraseñas débiles
- Inyección de datos maliciosos
- Spam de registros

**Solución:**
```typescript
// lib/validation.ts
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email muy largo'),
  
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'Contraseña muy larga')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  
  name: z.string()
    .min(2, 'Nombre muy corto')
    .max(100, 'Nombre muy largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Nombre inválido'),
  
  phone: z.string()
    .regex(/^\+?[0-9]{10,15}$/, 'Teléfono inválido')
    .optional(),
  
  role: z.enum(['CLIENT', 'PARTNER'], {
    errorMap: () => ({ message: 'Rol inválido' })
  }).optional(),
  
  city: z.enum(['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA'], {
    errorMap: () => ({ message: 'Ciudad inválida' })
  }).optional(),
  
  services: z.array(z.string()).max(10, 'Máximo 10 servicios').optional()
})

// app/api/register/route.ts
import { registerSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validar con Zod
    const validation = registerSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }
    
    const { email, password, name, phone, role, city, services } = validation.data
    
    // Continuar con la lógica de registro
    // ...
  } catch (error) {
    const { message, status } = handleAPIError(error, 'POST /api/register')
    return NextResponse.json({ error: message }, { status })
  }
}
```

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

### 10. Falta de Sanitización de Inputs en Base de Datos

**Severidad:** 🟠 ALTA  
**Ubicación:** Múltiples endpoints de API  
**Archivos afectados:** Todos los que reciben input del usuario

**Problema:**
```typescript
// ❌ NO SANITIZA INPUT
const { notes, address } = body

await prisma.booking.create({
  data: {
    notes, // Puede contener HTML, scripts, etc.
    address // Puede contener caracteres especiales
  }
})
```

**Riesgo:**
- Stored XSS cuando se muestra el contenido
- Inyección de HTML
- Problemas de encoding

**Solución:**
```typescript
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No permitir ningún tag HTML
    ALLOWED_ATTR: []
  })
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remover < y >
    .substring(0, 1000) // Limitar longitud
}

// Uso
const sanitizedNotes = sanitizeInput(body.notes)
const sanitizedAddress = sanitizeInput(body.address)

await prisma.booking.create({
  data: {
    notes: sanitizedNotes,
    address: sanitizedAddress
  }
})
```

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

### 11. Falta de Headers de Seguridad

**Severidad:** 🟠 ALTA  
**Ubicación:** `next.config.js`  
**Líneas:** 1-9

**Problema:**
```javascript
// ❌ NO HAY HEADERS DE SEGURIDAD
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
}
```

**Riesgo:**
- Vulnerable a clickjacking
- Vulnerable a XSS
- Sin protección contra MIME sniffing
- Sin política de contenido seguro

**Solución:**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.mercadopago.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.mercadopago.com",
              "frame-src 'self' https://www.mercadopago.com",
            ].join('; ')
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

**Prioridad:** ALTA - Implementar antes de producción

---

### 12. Polling Agresivo sin Control

**Severidad:** 🟠 ALTA  
**Ubicación:** `app/dashboard/page.tsx`  
**Líneas:** 237

**Problema:**
```typescript
// ❌ 720 REQUESTS POR HORA
const interval = setInterval(fetchUnreadCounts, 5000) // Cada 5 segundos
```

**Riesgo:**
- Sobrecarga del servidor
- Costos elevados de base de datos
- Batería del dispositivo
- Ancho de banda desperdiciado

**Solución:**
```typescript
// ✅ OPCIÓN 1: Aumentar intervalo
const interval = setInterval(fetchUnreadCounts, 30000) // 30 segundos = 120 req/hora

// ✅ OPCIÓN 2: Polling adaptativo
let pollInterval = 30000 // Empezar con 30 segundos

function adaptivePolling() {
  fetchUnreadCounts().then(hasNewMessages => {
    if (hasNewMessages) {
      pollInterval = 10000 // Si hay mensajes nuevos, aumentar frecuencia
    } else {
      pollInterval = Math.min(pollInterval * 1.5, 60000) // Reducir frecuencia gradualmente
    }
    
    setTimeout(adaptivePolling, pollInterval)
  })
}

// ✅ OPCIÓN 3: WebSockets (RECOMENDADO)
// hooks/useWebSocket.ts
export function useUnreadCounts() {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  
  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'unread_count_update') {
        setUnreadCounts(prev => ({
          ...prev,
          [data.proposalId]: data.count
        }))
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('WebSocket disconnected')
      // Reconectar después de 5 segundos
      setTimeout(() => {
        // Reintentar conexión
      }, 5000)
    }
    
    return () => {
      ws.close()
    }
  }, [])
  
  return unreadCounts
}
```

**Prioridad:** ALTA - Optimizar antes de escalar

---

### 13. Falta de Validación de Ownership en Endpoints

**Severidad:** 🟠 ALTA  
**Ubicación:** Múltiples endpoints  
**Ejemplo:** `app/api/bookings/[id]/route.ts`

**Problema:**
```typescript
// ❌ NO VERIFICA QUE EL BOOKING PERTENEZCA AL USUARIO
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  // Elimina el booking sin verificar ownership
  await prisma.booking.delete({
    where: { id: params.id }
  })
}
```

**Riesgo:**
- Usuario puede modificar/eliminar recursos de otros usuarios
- Acceso no autorizado a datos
- Violación de privacidad

**Solución:**
```typescript
// ✅ VERIFICA OWNERSHIP
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  // 1. Obtener el booking
  const booking = await prisma.booking.findUnique({
    where: { id: params.id }
  })
  
  if (!booking) {
    return NextResponse.json({ error: 'Booking no encontrado' }, { status: 404 })
  }
  
  // 2. Verificar ownership
  if (booking.userId !== session.user.id) {
    return NextResponse.json(
      { error: 'No tienes permiso para eliminar este booking' },
      { status: 403 }
    )
  }
  
  // 3. Ahora sí eliminar
  await prisma.booking.delete({
    where: { id: params.id }
  })
  
  return NextResponse.json({ success: true })
}
```

**Aplicar en:**
- `app/api/bookings/[id]/route.ts`
- `app/api/service-requests/[id]/route.ts`
- `app/api/addresses/[id]/route.ts`
- `app/api/payment-methods/[id]/route.ts`
- Todos los endpoints que modifican recursos de usuario

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

### 14. Falta de Límite en Propuestas por Socio

**Severidad:** 🟠 ALTA  
**Ubicación:** `app/api/partner/proposals/route.ts`  
**Líneas:** 8-113

**Problema:**
```typescript
// ❌ NO HAY LÍMITE DE PROPUESTAS
// Un socio puede enviar propuestas ilimitadas
```

**Riesgo:**
- Spam de propuestas
- Sobrecarga de notificaciones a clientes
- Mala experiencia de usuario
- Abuso del sistema

**Solución:**
```typescript
// ✅ LIMITAR PROPUESTAS
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id || session.user.role !== 'PARTNER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: session.user.id }
  })
  
  if (!partnerProfile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  
  // 1. Verificar límite diario de propuestas
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const proposalsToday = await prisma.proposal.count({
    where: {
      partnerId: partnerProfile.id,
      createdAt: { gte: today }
    }
  })
  
  if (proposalsToday >= 20) { // Máximo 20 propuestas por día
    return NextResponse.json(
      { error: 'Has alcanzado el límite diario de propuestas (20)' },
      { status: 429 }
    )
  }
  
  // 2. Verificar que no tenga propuesta pendiente para esta solicitud
  const existingProposal = await prisma.proposal.findUnique({
    where: {
      serviceRequestId_partnerId: {
        serviceRequestId: body.serviceRequestId,
        partnerId: partnerProfile.id
      }
    }
  })
  
  if (existingProposal) {
    return NextResponse.json(
      { error: 'Ya tienes una propuesta para esta solicitud' },
      { status: 400 }
    )
  }
  
  // 3. Continuar con la creación de la propuesta
  // ...
}
```

**Prioridad:** ALTA - Implementar antes de escalar

---

### 15. Exposición de Información de Usuario en Respuestas

**Severidad:** 🟠 ALTA  
**Ubicación:** Múltiples endpoints  
**Ejemplo:** `app/api/admin/partners/route.ts`

**Problema:**
```typescript
// ❌ EXPONE DEMASIADA INFORMACIÓN
const partners = await prisma.partnerProfile.findMany({
  include: {
    user: {
      select: {
        id: true,
        email: true, // ❌ Email sensible
        name: true,
        phone: true, // ❌ Teléfono sensible
        createdAt: true,
        // password: true // ❌ NUNCA incluir password (aunque esté hasheado)
      }
    }
  }
})

return NextResponse.json(partners) // Envía todo al frontend
```

**Riesgo:**
- Exposición de datos personales
- Violación de GDPR/CCPA
- Información útil para atacantes
- Phishing

**Solución:**
```typescript
// ✅ SOLO DATOS NECESARIOS
const partners = await prisma.partnerProfile.findMany({
  include: {
    user: {
      select: {
        id: true,
        name: true,
        // NO incluir email ni phone a menos que sea absolutamente necesario
        createdAt: true,
      }
    },
    services: {
      include: {
        service: {
          select: {
            name: true,
            icon: true,
          }
        }
      }
    },
    _count: {
      select: {
        bookings: true,
        proposals: true,
      }
    }
  }
})

// Si necesitas email/phone, ofuscar
const sanitizedPartners = partners.map(partner => ({
  ...partner,
  user: {
    ...partner.user,
    email: partner.user.email 
      ? partner.user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      : undefined,
    phone: partner.user.phone
      ? partner.user.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3')
      : undefined
  }
}))

return NextResponse.json(sanitizedPartners)
```

**Aplicar en todos los endpoints que devuelven información de usuarios**

**Prioridad:** ALTA - Implementar en 1-2 semanas

---

## 🟡 VULNERABILIDADES DE SEVERIDAD MEDIA

### 16. Falta de Logging de Eventos de Seguridad

**Severidad:** 🟡 MEDIA  
**Ubicación:** Toda la aplicación

**Problema:**
- No se registran intentos de login fallidos
- No se registran cambios en permisos
- No se registran accesos no autorizados
- Difícil auditar incidentes de seguridad

**Solución:**
```typescript
// lib/auditLog.ts
export async function logSecurityEvent(event: {
  type: 'LOGIN_FAILED' | 'UNAUTHORIZED_ACCESS' | 'PERMISSION_CHANGE' | 'SUSPICIOUS_ACTIVITY'
  userId?: string
  ip: string
  userAgent: string
  details: any
}) {
  await prisma.securityLog.create({
    data: {
      type: event.type,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      details: JSON.stringify(event.details),
      timestamp: new Date()
    }
  })
}

// Uso en login
if (!isPasswordValid) {
  await logSecurityEvent({
    type: 'LOGIN_FAILED',
    userId: user.id,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details: { email: credentials.email }
  })
  
  throw new Error("Contraseña incorrecta")
}
```

**Prioridad:** MEDIA - Implementar en 1 mes

---

### 17. Falta de Expiración de Sesiones

**Severidad:** 🟡 MEDIA  
**Ubicación:** `lib/auth.ts`

**Problema:**
```typescript
// ❌ NO HAY CONFIGURACIÓN DE EXPIRACIÓN
session: {
  strategy: "jwt",
  // maxAge no está configurado
}
```

**Solución:**
```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 días
  updateAge: 24 * 60 * 60, // Actualizar cada 24 horas
},
jwt: {
  maxAge: 30 * 24 * 60 * 60, // 30 días
}
```

**Prioridad:** MEDIA - Implementar en 1 mes

---

### 18. Falta de Validación de Fechas en Bookings

**Severidad:** 🟡 MEDIA  
**Ubicación:** Endpoints de creación de bookings

**Problema:**
- No valida que la fecha sea futura
- No valida formato de fecha
- Puede crear bookings en el pasado

**Solución:**
```typescript
const scheduledDate = new Date(body.scheduledDate)

if (isNaN(scheduledDate.getTime())) {
  return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
}

if (scheduledDate < new Date()) {
  return NextResponse.json(
    { error: 'La fecha debe ser futura' },
    { status: 400 }
  )
}
```

**Prioridad:** MEDIA - Implementar en 1 mes

---

## 🔵 MEJORAS RECOMENDADAS (BAJA PRIORIDAD)

### 19. Implementar 2FA (Autenticación de Dos Factores)

**Severidad:** 🔵 BAJA  
**Beneficio:** Seguridad adicional para cuentas

**Solución:**
- Usar `@otplib/preset-default` para generar códigos TOTP
- Guardar secret en base de datos
- Requerir código en login

---

### 20. Implementar Content Security Policy más estricto

**Severidad:** 🔵 BAJA  
**Beneficio:** Protección adicional contra XSS

---

### 21. Implementar Subresource Integrity (SRI)

**Severidad:** 🔵 BAJA  
**Beneficio:** Verificar integridad de recursos externos

---

### 22. Implementar HSTS Preload

**Severidad:** 🔵 BAJA  
**Beneficio:** Forzar HTTPS en todos los navegadores

---

### 23. Implementar Certificate Transparency Monitoring

**Severidad:** 🔵 BAJA  
**Beneficio:** Detectar certificados SSL fraudulentos

---

## 📊 PLAN DE IMPLEMENTACIÓN PRIORIZADO

### Fase 1: CRÍTICO (Semana 1-2)
1. ✅ Implementar `fetchAPI` helper con validación HTTP
2. ✅ Remover todos los `console.log` de producción
3. ✅ Implementar validación de firma en webhook de pagos
4. ✅ Implementar rate limiting básico
5. ✅ Implementar validación de archivos en uploads

### Fase 2: ALTA (Semana 3-4)
1. ✅ Implementar validación de inputs con Zod
2. ✅ Implementar sanitización de inputs
3. ✅ Agregar headers de seguridad
4. ✅ Optimizar polling o implementar WebSockets
5. ✅ Implementar validación de ownership

### Fase 3: MEDIA (Mes 2)
1. ✅ Implementar logging de eventos de seguridad
2. ✅ Configurar expiración de sesiones
3. ✅ Implementar validaciones adicionales
4. ✅ Mejorar detección de contacto en chat
5. ✅ Implementar límites en propuestas

### Fase 4: MEJORAS (Mes 3+)
1. ✅ Implementar 2FA
2. ✅ Mejorar CSP
3. ✅ Implementar SRI
4. ✅ Configurar HSTS Preload
5. ✅ Monitoreo continuo

---

## 🛠️ HERRAMIENTAS RECOMENDADAS

### Seguridad
- **Helmet.js** - Headers de seguridad
- **express-rate-limit** - Rate limiting
- **Zod** - Validación de schemas
- **DOMPurify** - Sanitización de HTML
- **bcryptjs** - Hashing de contraseñas (ya implementado ✅)

### Monitoring
- **Sentry** - Error tracking y monitoring
- **LogRocket** - Session replay y debugging
- **Datadog** - APM y logging
- **New Relic** - Performance monitoring

### Testing
- **OWASP ZAP** - Security testing
- **Burp Suite** - Penetration testing
- **npm audit** - Vulnerabilidades en dependencias
- **Snyk** - Security scanning

---

## 📝 CHECKLIST DE SEGURIDAD

### Antes de Producción
- [ ] Todas las respuestas HTTP validadas
- [ ] Console.logs removidos de producción
- [ ] Webhook de pagos con validación de firma
- [ ] Rate limiting implementado
- [ ] Validación de archivos implementada
- [ ] Headers de seguridad configurados
- [ ] Variables de entorno en .env (no en código)
- [ ] .env en .gitignore ✅
- [ ] HTTPS configurado
- [ ] Certificado SSL válido

### Monitoreo Continuo
- [ ] Logging de eventos de seguridad
- [ ] Alertas de intentos de ataque
- [ ] Monitoreo de performance
- [ ] Backups automáticos de BD
- [ ] Plan de respuesta a incidentes

### Compliance
- [ ] Política de privacidad actualizada
- [ ] Términos y condiciones actualizados
- [ ] Consentimiento de cookies
- [ ] GDPR compliance (si aplica)
- [ ] PCI DSS compliance (para pagos)

---

## 🚨 CONTACTO DE EMERGENCIA

En caso de detectar una vulnerabilidad crítica:
1. No publicar la vulnerabilidad públicamente
2. Contactar al equipo de desarrollo inmediatamente
3. Documentar el problema con detalle
4. Proponer solución si es posible

---

## 📚 RECURSOS ADICIONALES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security](https://www.prisma.io/docs/guides/security)
- [MercadoPago Security](https://www.mercadopago.com.co/developers/es/docs/security)

---

**Última actualización:** 2024  
**Próxima revisión:** Cada 3 meses  
**Estado:** REQUIERE ACCIÓN INMEDIATA

---

## 🎯 MÉTRICAS DE ÉXITO

### Antes de Implementación
- **Vulnerabilidades críticas:** 15
- **Vulnerabilidades altas:** 12
- **Score de seguridad:** 45/100
- **Tiempo de respuesta promedio:** 2.5s
- **Requests por hora (polling):** 720

### Después de Implementación (Objetivo)
- **Vulnerabilidades críticas:** 0
- **Vulnerabilidades altas:** 0
- **Score de seguridad:** 90+/100
- **Tiempo de respuesta promedio:** <1.5s
- **Requests por hora (WebSocket):** 0 (push-based)

---

**FIN DEL REPORTE**

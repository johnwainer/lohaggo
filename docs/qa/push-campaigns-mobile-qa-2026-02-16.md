# QA Report - PUSH Campaigns + Mobile Notifications

Fecha: 2026-02-16

## Alcance
- Canal `PUSH` en campañas de comunicaciones de admin.
- Envío de notificaciones push para eventos críticos (pagos, reservas, chats, documentos).
- Comportamiento de click en notificaciones en PWA móvil.

## Validación automática ejecutada

1. Build y tipado de producción
- Comando: `npm run build`
- Resultado: **PASS**
- Se validó compilación de:
  - `app/api/admin/messaging/*`
  - `app/api/payouts/process`
  - `app/api/payments/webhook`
  - `app/api/chats/[chatId]/messages`
  - `public/sw.js`
  - `prisma/schema.prisma`

2. Prisma actualizado
- Comandos:
  - `npx prisma format`
  - `npx prisma generate`
- Resultado: **PASS**

3. Verificación de arquitectura de notificaciones
- Resultado: **PASS**
- Hallazgo:
  - No quedan llamadas directas a `prisma.notification.create` fuera de `lib/notifications/notificationService.ts`.
  - Eventos de pagos/chats/documentos/payouts ahora pasan por `createNotification`, activando push cuando aplica.

## Cambios validados

- Canal PUSH agregado en modelo:
  - `prisma/schema.prisma` (`MessagingChannel.PUSH`)
- SQL idempotente para agregar valor enum en DB:
  - `docs/sql/admin_messaging.sql`
- Envío PUSH en campañas:
  - `lib/messaging/providers.ts`
  - `lib/messaging/campaign-service.ts`
- UI admin de comunicaciones con opción PUSH:
  - `app/admin/communications/page.tsx`
- Ruteo de click móvil en notificación:
  - `public/sw.js` (`targetUrl`, `NEW_MESSAGE`, `CAMPAIGN_PUSH`)
- Eventos de negocio con push habilitado vía `createNotification`:
  - `app/api/payments/webhook/route.ts`
  - `app/api/payouts/process/route.ts`
  - `app/api/chats/[chatId]/messages/route.ts`
  - `app/api/admin/documents/review/route.ts`
  - `app/api/admin/documents/background/route.ts`
  - `app/api/partner/documents/route.ts`

## Bloqueo de QA E2E autenticado en este entorno
- Scripts:
  - `npm run qa:protected-nav`
  - `npm run qa:admin-sidebar`
- Estado: **NO EJECUTABLES** en este entorno por falta de variables:
  - `QA_CLIENT_EMAIL`, `QA_CLIENT_PASSWORD`
  - `QA_PARTNER_EMAIL`, `QA_PARTNER_PASSWORD`
  - `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`

## Checklist final en celular real (obligatorio antes de cerrar release)

1. Cliente (PWA instalada + push permitido)
- Recibir propuesta -> notificación push visible.
- Cambio de estado de reserva -> push visible.
- Click en push -> abre app y navega correctamente.

2. Socio (PWA instalada + push permitido)
- Nueva solicitud/propuesta/chat -> push visible.
- Validar que `NEW_MESSAGE` abre contexto útil (notificaciones o vista esperada).

3. Admin campañas PUSH
- Crear campaña canal `PUSH`.
- Ejecutar envío.
- Ver en tabla métricas `SENT/FAILED`.
- Confirmar recepción en dispositivos de prueba.

4. Robustez
- Usuario sin suscripción push no rompe campaña; queda delivery fallido trazable.
- Suscripción expirada elimina `pushSubscription` y no vuelve a fallar en loop.


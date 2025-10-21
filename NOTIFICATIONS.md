# Sistema de Notificaciones Push

## Descripción

Sistema completo de notificaciones bidireccionales entre clientes y socios con notificaciones push en tiempo real.

## Características

### ✅ Notificaciones en Base de Datos
- Todas las notificaciones se guardan en la base de datos
- Historial completo de notificaciones
- Estado de lectura/no lectura
- Filtrado por tipo y estado

### ✅ Notificaciones Push (Web Push)
- Notificaciones push del navegador en tiempo real
- Funciona incluso cuando la aplicación está cerrada
- Compatible con Chrome, Firefox, Edge, Safari

### ✅ Eventos que Generan Notificaciones

#### Para Socios (Partners):
1. **Nueva Solicitud de Servicio** - Cuando un cliente crea una solicitud de servicio que coincide con los servicios del socio
2. **Propuesta Aceptada** - Cuando un cliente acepta la propuesta del socio
3. **Propuesta Rechazada** - Cuando un cliente rechaza la propuesta del socio
4. **Reserva Cancelada** - Cuando un cliente cancela una reserva

#### Para Clientes:
1. **Nueva Propuesta** - Cuando un socio envía una propuesta para su solicitud
2. **Reserva Confirmada** - Cuando el socio confirma la reserva
3. **Reserva Cancelada** - Cuando el socio cancela la reserva
4. **Servicio en Progreso** - Cuando el socio inicia el servicio
5. **Servicio Completado** - Cuando el socio completa el servicio

## Componentes

### 1. Base de Datos
- **Modelo Notification**: Almacena todas las notificaciones
- **Campo pushSubscription en User**: Guarda la suscripción push del usuario

### 2. APIs
- `GET /api/notifications` - Obtener notificaciones del usuario
- `PATCH /api/notifications` - Marcar notificaciones como leídas
- `POST /api/notifications/subscribe` - Suscribirse a push notifications

### 3. Service Worker (`public/sw.js`)
- Maneja las notificaciones push del navegador
- Muestra notificaciones incluso cuando la app está cerrada
- Gestiona clicks en notificaciones

### 4. Componentes React
- **NotificationBell**: Campana de notificaciones en el header
- **NotificationsPage**: Página completa de notificaciones
- **usePushNotifications**: Hook para gestionar suscripciones push

### 5. Servicio de Notificaciones (`lib/notifications/notificationService.ts`)
- Funciones para crear notificaciones
- Envío automático de push notifications
- Integración con eventos del sistema

## Uso

### Para Usuarios

1. **Ver Notificaciones**:
   - Click en el ícono de campana en el header
   - O visitar `/notifications`

2. **Activar Push Notifications**:
   - Ir a `/notifications`
   - Click en "Activar notificaciones push"
   - Aceptar el permiso del navegador

3. **Marcar como Leídas**:
   - Click en una notificación individual
   - O usar "Marcar todas como leídas"

### Para Desarrolladores

#### Crear una Notificación Personalizada

```typescript
import { createNotification } from '@/lib/notifications/notificationService'

await createNotification({
  userId: 'user-id',
  type: 'NEW_SERVICE_REQUEST',
  title: 'Título de la notificación',
  message: 'Mensaje descriptivo',
  data: { // Datos adicionales opcionales
    serviceId: 'service-id',
    customField: 'valor'
  }
})
```

#### Tipos de Notificaciones Disponibles

```typescript
type NotificationType =
  | "NEW_SERVICE_REQUEST"
  | "NEW_PROPOSAL"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_IN_PROGRESS"
  | "BOOKING_COMPLETED"
```

## Configuración

### Variables de Entorno

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-clave-publica-vapid"
VAPID_PRIVATE_KEY="tu-clave-privada-vapid"
```

Las claves VAPID ya están generadas y configuradas en el archivo `.env`.

### Generar Nuevas Claves VAPID (Opcional)

```bash
node -e "const webpush = require('web-push'); const vapidKeys = webpush.generateVAPIDKeys(); console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey); console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);"
```

## Flujo de Notificaciones

### Ejemplo: Cliente Crea Solicitud de Servicio

1. Cliente crea solicitud en `/servicios/[slug]`
2. API `POST /api/service-requests` crea la solicitud
3. Se llama a `notifyNewServiceRequest(serviceRequestId)`
4. Sistema busca todos los socios que ofrecen ese servicio
5. Para cada socio:
   - Crea notificación en BD
   - Envía push notification al navegador
6. Socio recibe notificación instantánea
7. Socio puede ver detalles en `/partner`

### Ejemplo: Socio Envía Propuesta

1. Socio envía propuesta desde `/partner`
2. API `POST /api/proposals` crea la propuesta
3. Se llama a `notifyNewProposal(proposalId)`
4. Sistema crea notificación para el cliente
5. Envía push notification al cliente
6. Cliente recibe notificación instantánea
7. Cliente puede ver propuesta en `/dashboard`

## Pruebas

### Probar Notificaciones Localmente

1. **Iniciar sesión como cliente**:
   ```
   Email: john@example.com
   Password: password123
   ```

2. **Activar push notifications** en `/notifications`

3. **Crear una solicitud de servicio**

4. **Iniciar sesión como socio** (en otra ventana/navegador):
   ```
   Email: jvalencia@pasosalexito.com
   Password: password123
   ```

5. **Verificar que el socio recibió la notificación**

6. **Enviar una propuesta como socio**

7. **Verificar que el cliente recibió la notificación**

## Troubleshooting

### Las notificaciones push no funcionan

1. **Verificar permisos del navegador**:
   - Chrome: Configuración > Privacidad y seguridad > Configuración de sitios > Notificaciones
   - Asegurarse de que el sitio tiene permiso

2. **Verificar que el service worker está registrado**:
   - Abrir DevTools > Application > Service Workers
   - Debe aparecer `/sw.js` como activo

3. **Verificar claves VAPID**:
   - Asegurarse de que las variables de entorno están configuradas
   - Reiniciar el servidor después de cambiar `.env`

### Las notificaciones no aparecen en la campana

1. **Verificar en la consola del navegador**:
   - Buscar errores en la llamada a `/api/notifications`

2. **Verificar que el usuario está autenticado**:
   - Las notificaciones solo funcionan para usuarios logueados

3. **Refrescar la página**:
   - La campana se actualiza cada 30 segundos automáticamente

## Mejoras Futuras

- [ ] Notificaciones por email
- [ ] Notificaciones por SMS
- [ ] Configuración de preferencias de notificaciones
- [ ] Agrupar notificaciones similares
- [ ] Notificaciones de recordatorio
- [ ] Estadísticas de notificaciones

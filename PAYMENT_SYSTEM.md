# Sistema de Pagos con MercadoPago

## Configuración Inicial

### 1. Variables de Entorno

Agregar a `.env`:

```env
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_aqui
MERCADOPAGO_PUBLIC_KEY=tu_public_key_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Ejecutar Migraciones

```bash
npx prisma generate
npx prisma db push
```

### 3. Instalar Dependencias

```bash
npm install
```

## Configuración de MercadoPago

### Obtener Credenciales

1. Ir a [MercadoPago Developers](https://www.mercadopago.com.co/developers)
2. Crear una aplicación
3. Obtener el Access Token y Public Key
4. Para pruebas, usar las credenciales de TEST
5. Para producción, usar las credenciales de PRODUCCIÓN

### Configurar Webhook

1. En el panel de MercadoPago, ir a "Webhooks"
2. Agregar la URL: `https://tu-dominio.com/api/payments/webhook`
3. Seleccionar eventos: `payment`
4. Guardar configuración

## Uso del Sistema

### Para Administradores

#### Configurar Comisiones

1. Ir al panel de administración
2. Seleccionar "Comisiones" en el menú lateral
3. Configurar:
   - **Comisión del Cliente**: Porcentaje que se cobra al cliente sobre el precio del servicio
   - **Comisión del Socio**: Porcentaje que se retiene del pago al socio
4. Guardar cambios

#### Gestionar Pagos a Socios

1. Ir a "Pagos a Socios" en el menú lateral
2. Ver lista de pagos pendientes
3. Filtrar por socio o estado
4. Procesar pagos individuales o en lote

### Para Clientes

#### Realizar un Pago

1. Crear una reserva de servicio
2. En la página de la reserva, hacer clic en "Pagar"
3. Ver el desglose del pago:
   - Precio del servicio
   - Comisión de plataforma
   - Total a pagar
4. Hacer clic en "Continuar al Pago"
5. Completar el pago en MercadoPago
6. Regresar a la aplicación

#### Verificar Estado del Pago

- El estado del pago se actualiza automáticamente
- Estados posibles:
  - **Pendiente**: Pago iniciado pero no completado
  - **Aprobado**: Pago exitoso
  - **Rechazado**: Pago fallido
  - **Cancelado**: Pago cancelado por el usuario

### Para Socios

#### Ver Pagos Pendientes

1. Ir al dashboard de socio
2. Ver sección "Pagos Pendientes"
3. Ver desglose:
   - Monto del servicio
   - Comisión de plataforma
   - Monto neto a recibir

#### Recibir Pagos

- Los pagos son procesados por el administrador
- Se recibe notificación cuando el pago es procesado
- El monto incluye la deducción de la comisión

## Flujo de Pago

### 1. Cliente Inicia Pago

```
Cliente → API /payments/create → MercadoPago
```

- Se calcula la comisión del cliente
- Se crea un registro de pago en la BD
- Se genera una preferencia de pago en MercadoPago
- Cliente es redirigido a MercadoPago

### 2. Cliente Completa Pago

```
MercadoPago → Webhook /payments/webhook → Sistema
```

- MercadoPago notifica el resultado del pago
- Sistema actualiza el estado del pago
- Si es aprobado:
  - Se confirma la reserva
  - Se crea un registro de pago pendiente para el socio
  - Se envían notificaciones

### 3. Administrador Procesa Pago al Socio

```
Admin → API /payouts/process → Sistema
```

- Se calcula la comisión del socio
- Se actualiza el estado del payout
- Se envía notificación al socio

## Modelos de Base de Datos

### PlatformConfig

Configuración global de comisiones:

```prisma
model PlatformConfig {
  id                  String   @id @default(cuid())
  clientCommissionRate Float   @default(5.0)
  partnerCommissionRate Float  @default(10.0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### Payment

Registro de pagos de clientes:

```prisma
model Payment {
  id                    String        @id @default(cuid())
  bookingId             String        @unique
  userId                String
  mercadoPagoId         String?       @unique
  preferenceId          String?
  status                PaymentStatus @default(PENDING)
  serviceAmount         Float
  clientCommission      Float
  clientCommissionRate  Float
  totalAmount           Float
  paidAt                DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
}
```

### Payout

Registro de pagos a socios:

```prisma
model Payout {
  id                    String       @id @default(cuid())
  paymentId             String
  partnerId             String
  serviceAmount         Float
  partnerCommission     Float
  partnerCommissionRate Float
  netAmount             Float
  status                PayoutStatus @default(PENDING)
  processedAt           DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
}
```

## API Endpoints

### Configuración de Comisiones

- **GET** `/api/admin/commission-config` - Obtener configuración actual
- **PUT** `/api/admin/commission-config` - Actualizar configuración

### Pagos

- **POST** `/api/payments/create` - Crear pago con MercadoPago
- **POST** `/api/payments/webhook` - Webhook de MercadoPago
- **GET** `/api/payments/status` - Obtener estado de un pago

### Pagos a Socios

- **GET** `/api/payouts/list` - Listar pagos pendientes
- **POST** `/api/payouts/process` - Procesar pago a socio

## Componentes UI

### PaymentButton

Botón para iniciar el proceso de pago:

```tsx
<PaymentButton
  bookingId="booking_id"
  amount={100000}
  serviceName="Nombre del Servicio"
  onSuccess={() => console.log('Pago exitoso')}
/>
```

### PaymentStatus

Mostrar el estado de un pago:

```tsx
<PaymentStatus bookingId="booking_id" />
```

### CommissionsSection

Panel de administración para configurar comisiones (solo admin).

### PayoutsSection

Panel de administración para gestionar pagos a socios (solo admin).

## Seguridad

### Validación de Webhook

El webhook de MercadoPago debe validarse para asegurar que las notificaciones son legítimas:

1. Verificar la firma de la solicitud (implementar según documentación de MercadoPago)
2. Validar que el pago existe en la BD
3. Verificar que el estado no ha sido actualizado previamente

### Permisos

- Solo administradores pueden:
  - Configurar comisiones
  - Ver todos los pagos
  - Procesar pagos a socios
- Los clientes solo pueden ver sus propios pagos
- Los socios solo pueden ver sus propios pagos pendientes

## Pruebas

### Tarjetas de Prueba (MercadoPago)

Para ambiente de pruebas:

- **Aprobado**: 5031 7557 3453 0604
- **Rechazado**: 5031 4332 1540 6351
- **Pendiente**: 5031 4332 1540 6351

CVV: 123
Fecha: Cualquier fecha futura

### Flujo de Prueba

1. Configurar comisiones en el panel de admin
2. Crear una reserva como cliente
3. Iniciar pago con tarjeta de prueba
4. Verificar que el webhook actualiza el estado
5. Como admin, procesar el pago al socio
6. Verificar notificaciones

## Troubleshooting

### El webhook no se ejecuta

- Verificar que la URL del webhook está configurada en MercadoPago
- Verificar que la URL es accesible públicamente (usar ngrok para desarrollo local)
- Revisar logs del servidor

### El pago no se actualiza

- Verificar que el webhook está recibiendo notificaciones
- Revisar logs de la API
- Verificar que el `mercadoPagoId` coincide

### Error al crear el pago

- Verificar que las credenciales de MercadoPago son correctas
- Verificar que la reserva existe y está en estado válido
- Revisar logs de la API

## Próximos Pasos

1. Implementar validación de firma del webhook
2. Agregar soporte para múltiples métodos de pago
3. Implementar reembolsos
4. Agregar reportes de pagos
5. Implementar pagos recurrentes
6. Agregar soporte para múltiples monedas

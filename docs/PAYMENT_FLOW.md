# Flujo de Pagos - Sistema de Servicios

## Resumen del Flujo

El sistema maneja pagos con comisiones tanto para clientes como para socios, generando ingresos para la plataforma de ambas partes.

## Ejemplo Práctico

### Escenario:
- **Valor del Servicio**: $100,000 COP
- **Comisión Cliente**: 5%
- **Comisión Socio**: 20%

### Cálculos:

#### 1. Lo que paga el Cliente:
```
Valor del Servicio:     $100,000
Comisión Cliente (5%):  $  5,000
─────────────────────────────────
Total a Pagar:          $105,000
```

#### 2. Lo que recibe el Socio:
```
Valor del Servicio:     $100,000
Comisión Socio (20%):   $ 20,000
─────────────────────────────────
Pago Neto al Socio:     $ 80,000
```

#### 3. Ganancia de la Plataforma:
```
Comisión Cliente:       $  5,000
Comisión Socio:         $ 20,000
─────────────────────────────────
Ganancia Total:         $ 25,000
```

## Estructura de Datos

### Modelo Payment
```typescript
{
  serviceAmount: 100000,        // Valor base del servicio
  clientCommission: 5000,       // 5% cobrado al cliente
  clientCommissionRate: 5.0,    // Porcentaje de comisión cliente
  totalAmount: 105000,          // Total que paga el cliente
  status: 'APPROVED'
}
```

### Modelo Payout
```typescript
{
  amount: 100000,               // Valor del servicio
  partnerCommission: 20000,     // 20% retenido por la plataforma
  partnerCommissionRate: 20.0,  // Porcentaje de comisión socio
  netAmount: 80000,             // Monto neto que recibe el socio
  status: 'PENDING'
}
```

## Flujo Técnico

### 1. Creación del Pago (`/api/payments/create`)
```javascript
// Obtener configuración de comisiones
const config = await prisma.platformConfig.findFirst()
const clientCommissionRate = config?.clientCommissionRate || 5.0

// Calcular montos
const serviceAmount = booking.totalPrice
const clientCommission = (serviceAmount * clientCommissionRate) / 100
const totalAmount = serviceAmount + clientCommission

// Crear preferencia de MercadoPago con el total
const preference = await mercadopago.preference.create({
  items: [{
    unit_price: totalAmount,  // Cliente paga servicio + comisión
    ...
  }]
})
```

### 2. Webhook de MercadoPago (`/api/payments/webhook`)
```javascript
// Cuando el pago es aprobado
if (payment.status === 'approved') {
  // Actualizar estado del pago
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'APPROVED' }
  })
  
  // Crear payout para el socio
  const config = await prisma.platformConfig.findFirst()
  const partnerCommissionRate = config?.partnerCommissionRate || 20.0
  const serviceAmount = payment.serviceAmount
  const partnerCommission = (serviceAmount * partnerCommissionRate) / 100
  const netAmount = serviceAmount - partnerCommission
  
  await prisma.payout.create({
    data: {
      paymentId: payment.id,
      partnerId: booking.partnerId,
      amount: serviceAmount,
      partnerCommission,
      partnerCommissionRate,
      netAmount,
      status: 'PENDING'
    }
  })
}
```

### 3. Vista en el Admin (`/admin` - Sección Pagos)

El panel de administración muestra:

#### Tarjetas de Resumen:
- **Total Pagos**: Cantidad total de transacciones
- **Pendientes**: Pagos en espera con monto total
- **Aprobados**: Pagos confirmados con monto total
- **Comisión Clientes**: Suma de todas las comisiones cobradas a clientes
- **Ganancia Total**: Suma de comisiones de clientes + socios

#### Tabla Detallada:
Para cada pago muestra:
- Cliente (nombre y email)
- Servicio contratado
- Socio asignado
- **Valor Servicio**: Monto base ($100,000)
- **Comisión Cliente**: Monto y porcentaje ($5,000 - 5%)
- **Total Cobrado**: Lo que pagó el cliente ($105,000)
- **Comisión Socio**: Monto y porcentaje ($20,000 - 20%)
- **Pago a Socio**: Lo que recibe el socio ($80,000)
- **Ganancia App**: Suma de ambas comisiones ($25,000)
- Estado del pago
- Fecha de pago

## Configuración de Comisiones

Las tasas de comisión se configuran en el modelo `PlatformConfig`:

```typescript
{
  clientCommissionRate: 5.0,    // 5% cobrado al cliente
  partnerCommissionRate: 20.0,  // 20% retenido del socio
}
```

Estas tasas pueden ser modificadas desde el panel de administración en la sección de Configuración.

## Estados de Pago

### Payment Status:
- `PENDING`: Pago iniciado pero no completado
- `APPROVED`: Pago confirmado por MercadoPago
- `REJECTED`: Pago rechazado
- `CANCELLED`: Pago cancelado

### Payout Status:
- `PENDING`: Pendiente de procesamiento
- `PROCESSING`: En proceso de pago
- `COMPLETED`: Pagado al socio
- `FAILED`: Fallo en el pago
- `CANCELLED`: Cancelado

## Endpoints de API

### Para Clientes:
- `POST /api/payments/create` - Crear preferencia de pago
- `GET /api/payments/status/:bookingId` - Consultar estado de pago

### Para Administradores:
- `GET /api/admin/payments` - Listar todos los pagos
- `GET /api/admin/payments?status=APPROVED` - Filtrar por estado

### Webhooks:
- `POST /api/payments/webhook` - Recibir notificaciones de MercadoPago

## Seguridad

- Todos los endpoints requieren autenticación
- Los endpoints de admin requieren rol `ADMIN`
- Los webhooks validan la firma de MercadoPago
- Las comisiones se calculan en el servidor (nunca en el cliente)

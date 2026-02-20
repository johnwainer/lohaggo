# QA Visual y Usabilidad - Estados de Servicio (Cliente/Socio)

## Alcance
Validar consistencia visual, jerarquía de acciones y secuencia de estado en:
- Cliente: `/dashboard` (Mis Reservas)
- Socio: `/partner` (Mis Reservas)
- Dispositivos: Mobile (375x812), Tablet, Desktop

## 1. Sistema único de estados visuales
- [ ] `PENDING` usa mismo color/etiqueta en cliente y socio
- [ ] `CONFIRMED` usa mismo color/etiqueta en cliente y socio
- [ ] `IN_PROGRESS` usa mismo color/etiqueta en cliente y socio
- [ ] `COMPLETED` usa mismo color/etiqueta en cliente y socio
- [ ] `CANCELLED` usa mismo color/etiqueta en cliente y socio
- [ ] `PAID` se muestra correctamente en cliente
- [ ] `RATED` se muestra correctamente en cliente y socio

## 2. Estructura base de card
- [ ] Línea 1: badge de estado + tiempo relativo
- [ ] Línea 2: servicio + contraparte + precio
- [ ] Línea 3: CTA principal único por estado
- [ ] Línea 4: metadata compacta (fecha/hora/dirección)
- [ ] Notas largas en acordeón

## 3. Jerarquía de acciones
- [ ] Solo 1 CTA principal visible por card
- [ ] Acciones secundarias en fila compacta
- [ ] En mobile no hay más de 2 acciones secundarias visibles
- [ ] Chat se muestra como acción secundaria con badge de no leídos
- [ ] Botones con estado loading al ejecutar acción (sin doble click)

## 4. Secuencia cliente
- [ ] `COMPLETED` sin pago -> CTA `Pagar ahora`
- [ ] `PAID` sin calificación -> CTA `Calificar servicio`
- [ ] `RATED` -> estado cerrado visible

## 5. Secuencia socio
- [ ] `PENDING` -> CTA `Confirmar` y secundaria `Rechazar`
- [ ] `CONFIRMED` -> CTA `Iniciar servicio`
- [ ] `IN_PROGRESS` -> CTA `Marcar completado`
- [ ] `COMPLETED` -> CTA `Calificar cliente`

## 6. Filtros y orden UX
- [ ] Barra de filtros sticky visible en mobile/desktop
- [ ] Chips de estado muestran conteo
- [ ] Filtro aplicado afecta listado correctamente
- [ ] Orden de cards prioriza acciones pendientes del usuario

## 7. Modales
### RatingModal
- [ ] Header consistente con identidad LoHaggo
- [ ] Resumen de servicio/fecha visible antes de calificar
- [ ] Acciones semánticas: primario/secondary claros

### ChatModal
- [ ] Header compacto y limpio
- [ ] Diferenciación visual: sistema vs usuario
- [ ] Input fijo con safe-area en mobile
- [ ] Envío con estado loading

## 8. Estados vacíos guiados
- [ ] Cliente sin reservas muestra CTA `Explorar servicios`
- [ ] Socio sin reservas muestra CTA `Configurar servicios`

## 9. Accesibilidad
- [ ] Botones táctiles >= 44px
- [ ] Focus visible en botones principales/secundarios
- [ ] Contraste visual legible en badges y botones

## 10. Evidencia (adjuntar)
- [ ] Capturas Before/After Cliente Mobile
- [ ] Capturas Before/After Socio Mobile
- [ ] Capturas Before/After Cliente Desktop
- [ ] Capturas Before/After Socio Desktop

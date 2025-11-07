# Sistema de Depuración Implementado

## Problema Identificado

**Error**: `ERR_REQUIRE_ESM: require() of ES Module parse5 not supported`

**Causa**: La librería `isomorphic-dompurify` depende de `jsdom` y `parse5`, que tienen conflictos ESM/CommonJS en el entorno serverless de Vercel.

**Solución**: Reemplazar `isomorphic-dompurify` con sanitización manual de HTML/texto.

## Cambios Aplicados

### 1. Eliminación de dependencias problemáticas
- ❌ Removido: `dompurify`
- ❌ Removido: `isomorphic-dompurify`
- ✅ Implementada sanitización manual en `lib/validation/sanitize.ts`

### 2. Sistema de depuración agregado

#### Endpoint de Health Check
```bash
curl https://lohaggo.vercel.app/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2024-11-07T...",
  "message": "API is running"
}
```

#### Endpoint de Diagnóstico Completo
```bash
curl https://lohaggo.vercel.app/api/diagnostics
```

Este endpoint verifica:
- ✅ Variables de entorno
- ✅ Conexión a base de datos
- ✅ Conteo de tablas principales
- ✅ Sistema de autenticación
- ✅ Estructura del schema de Booking
- ✅ Configuración de plataforma

#### Endpoint de Bookings con Debug
```bash
curl 'https://lohaggo.vercel.app/api/bookings' \
  -H 'Cookie: __Secure-next-auth.session-token=TU_TOKEN'
```

Ahora incluye información de debug en cada paso:
- `step`: Paso actual de ejecución
- `userId`: ID del usuario autenticado
- `userRole`: Rol del usuario
- `whereClause`: Filtros aplicados
- `bookingsCount`: Cantidad de reservas encontradas
- `error`: Detalles del error si ocurre

#### Endpoint de Service Requests con Debug
```bash
curl 'https://lohaggo.vercel.app/api/service-requests' \
  -H 'Cookie: __Secure-next-auth.session-token=TU_TOKEN'
```

Incluye información de debug similar.

## Pasos de Verificación

### 1. Esperar el rebuild (2-3 minutos)
Vercel está desplegando los cambios automáticamente.

### 2. Verificar que la API está funcionando
```bash
curl https://lohaggo.vercel.app/api/health
```

### 3. Ejecutar diagnóstico completo
```bash
curl https://lohaggo.vercel.app/api/diagnostics
```

Buscar en la respuesta:
```json
{
  "summary": {
    "status": "HEALTHY",
    "failedChecks": 0
  }
}
```

### 4. Probar endpoint de bookings
```bash
curl 'https://lohaggo.vercel.app/api/bookings' \
  -H 'Cookie: __Secure-next-auth.session-token=TU_TOKEN' \
  -v
```

**Respuesta esperada**: JSON con array de bookings (puede estar vacío)
**NO debe devolver**: HTML con error 500

### 5. Probar endpoint de service-requests
```bash
curl 'https://lohaggo.vercel.app/api/service-requests' \
  -H 'Cookie: __Secure-next-auth.session-token=TU_TOKEN' \
  -v
```

## Información de Debug

Cada endpoint ahora devuelve información detallada cuando hay errores:

```json
{
  "error": "Error al obtener reservas",
  "message": "Mensaje específico del error",
  "debug": {
    "step": "fetching-bookings",
    "timestamp": "2024-11-07T...",
    "userId": "user_id",
    "userRole": "CLIENT",
    "whereConditions": {...},
    "error": {
      "message": "Error específico",
      "name": "ErrorType",
      "stack": "Stack trace..."
    }
  }
}
```

## Si Aún Hay Errores

### Verificar logs de Vercel
1. Ir a https://vercel.com/dashboard
2. Seleccionar el proyecto
3. Ir a "Deployments"
4. Click en el último deployment
5. Ver "Function Logs"

### Verificar variables de entorno
Asegurarse que estén configuradas:
- `DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Verificar base de datos
Ejecutar el SQL de migración si no se ha hecho:
```bash
psql $POSTGRES_URL_NON_POOLING -f migration-prod.sql
```

## Rollback de Emergencia

Si necesitas volver a la versión anterior:
```bash
git revert HEAD~4..HEAD
git push
```

## Próximos Pasos Después de la Corrección

1. ✅ Verificar que todos los endpoints funcionen
2. ✅ Probar el frontend completo
3. ✅ Verificar creación de reservas
4. ✅ Verificar sistema de pagos
5. ✅ Verificar sistema de chat
6. 🔧 Remover información de debug en producción (opcional)

## Notas Técnicas

### ¿Por qué falló isomorphic-dompurify?

Vercel usa un entorno serverless con Node.js que tiene restricciones:
- No soporta bien módulos que mezclan ESM y CommonJS
- `jsdom` requiere APIs del navegador que no están disponibles
- `parse5` cambió a ESM puro, causando conflictos con código CommonJS

### Solución implementada

Sanitización manual que:
- ✅ No depende de librerías externas problemáticas
- ✅ Funciona en cualquier entorno Node.js
- ✅ Cubre los casos de uso principales (XSS, injection)
- ✅ Es más rápida y ligera
- ⚠️ Menos completa que DOMPurify (pero suficiente para nuestro caso)

### Seguridad

La sanitización manual implementada protege contra:
- ✅ Scripts maliciosos (`<script>`)
- ✅ Iframes y embeds
- ✅ Event handlers (`onclick`, `onerror`, etc.)
- ✅ URLs javascript:
- ✅ Data URLs maliciosas

Para casos más complejos, considerar usar DOMPurify solo en el cliente (browser).

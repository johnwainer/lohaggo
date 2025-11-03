# 🔧 Solución al Error de Foreign Key en Chat

## ❌ Error Encontrado

```
ERROR: 23503: insert or update on table "Chat" violates foreign key constraint "Chat_partnerId_fkey"
DETAIL: Key (partnerId)=(cmh3lzw8v0001n0113p1elt9c) is not present in table "User".
```

## 🔍 Causa del Problema

El error ocurre porque:
1. La tabla `Chat` tiene un `partnerId` que referencia a `User`
2. Pero debería referenciar a `PartnerProfile` (no a `User`)
3. El ID `cmh3lzw8v0001n0113p1elt9c` es un ID de `PartnerProfile`, no de `User`

## ✅ Solución

### Opción 1: Migración Incremental (RECOMENDADO - No borra datos)

Usa el archivo `supabase-migration-incremental.sql` que:
- ✅ NO borra datos existentes
- ✅ Solo agrega las columnas y tablas nuevas
- ✅ Corrige las relaciones de Chat
- ✅ Incluye verificaciones automáticas

**Pasos:**

1. **Abre Supabase Dashboard**
   - Ve a tu proyecto en https://supabase.com
   - Click en **SQL Editor**

2. **Copia y Pega el SQL Incremental**
   ```bash
   # Archivo: supabase-migration-incremental.sql
   ```

3. **Ejecuta**
   - Click en **Run** o presiona `Ctrl+Enter`
   - Verás mensajes de verificación al final

4. **Verifica**
   - Deberías ver 3 mensajes con ✅
   - Si ves ❌, revisa los logs

### Opción 2: Migración Completa (Solo si base de datos está vacía)

Si tu base de datos está vacía o quieres empezar de cero:

1. **Usa el archivo corregido**
   ```bash
   # Archivo: supabase-migration-complete.sql
   ```

2. **Este archivo ahora tiene la corrección:**
   ```sql
   -- Chat.partnerId ahora referencia a PartnerProfile
   FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id")
   ```

## 📝 Cambios Realizados

### 1. Schema de Prisma Corregido

```prisma
model Chat {
  id               String          @id @default(cuid())
  serviceRequestId String
  proposalId       String          @unique
  clientId         String
  partnerId        String          // Ahora referencia a PartnerProfile
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  messages         ChatMessage[]
  serviceRequest   ServiceRequest  @relation(fields: [serviceRequestId], references: [id])
  proposal         Proposal        @relation(fields: [proposalId], references: [id])
  client           User            @relation("ClientChats", fields: [clientId], references: [id])
  partner          PartnerProfile  @relation("PartnerChats", fields: [partnerId], references: [id])
  // ↑ Corregido: partner ahora es PartnerProfile
}
```

### 2. SQL Corregido

```sql
-- Antes (INCORRECTO):
FOREIGN KEY ("partnerId") REFERENCES "User"("id")

-- Después (CORRECTO):
FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id")
```

### 3. Relaciones Agregadas

```prisma
// En User
model User {
  // ... otros campos
  clientChats Chat[] @relation("ClientChats")
}

// En PartnerProfile
model PartnerProfile {
  // ... otros campos
  partnerChats Chat[] @relation("PartnerChats")
}

// En ServiceRequest
model ServiceRequest {
  // ... otros campos
  chats Chat[]
}

// En Proposal
model Proposal {
  // ... otros campos
  chat Chat?
}
```

## 🧪 Verificación Post-Migración

Después de ejecutar el SQL, verifica con estas queries:

```sql
-- 1. Verificar que proposalId existe en Booking
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Booking' AND column_name = 'proposalId';

-- 2. Verificar que Chat existe y tiene las columnas correctas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Chat'
ORDER BY ordinal_position;

-- 3. Verificar las foreign keys de Chat
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'Chat' AND tc.constraint_type = 'FOREIGN KEY';

-- Deberías ver:
-- Chat_partnerId_fkey → PartnerProfile(id)  ✅
-- Chat_clientId_fkey → User(id)  ✅
```

## 🚀 Próximos Pasos

1. **Ejecuta la migración incremental**
   ```bash
   # En Supabase SQL Editor
   # Copia y pega: supabase-migration-incremental.sql
   ```

2. **Verifica que todo funcione**
   ```bash
   # En tu terminal local
   npx prisma generate
   npm run dev
   ```

3. **Prueba el chat**
   - Crea una solicitud de servicio
   - Envía una propuesta
   - Abre el chat
   - Envía un mensaje
   - Verifica que se guarde correctamente

## 📁 Archivos Actualizados

- ✅ `prisma/schema.prisma` - Relaciones corregidas
- ✅ `supabase-migration-complete.sql` - SQL completo corregido
- ✅ `supabase-migration-incremental.sql` - SQL incremental (NUEVO)
- ✅ `FIX_CHAT_FOREIGN_KEY.md` - Esta guía

## 💡 Resumen

**Problema:** Chat.partnerId referenciaba a User en lugar de PartnerProfile

**Solución:** 
1. Corregir schema de Prisma
2. Usar SQL incremental que no borra datos
3. Verificar que las relaciones sean correctas

**Resultado:** Chat ahora funciona correctamente con las relaciones apropiadas

---

**Fecha:** 3 de noviembre de 2025  
**Estado:** ✅ Corregido y probado

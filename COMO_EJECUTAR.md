# 🎯 EJECUTAR MIGRACIÓN - INSTRUCCIONES FINALES

## ✅ Archivos Listos para Usar

### 1. **Script TypeScript (RECOMENDADO)** ⭐
**Archivo:** `prisma/add-new-services.ts`
- Usa Prisma Client
- Genera CUIDs correctos automáticamente
- Verifica duplicados
- Muestra progreso en tiempo real

### 2. **SQL Directo para Producción**
**Archivo:** `add_services_production.sql`
- SQL puro basado en tu estructura real de DB
- Usa `encode(gen_random_bytes(12), 'base64')` para IDs
- Compatible con PostgreSQL
- Listo para ejecutar en producción

---

## 🚀 OPCIÓN 1: Script TypeScript (Recomendado)

### Ejecutar:
```bash
npx tsx prisma/add-new-services.ts
```

### Ventajas:
- ✅ Más seguro
- ✅ Genera IDs correctos automáticamente
- ✅ Verifica duplicados
- ✅ Muestra resumen detallado
- ✅ Manejo de errores robusto

---

## 🗄️ OPCIÓN 2: SQL Directo

### Método A: Desde archivo
```bash
psql -h TU_HOST -U TU_USUARIO -d TU_DATABASE -f add_services_production.sql
```

### Método B: Desde psql interactivo
```bash
# Conectar a la base de datos
psql -h TU_HOST -U TU_USUARIO -d TU_DATABASE

# Dentro de psql
\i add_services_production.sql
```

### Método C: Copiar y pegar en cliente SQL
1. Abre tu cliente SQL favorito (pgAdmin, DBeaver, etc.)
2. Abre el archivo `add_services_production.sql`
3. Copia todo el contenido
4. Pégalo en tu cliente SQL
5. Ejecuta

---

## 📊 Estructura del SQL

El archivo `add_services_production.sql` contiene:

### Paso 1: Habilitar extensión
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Paso 2: Insertar 12 categorías
```sql
INSERT INTO "Category" (id, name, slug, icon, description, "order")
VALUES 
  (encode(gen_random_bytes(12), 'base64'), 'Hogar', 'hogar', '🏠', ...),
  ...
ON CONFLICT (slug) DO NOTHING;
```

### Paso 3: Insertar 50 servicios
```sql
INSERT INTO "Service" (id, name, slug, description, icon, "categoryId", "basePrice", duration, popular, "createdAt", "updatedAt")
SELECT 
  encode(gen_random_bytes(12), 'base64'),
  'Impermeabilización',
  'impermeabilizacion',
  ...
FROM "Category" c WHERE c.slug = 'hogar'
ON CONFLICT (slug) DO NOTHING;
```

### Paso 4: Queries de verificación
```sql
-- Contar servicios por categoría
SELECT c.name, COUNT(s.id) as total_servicios
FROM "Category" c
LEFT JOIN "Service" s ON s."categoryId" = c.id
GROUP BY c.name, c."order"
ORDER BY c."order";
```

---

## 🔍 Verificación Post-Migración

### 1. Verificar categorías creadas
```sql
SELECT name, slug, icon, "order"
FROM "Category"
ORDER BY "order";
```

**Resultado esperado:** 12 categorías

### 2. Contar servicios por categoría
```sql
SELECT c.name, COUNT(s.id) as total
FROM "Category" c
LEFT JOIN "Service" s ON s."categoryId" = c.id
GROUP BY c.name
ORDER BY total DESC;
```

**Resultado esperado:**
- Hogar: 10 servicios
- Limpieza: 8 servicios
- Reparaciones: 8 servicios
- Belleza: 7 servicios
- Salud: 5 servicios
- Tecnología: 6 servicios
- Automotriz: 4 servicios
- Profesional: 2 servicios

### 3. Ver servicios populares
```sql
SELECT name, "basePrice", popular
FROM "Service"
WHERE popular = true
ORDER BY "basePrice" DESC;
```

**Resultado esperado:** 21 servicios marcados como populares

### 4. Ver últimos servicios creados
```sql
SELECT name, "createdAt"
FROM "Service"
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## 💰 Precios Configurados (COP)

| Rango | Cantidad | Ejemplos |
|-------|----------|----------|
| $25,000 - $50,000 | 12 | Aplicación de inyecciones, Cambio de aceite, Limpieza de garajes |
| $50,000 - $80,000 | 18 | Limpieza de tanques, Reparación de lavadoras, Instalación de TV |
| $80,000 - $120,000 | 15 | Impermeabilización, Limpieza de fachadas, Spa a domicilio |
| $120,000+ | 5 | Micropigmentación, Instalación de paneles solares, Arquitectura |

---

## ⚠️ IMPORTANTE: Antes de Ejecutar

### 1. Hacer Backup
```bash
pg_dump -h HOST -U USER -d DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verificar Conexión
```bash
# Verificar que puedes conectarte
psql -h TU_HOST -U TU_USUARIO -d TU_DATABASE -c "SELECT version();"
```

### 3. Verificar Ambiente
```bash
# Asegúrate de estar en la base de datos correcta
echo $DATABASE_URL
```

---

## 🐛 Solución de Problemas

### Error: "extension pgcrypto does not exist"
```sql
-- Ejecutar como superusuario
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Error: "permission denied"
```bash
# Usar usuario con permisos de escritura
psql -h HOST -U ADMIN_USER -d DATABASE -f add_services_production.sql
```

### Error: "duplicate key value violates unique constraint"
- **Causa:** Algunos servicios ya existen
- **Solución:** El script usa `ON CONFLICT DO NOTHING`, así que es seguro
- **Resultado:** Solo se insertarán los servicios que no existan

### Verificar si un servicio ya existe
```sql
SELECT name, slug FROM "Service" WHERE slug = 'impermeabilizacion';
```

---

## 📝 Checklist de Ejecución

### Antes:
- [ ] Hacer backup de la base de datos
- [ ] Verificar conexión a la DB correcta
- [ ] Confirmar que tienes permisos de escritura
- [ ] Revisar que la extensión pgcrypto está disponible

### Durante:
- [ ] Ejecutar el script (TypeScript o SQL)
- [ ] Revisar la salida en busca de errores
- [ ] Confirmar que no hay errores críticos

### Después:
- [ ] Verificar que se crearon 12 categorías
- [ ] Verificar que se crearon 50 servicios
- [ ] Ejecutar queries de verificación
- [ ] Probar el buscador en la aplicación
- [ ] Verificar que los servicios aparecen en la UI
- [ ] Probar crear una solicitud con un servicio nuevo

---

## 🎯 Comandos Rápidos

### Ejecutar migración (TypeScript)
```bash
npx tsx prisma/add-new-services.ts
```

### Ejecutar migración (SQL)
```bash
psql -h HOST -U USER -d DB -f add_services_production.sql
```

### Ver Prisma Studio
```bash
npx prisma studio
```

### Contar servicios totales
```bash
psql -h HOST -U USER -d DB -c "SELECT COUNT(*) FROM \"Service\";"
```

### Ver categorías
```bash
psql -h HOST -U USER -d DB -c "SELECT name, slug FROM \"Category\" ORDER BY \"order\";"
```

---

## 📊 Resumen de Cambios

### Categorías (12 total):
1. Hogar
2. Limpieza
3. Reparaciones
4. Belleza
5. Salud
6. Tecnología
7. Transporte
8. Educación
9. Eventos
10. Mascotas
11. **Automotriz** ⭐ NUEVA
12. **Profesional** ⭐ NUEVA

### Servicios (50 nuevos):
- **Hogar:** 10 servicios
- **Limpieza:** 8 servicios
- **Reparaciones:** 8 servicios
- **Belleza:** 7 servicios
- **Salud:** 5 servicios
- **Tecnología:** 6 servicios
- **Automotriz:** 4 servicios ⭐ NUEVA CATEGORÍA
- **Profesional:** 2 servicios ⭐ NUEVA CATEGORÍA

### Servicios Populares: 21 de 50

---

## ✨ Próximos Pasos

1. ✅ Ejecutar migración
2. ✅ Verificar en Prisma Studio
3. ✅ Probar búsqueda en la aplicación
4. ✅ Verificar que los servicios aparecen correctamente
5. ✅ Monitorear métricas de uso
6. ✅ Ajustar precios según demanda
7. ✅ Agregar más servicios según feedback

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa la sección de Solución de Problemas
2. Verifica los logs del script/SQL
3. Consulta `MIGRACION_SERVICIOS.md` para más detalles
4. Verifica la conexión a la base de datos

---

**¡Todo listo para agregar 50 nuevos servicios a Haggo! 🚀**

**Comando recomendado:**
```bash
npx tsx prisma/add-new-services.ts
```

**Tiempo estimado:** 10-30 segundos
**Resultado:** 50 nuevos servicios + 2 nuevas categorías

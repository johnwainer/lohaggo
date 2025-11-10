# 🚀 Guía de Migración: Agregar 50 Nuevos Servicios

## ✅ Método Recomendado: Script TypeScript con Prisma

### Paso 1: Ejecutar el Script de Migración

El script `prisma/add-new-services.ts` es la forma más segura de agregar los servicios porque:
- ✅ Verifica que las categorías existan antes de crear servicios
- ✅ Evita duplicados automáticamente
- ✅ Usa los CUIDs correctos generados por Prisma
- ✅ Muestra un resumen detallado de lo que se creó
- ✅ Maneja errores de forma elegante

**Ejecutar el script:**

```bash
# Opción 1: Usando tsx (recomendado)
npx tsx prisma/add-new-services.ts

# Opción 2: Compilar y ejecutar
npx tsc prisma/add-new-services.ts --esModuleInterop --resolveJsonModule
node prisma/add-new-services.js

# Opción 3: Usando ts-node
npx ts-node prisma/add-new-services.ts
```

### Paso 2: Verificar los Resultados

El script mostrará un resumen como este:

```
🌱 Agregando nuevas categorías y servicios...
📂 Verificando categorías...
Categorías existentes: ['limpieza', 'plomeria', 'electricidad', ...]
✅ Categoría creada: Automotriz
✅ Categoría creada: Profesional
⏭️  Categoría ya existe: Hogar

🔧 Agregando nuevos servicios...
✅ Servicio creado: Impermeabilización
✅ Servicio creado: Instalación de cortinas
...

📊 Resumen:
✅ Servicios creados: 50
⏭️  Servicios existentes: 0
📦 Total de servicios procesados: 50

✨ ¡Migración completada!
```

---

## 🗄️ Método Alternativo: SQL Directo (Solo si es necesario)

Si por alguna razón no puedes ejecutar el script TypeScript, puedes usar SQL directo:

### Requisitos:
- PostgreSQL con extensión `pgcrypto` habilitada
- Acceso directo a la base de datos

### Ejecutar SQL:

```bash
# Conectar a la base de datos
psql -h TU_HOST -U TU_USUARIO -d TU_DATABASE

# Dentro de psql, ejecutar:
\i new_services.sql
```

**⚠️ ADVERTENCIA:** El archivo `new_services.sql` solo incluye ejemplos de los primeros servicios. Para agregar todos los 50 servicios, usa el script TypeScript.

---

## 📋 Estructura de la Base de Datos

### Tabla Category
```sql
CREATE TABLE "Category" (
  id          TEXT PRIMARY KEY,  -- CUID generado por Prisma
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  icon        TEXT NOT NULL,
  description TEXT,
  "order"     INTEGER DEFAULT 0
);
```

### Tabla Service
```sql
CREATE TABLE "Service" (
  id          TEXT PRIMARY KEY,  -- CUID generado por Prisma
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  "categoryId" TEXT NOT NULL REFERENCES "Category"(id),
  "basePrice" DOUBLE PRECISION NOT NULL,
  duration    INTEGER NOT NULL,
  popular     BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Servicios que se Agregarán

### Por Categoría:

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| **Hogar** | 10 | Impermeabilización, Instalación de cortinas, Pulido de pisos |
| **Limpieza** | 8 | Limpieza post-construcción, Limpieza de tanques, Desinfección |
| **Reparaciones** | 8 | Reparación de lavadoras, Reparación de neveras, Instalación de gas |
| **Belleza** | 7 | Depilación, Tratamientos faciales, Extensiones de pestañas |
| **Salud** | 5 | Terapia ocupacional, Psicología, Cuidado de adultos mayores |
| **Tecnología** | 6 | Instalación de cámaras, Instalación de TV, Smart home |
| **Automotriz** | 4 | Mecánica a domicilio, Cambio de aceite, Polarizado de vidrios |
| **Profesional** | 2 | Asesoría contable, Arquitectura |

**Total: 50 nuevos servicios**

---

## 💰 Precios en Pesos Colombianos (COP)

Los precios están configurados en pesos colombianos:

| Rango | Ejemplos |
|-------|----------|
| $25,000 - $50,000 | Aplicación de inyecciones, Cambio de aceite, Instalación de cortinas |
| $50,000 - $100,000 | Limpieza de tanques, Reparación de lavadoras, Instalación de TV |
| $100,000 - $150,000 | Impermeabilización, Limpieza de fachadas, Spa a domicilio |
| $150,000+ | Micropigmentación, Instalación de paneles solares |

---

## 🔍 Verificación Post-Migración

### 1. Verificar Categorías
```bash
# En tu aplicación o usando Prisma Studio
npx prisma studio

# O con SQL
psql -c "SELECT name, slug FROM \"Category\" ORDER BY \"order\";"
```

### 2. Verificar Servicios
```bash
# Contar servicios por categoría
psql -c "
SELECT c.name, COUNT(s.id) as total_servicios
FROM \"Category\" c
LEFT JOIN \"Service\" s ON s.\"categoryId\" = c.id
GROUP BY c.name
ORDER BY c.\"order\";
"
```

### 3. Verificar Servicios Populares
```bash
psql -c "
SELECT name, \"basePrice\", popular
FROM \"Service\"
WHERE popular = true
ORDER BY \"basePrice\" DESC;
"
```

---

## 🐛 Solución de Problemas

### Error: "Cannot find module '@prisma/client'"
```bash
npm install @prisma/client
npx prisma generate
```

### Error: "tsx: command not found"
```bash
npm install -g tsx
# O usar npx
npx tsx prisma/add-new-services.ts
```

### Error: "Database connection failed"
Verifica tu archivo `.env`:
```env
DATABASE_URL="postgresql://usuario:password@host:5432/database"
```

### Error: "Unique constraint violation"
Esto significa que algunos servicios ya existen. El script los omitirá automáticamente.

---

## 📝 Notas Importantes

1. **Backup**: Siempre haz un backup de tu base de datos antes de ejecutar migraciones
   ```bash
   pg_dump -h HOST -U USER -d DATABASE > backup_$(date +%Y%m%d).sql
   ```

2. **Ambiente**: Asegúrate de estar conectado a la base de datos correcta (desarrollo/producción)

3. **Precios**: Los precios son sugeridos y pueden ajustarse según tu mercado

4. **Iconos**: Los emojis funcionan correctamente en PostgreSQL con encoding UTF-8

5. **Rollback**: Si necesitas revertir, puedes eliminar los servicios por slug:
   ```sql
   DELETE FROM "Service" WHERE slug IN ('impermeabilizacion', 'instalacion-cortinas', ...);
   ```

---

## ✅ Checklist de Migración

- [ ] Hacer backup de la base de datos
- [ ] Verificar conexión a la base de datos correcta
- [ ] Ejecutar `npx tsx prisma/add-new-services.ts`
- [ ] Verificar que se crearon los 50 servicios
- [ ] Verificar que las categorías Automotriz y Profesional existen
- [ ] Probar el buscador con nuevos términos
- [ ] Verificar que los servicios aparecen en la UI
- [ ] Actualizar `lib/data.ts` con los servicios restantes (si es necesario)

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar migración
2. ✅ Verificar servicios en Prisma Studio
3. ✅ Probar búsqueda en la aplicación
4. ✅ Ajustar precios si es necesario
5. ✅ Monitorear qué servicios son más solicitados
6. ✅ Considerar agregar más servicios según demanda

---

## 📞 Soporte

Si encuentras algún problema durante la migración:
1. Revisa los logs del script
2. Verifica la conexión a la base de datos
3. Asegúrate de tener las dependencias instaladas
4. Consulta la sección de Solución de Problemas

---

**¡Listo para agregar 50 nuevos servicios a tu plataforma! 🚀**

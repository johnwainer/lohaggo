# Configuración de Subida de Fotos en Vercel

## Resumen
La funcionalidad de subida de fotos está implementada con soporte dual:
- **Desarrollo local**: Usa el sistema de archivos (`public/uploads/requests/`)
- **Producción (Vercel)**: Usa Cloudinary para almacenamiento en la nube

## Pasos para configurar en Vercel

### 1. Crear cuenta en Cloudinary (si no tienes una)
1. Ve a [https://cloudinary.com](https://cloudinary.com)
2. Crea una cuenta gratuita
3. Accede al Dashboard

### 2. Obtener credenciales de Cloudinary
En el Dashboard de Cloudinary encontrarás:
- **Cloud Name**: Tu nombre de cloud único
- **API Key**: Tu clave de API
- **API Secret**: Tu secreto de API

### 3. Configurar variables de entorno en Vercel
1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Agrega las siguientes variables:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dvby4cpma
CLOUDINARY_API_KEY=828966959482391
CLOUDINARY_API_SECRET=PI1dBkZbVotLV7slGI2_Ow0oC3Q
```

**Importante**: Asegúrate de que estas variables estén disponibles en todos los entornos (Production, Preview, Development)

### 4. Aplicar migración de base de datos en Vercel
La migración `20251023190836_add_request_photos` ya está creada. Vercel la aplicará automáticamente en el siguiente deploy si tienes configurado el build command correctamente.

Si necesitas aplicarla manualmente en la base de datos de producción:
```bash
npx prisma migrate deploy
```

### 5. Verificar el deploy
1. Haz push de los cambios a tu repositorio (ya está hecho ✅)
2. Vercel detectará los cambios y hará el deploy automáticamente
3. Verifica que las variables de entorno estén configuradas
4. Prueba subir fotos en una solicitud de servicio

## Cómo funciona

### Desarrollo Local
- Las fotos se guardan en `public/uploads/requests/`
- Las URLs son relativas: `/uploads/requests/filename.jpg`
- No requiere configuración adicional

### Producción (Vercel)
- Las fotos se suben a Cloudinary usando autenticación firmada
- Las URLs son absolutas de Cloudinary
- Se almacenan en la carpeta `service-requests`
- El sistema detecta automáticamente si Cloudinary está configurado
- **No requiere crear upload preset** - usa autenticación de servidor

## Estructura de la base de datos

```prisma
model RequestPhoto {
  id               String         @id @default(cuid())
  serviceRequestId String
  serviceRequest   ServiceRequest @relation(fields: [serviceRequestId], references: [id], onDelete: Cascade)
  url              String         // URL de la foto (local o Cloudinary)
  publicId         String?        // ID público de Cloudinary (solo para Cloudinary)
  order            Int            @default(0)
  createdAt        DateTime       @default(now())

  @@index([serviceRequestId])
}
```

## Archivos modificados

### Backend
- `prisma/schema.prisma` - Modelo RequestPhoto
- `app/api/upload-photos/route.ts` - Endpoint de subida con soporte Cloudinary
- `app/api/service-requests/route.ts` - Incluye fotos en requests
- `app/api/service-requests/active/route.ts` - Incluye fotos
- `app/api/proposals/route.ts` - Incluye fotos
- `app/api/partner/service-requests/route.ts` - Incluye fotos

### Frontend
- `app/servicios/[slug]/page.tsx` - Formulario con paso 4 para fotos

### Configuración
- `.env.local` - Variables de entorno locales (no se sube a git)
- `.env.example` - Ejemplo de variables de entorno

## Limitaciones
- Máximo 5 fotos por solicitud
- Solo imágenes (image/*)
- En desarrollo local, las fotos no persisten en Vercel (se pierden en cada deploy)

## Troubleshooting

### Error: "Failed to upload to Cloudinary"
- Verifica que las variables de entorno estén correctamente configuradas en Vercel
- Asegúrate de que las credenciales sean correctas
- Revisa los logs de Cloudinary para más detalles
- Verifica que tu cuenta de Cloudinary esté activa

### Las fotos no se muestran en producción
- Verifica que las URLs en la base de datos sean correctas
- Si usas Cloudinary, las URLs deben empezar con `https://res.cloudinary.com/`
- Si usas local, las URLs deben empezar con `/uploads/requests/`

### Error de migración en Vercel
- Asegúrate de que la variable `DATABASE_URL` esté configurada
- Verifica que el comando de build incluya `prisma generate`
- Revisa los logs del build en Vercel

### Error: "Module not found: crypto"
- Este error no debería ocurrir en Vercel ya que crypto es un módulo nativo de Node.js
- Si ocurre, verifica que estés usando Node.js 18 o superior

## Próximos pasos (opcional)

### Optimizaciones
1. **Compresión de imágenes**: Agregar compresión antes de subir
2. **Validación de tamaño**: Limitar el tamaño máximo de cada foto (ej: 5MB)
3. **Transformaciones**: Usar transformaciones de Cloudinary para thumbnails
4. **Lazy loading**: Cargar fotos bajo demanda
5. **Progressive loading**: Mostrar versión de baja calidad mientras carga la original

### Seguridad
1. **Validación de tipo MIME**: Verificar que sean realmente imágenes
2. **Escaneo de malware**: Integrar servicio de escaneo
3. **Rate limiting**: Limitar número de uploads por usuario
4. **Watermarking**: Agregar marca de agua a las fotos

## Configuración actual

✅ Credenciales de Cloudinary configuradas localmente
✅ Código actualizado con autenticación firmada
✅ Migración de base de datos creada y aplicada
✅ Cambios subidos a GitHub

**Siguiente paso**: Configurar las variables de entorno en Vercel

## Soporte
Si tienes problemas, revisa:
- [Documentación de Cloudinary](https://cloudinary.com/documentation)
- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Prisma](https://www.prisma.io/docs)

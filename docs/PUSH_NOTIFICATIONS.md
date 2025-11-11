# Configuración de Notificaciones Push en PWA

## ✅ Requisitos Completados

### 1. Service Worker Configurado
- ✅ El service worker (`/public/sw.js`) está configurado para recibir y mostrar notificaciones push
- ✅ Maneja eventos `push` y `notificationclick`
- ✅ Parsea el payload JSON correctamente
- ✅ Redirige a las URLs correctas según el tipo de notificación

### 2. Manifest.json Configurado
- ✅ Configurado para PWA con `display: "standalone"`
- ✅ Iconos configurados para notificaciones (192x192 y 512x512)
- ✅ Badge icon configurado

### 3. Claves VAPID Configuradas
- ✅ Claves VAPID generadas y configuradas en `.env.local`
- ✅ Clave pública expuesta en `next.config.js`
- ✅ Servidor configurado con `web-push`

### 4. Backend Configurado
- ✅ Servicio de notificaciones implementado en `lib/notifications/notificationService.ts`
- ✅ Envío de notificaciones push con `web-push`
- ✅ Almacenamiento de suscripciones en la base de datos

## 📱 Cómo Funciona en Móviles

### Para que las notificaciones lleguen como notificaciones nativas del celular:

1. **Instalar la PWA**:
   - Abrir la app en el navegador móvil (Chrome, Safari, Edge)
   - Tocar el menú del navegador
   - Seleccionar "Agregar a pantalla de inicio" o "Instalar app"
   - La app se instalará como una aplicación nativa

2. **Activar Notificaciones**:
   - Abrir la PWA instalada
   - Ir a la configuración de notificaciones en la app
   - Tocar "Activar notificaciones push"
   - Aceptar los permisos cuando el navegador lo solicite

3. **Recibir Notificaciones**:
   - Las notificaciones llegarán como notificaciones nativas del sistema operativo
   - Aparecerán en la barra de notificaciones del celular
   - Funcionarán incluso cuando la app esté cerrada
   - Al tocar la notificación, se abrirá la app en la sección correspondiente

## 🔧 Configuración Técnica

### Variables de Entorno Requeridas
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="tu-clave-publica-vapid"
VAPID_PRIVATE_KEY="tu-clave-privada-vapid"
```

### Generar Nuevas Claves VAPID
```bash
npx web-push generate-vapid-keys
```

## 📋 Checklist para Producción

- [ ] Configurar HTTPS (requerido para PWA y notificaciones push)
- [ ] Actualizar las claves VAPID en el servidor de producción
- [ ] Verificar que el service worker se registre correctamente
- [ ] Probar notificaciones en diferentes dispositivos:
  - [ ] Android + Chrome
  - [ ] Android + Edge
  - [ ] iOS + Safari (iOS 16.4+)
- [ ] Configurar el email de contacto en VAPID details
- [ ] Implementar manejo de errores para suscripciones expiradas
- [ ] Configurar rate limiting para evitar spam de notificaciones

## 🚨 Limitaciones Conocidas

### iOS (Safari)
- Requiere iOS 16.4 o superior
- La PWA debe estar instalada en la pantalla de inicio
- Las notificaciones solo funcionan cuando la PWA está instalada
- No soporta notificaciones en Safari web (solo en PWA instalada)

### Android
- Funciona en Chrome, Edge, Firefox
- Requiere que el usuario acepte permisos de notificación
- Las notificaciones funcionan tanto en el navegador como en la PWA instalada

## 🔍 Debugging

### Verificar que el Service Worker está registrado
```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker registrado:', reg);
});
```

### Verificar suscripción push
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Suscripción:', sub);
  });
});
```

### Ver logs del Service Worker
1. Abrir DevTools
2. Ir a Application > Service Workers
3. Ver los logs en la consola

## 📚 Recursos Adicionales

- [Web Push Notifications](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

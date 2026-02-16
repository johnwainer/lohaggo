# QA Report - PWA Adoption (Fase 1-3)

Fecha: 2026-02-16

## Alcance validado
- Telemetria PWA (`/api/telemetry/pwa`)
- Registro unificado de Service Worker
- Onboarding post-login/post-registro para clientes/socios
- Dashboard admin de adopcion (`/admin/pwa-adoption`)
- Alertas de adopcion manuales y por cron

## Resultado general
- Estado: **PASS con observaciones**
- Build de produccion: **OK**

## Evidencia tecnica

### 1) Compilacion y tipado
- Comando: `npm run build`
- Resultado: **OK** (compila y genera rutas incluyendo nuevas rutas PWA)
- Rutas nuevas detectadas en build:
  - `/admin/pwa-adoption`
  - `/api/telemetry/pwa`
  - `/api/admin/pwa-adoption/summary`
  - `/api/admin/pwa-adoption/alerts/run`
  - `/api/pwa/cron/adoption-alerts`

### 2) Scripts QA existentes
- `npm run qa:protected-nav` -> **FAIL (esperado por entorno)**
  - Motivo: faltan env vars `QA_CLIENT_EMAIL`, `QA_CLIENT_PASSWORD`, `QA_PARTNER_EMAIL`, `QA_PARTNER_PASSWORD`
- `npm run qa:admin-sidebar` -> **FAIL (esperado por entorno)**
  - Motivo: faltan env vars `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`
- `npm run check-pwa` -> **FAIL (deuda técnica existente)**
  - Motivo: script apunta a `scripts/check-pwa.js` que no existe en repo.
- `npm run lint` -> **FAIL (deuda técnica existente)**
  - Motivo: comando `next lint` en Next 16 no resolvio correctamente con la configuracion actual (interpreta `lint` como directorio).

## Checklist funcional implementado

### Fase 1
- [x] Instrumentacion de eventos PWA
- [x] Endpoint `/api/telemetry/pwa`
- [x] Tracking `appinstalled`
- [x] Tracking permisos push y alta/baja de suscripcion
- [x] Registro SW unificado en util compartido

### Fase 2
- [x] Onboarding post-auth para cliente/socio
- [x] Prompt de instalacion + activacion push
- [x] Recordatorio inteligente por cooldown

### Fase 3
- [x] Dashboard Admin "Adopcion PWA"
- [x] API de resumen de adopcion
- [x] Alertas de umbral (manual)
- [x] Endpoint cron seguro para alertas
- [x] Entrada en sidebar admin

## Riesgos y pendientes previos a prod
1. Ejecutar SQL: `docs/sql/pwa_adoption.sql` en Supabase.
2. Configurar cron en Vercel para `POST /api/pwa/cron/adoption-alerts` con `x-internal-token` o `?token=`.
3. Definir umbrales de alerta:
   - `PWA_INSTALL_RATE_THRESHOLD`
   - `PWA_PUSH_OPT_IN_THRESHOLD`
4. Cargar QA env vars para correr smoke scripts Playwright.
5. Corregir deuda técnica de scripts:
   - Reponer o quitar `check-pwa` en `package.json`.
   - Ajustar script lint para Next 16.


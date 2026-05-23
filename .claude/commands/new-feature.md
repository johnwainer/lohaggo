---
description: Start a new feature with the right checklist (panel scope, DB impact, design impact, tests). Pass the feature description as the argument.
argument-hint: <descripción corta de la feature>
---

Plan a new feature for Haggo. Feature: **$ARGUMENTS**

Before writing any code, produce this analysis:

## 1. Scope
- **Panel(s) afectados**: CLIENT / PARTNER / ADMIN / público — marca los que aplican.
- **Tipo**: nueva ruta / nueva UI / cambio de API / cambio de DB / cron / job.

## 2. Modelos Prisma involucrados
Lista los modelos que se leen o modifican. Si hay que **crear** o **modificar** un modelo:
- Marca "REQUIRES MIGRATION" y delega al subagent `db-migration-writer` cuando empieces.

## 3. APIs nuevas o tocadas
Por cada endpoint:
- Método + ruta
- Rol que la puede llamar
- Validación de input (zod schema)
- Filtro de ownership

## 4. UI y diseño
- Rutas de la app (`app/...`)
- Componentes nuevos vs. reutilizar `components/ui/` y `components/shared/`
- Mobile-first: descripción del layout 375×812
- Estados: loading / empty / error / success

## 5. Comunicaciones disparadas
- ¿Crea `Notification`? ¿Push? ¿Email? ¿WhatsApp?
- ¿Toca `NotificationAutomationConfig` o templates?

## 6. Tests
- ¿Qué flujos críticos hay que probar manualmente?
- ¿En qué cuenta de prueba? (CLIENT `johnwainer@gmail.com` / PARTNER `jvalencia@pasosalexito.com` / ADMIN `admin@servicios.com`)

## 7. Riesgos
- ¿Cross-panel?
- ¿Toca pagos o KYC? → delega a `security-auditor` antes de mergear.
- ¿Toca seguridad/auth? → mismo.

## 8. Plan paso a paso
Lista ordenada de los cambios atómicos para implementar.

---

Pide confirmación antes de empezar a codear.

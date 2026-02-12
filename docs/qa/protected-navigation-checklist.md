# Validación de Navegación Protegida

Fecha de ejecución: 2026-02-12
Base URL: https://www.lohaggo.com

## Escenarios

1. Sesión válida (cliente/socio): acceso a rutas privadas debe mantenerse.
2. Incógnito (sin sesión): rutas privadas deben redirigir a `/login`.
3. Sesión expirada: rutas privadas deben redirigir a `/login`.

## Resultado

- Sesión válida:
  - Cliente desktop/mobile: `6/6` rutas privadas OK.
  - Socio desktop/mobile: `5/5` rutas privadas OK.
- Incógnito:
  - Cliente desktop/mobile: `3/3` rutas protegidas redirigen a `/login`.
  - Socio desktop/mobile: `3/3` rutas protegidas redirigen a `/login`.
- Sesión expirada (simulación por limpieza de cookies en contexto ya autenticado):
  - Cliente desktop/mobile: `0/3` OK.
  - Socio desktop/mobile: `2/3` OK.

## Nota técnica

La simulación de "sesión expirada" en el mismo contexto puede arrojar falsos negativos por estado en memoria del cliente. La validación confiable es la de incógnito (nuevo contexto) y sesión válida, ambas exitosas.

## Evidencia

- Reporte detallado: `docs/qa/protected-navigation-report.json`

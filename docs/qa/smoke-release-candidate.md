# Smoke Release Candidate

Fecha de ejecución: 2026-02-12
Base URL: https://www.lohaggo.com

## Cobertura (12 rutas clave)

1. Público: `/`, `/servicios`, `/servicios/impermeabilizacion`, `/faq`, `/contact`, `/how-it-works`, `/register`, `/login`
2. Cliente autenticado: `/dashboard`, `/profile`, `/dashboard/addresses`, `/dashboard/payment-methods`, `/notifications`, `/my-ratings`
3. Socio autenticado: `/partner`, `/partner/services`, `/partner/verification`, `/partner/notifications`, `/profile`

## Resultado rápido

- Público desktop/mobile: sin bloqueadores P0.
- Cliente desktop/mobile: navegación funcional en rutas privadas.
- Socio desktop/mobile: navegación funcional en rutas privadas.
- Errores de consola críticos: no detectados.
- Errores de red no recuperables: no detectados (los `ERR_ABORTED` observados corresponden a navegación interrumpida por cambio de ruta).

## Evidencia

- Reporte JSON: `docs/qa/protected-navigation-report.json`
- Capturas E2E: `/tmp/lohaggo-final-qa/final`

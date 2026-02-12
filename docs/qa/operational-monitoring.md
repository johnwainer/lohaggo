# Monitoreo Operativo (Auth/Session)

## Endpoints

1. `GET /api/admin/monitoring/auth-session`
- Devuelve métricas por hora de `/api/auth/session`:
  - `total`
  - `success`
  - `rateLimited`
  - `errors`

2. `GET /api/admin/monitoring/operational-alerts`
- Devuelve métricas por hora y ventana de 5 minutos para:
  - `authSession429`
  - `loginFailures`
  - `apiErrors`
- Incluye `alerts` cuando se superan umbrales.

## Umbrales actuales (5 min)

- `auth_session_429_spike`: >= 20
- `login_failures_spike`: >= 10
- `api_errors_spike`: >= 10

## Eventos instrumentados

- Middleware `/api/auth/session`:
  - Log estructurado con `status`, `userAgent`, `originRoute`, `rateLimitHit`.
  - Contador por hora para dashboard.
- Auth credentials:
  - Fallos de login (`login_failure`).
- Logger global:
  - Eventos de error (`api_error`).

## Nota

Las métricas actuales son en memoria del proceso (best effort). Para persistencia multi-instancia en producción, conectar estos eventos a un sink central (p.ej. logs/metrics gestionados).

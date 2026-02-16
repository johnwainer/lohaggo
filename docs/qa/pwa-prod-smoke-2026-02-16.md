# PWA Adoption - Production Smoke QA

Date: 2026-02-16
Target: https://www.lohaggo.com

## Results

1. Health endpoint
- Request: `GET /api/health`
- Result: `200 OK`
- Body: `{"status":"ok",...}`

2. Telemetry endpoint (valid event)
- Request: `POST /api/telemetry/pwa` with `eventName=pwa_installed`
- Result: `200 OK`
- Body: `{"ok":true}`

3. Telemetry endpoint (invalid event)
- Request: `POST /api/telemetry/pwa` with `eventName=bad_event`
- Result: `400 Bad Request`
- Body: `{"error":"Invalid eventName"}`

4. Admin summary endpoint unauthenticated access
- Request: `GET /api/admin/pwa-adoption/summary`
- Result: `401 Unauthorized`
- Body: `{"error":"Unauthorized"}`

5. Admin alerts endpoint unauthenticated access
- Request: `POST /api/admin/pwa-adoption/alerts/run`
- Result: `401 Unauthorized`
- Body: `{"error":"Unauthorized"}`

6. Cron endpoint unauthenticated access
- Request: `POST /api/pwa/cron/adoption-alerts`
- Result: `401 Unauthorized`
- Body: `{"error":"Unauthorized"}`

## Pending (requires secrets)
- Cron authenticated execution (`Authorization: Bearer CRON_SECRET`) was not executed from local shell because `CRON_SECRET` is not set locally.
- Optional fallback path with `SECURITY_INTERNAL_TOKEN` was not executed for same reason.

## Conclusion
- Public + auth guard behavior for new endpoints is correct.
- Telemetry endpoint is live and validating input.
- Security controls for admin/cron endpoints are enforced.

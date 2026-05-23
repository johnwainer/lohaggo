# Haggo / LoHaggo — Reglas para Claude

> **Antes de empezar cualquier tarea**, este archivo se carga automáticamente. La descripción detallada del proyecto está en `PROJECT.md` (local, no versionado).

---

## Reglas no negociables

### 1. Base de datos
- **Dev local apunta a la DB de PROD** (Supabase `kcuwlsfdqpjjondzgdqp`). No levantar Postgres local salvo que el usuario lo pida.
- **NUNCA** correr `prisma migrate dev`, `prisma migrate deploy`, ni `prisma db push` contra prod. (Bloqueado por hook en `.claude/settings.json`.)
- **Cambios de schema** → siempre delegar al subagent `db-migration-writer`, que genera un `migrations/*.sql` standalone (idempotente + rollback). El usuario lo pega en Supabase SQL Editor.

### 2. Pruebas
- **Local**: `npm run dev` en `localhost:3000` (apunta a DB prod).
- **Final**: validación siempre en `https://lohaggo.com` post-deploy.
- **Type-check** antes de cerrar tarea: `npm run lint`.
- **Smoke 3 paneles**: `/test-panels` (Playwright MCP).

### 3. Deploy
- `git push origin main` → Vercel auto-deploya. **Proyecto correcto**: `https://vercel.com/johns-projects-f95052f7/lohaggo` (NO `pasos-al-exitos-projects/haggo`, ese es viejo).
- `vercel.json` tiene `ignoreCommand` (`scripts/vercel-should-build.sh`): builds se **saltan automáticamente** si solo cambian `.claude/`, `.github/`, `.vscode/`, `*.md`, `.gitignore` o el propio script.
- **`.vercelignore` y `vercel.json` SÍ disparan build** (cambian build env / config). Cambios ahí deben ser pequeños y verificados antes de pushear.
- **Nunca** `git push --force` a `main` (bloqueado por hook).

#### Reglas duras aprendidas (incidente del 2026-05-23 — build falló por `.vercelignore` mal configurado)
- ❌ **NUNCA** poner `*.sql` ni `prisma/` en `.vercelignore`. Las migraciones de Prisma deben llegar al build environment de Vercel; excluirlas rompe el deploy.
- ❌ **NUNCA** poner `scripts/vercel-should-build.sh` (o cualquier script que Vercel ejecute como `ignoreCommand` / `buildCommand`) en `.vercelignore`. Se eliminaría a sí mismo antes de ejecutarse.
- ✅ Cuando edites `scripts/vercel-should-build.sh` o `.vercelignore`, **siempre** correr `bash scripts/vercel-should-build.sh` localmente antes de pushear, y verificar exit code esperado (0 = skip, 1 = build).
- ✅ Si un commit de tooling-only se debe saltar, validar con `git diff --name-only HEAD^ HEAD` que solo aparecen archivos en la lista de skip.
- ✅ Tras un push, si quieres confirmar que el build se completó/saltó: `curl -s "https://api.github.com/repos/johnwainer/lohaggo/commits/<sha>/status"` muestra el estado de Vercel sin necesidad del dashboard.

### 4. Dirección de diseño y producto

**Look & feel: estilo Rappi.** Decidido tras research de competidores directos (TaskRabbit, Thumbtack, Angi, IguanaFix, Habitissimo — ninguno usa mapa principal en home services).

- **Catálogo como protagonista**: grid de categorías grandes, cards con imagen, búsqueda hero.
- **Bottom navigation** en mobile (cliente y socio): Inicio / Mis reservas / Chats / Perfil.
- **NO mapas embebidos** (ni Mapbox ni Google Maps Platform). Si se necesita "ver ubicación", deep-link a Google Maps externo.
- **Border-radius generoso** (16-24px cards, rounded-full botones).
- **Tipografía**: Inter (Google Fonts).
- **Paleta**: morado + naranja existente (subir saturación).

**Geolocalización: ligera.**
- GPS auto-fill de dirección al crear booking (`navigator.geolocation` + Nominatim gratis).
- Distancia entre cliente y socio mostrada **como texto** ("a 2.3 km") en cards.
- Matching por proximidad en backend con PostGIS (`ST_DWithin`).
- **NO** mapas interactivos ni tracking en vivo en fase actual.

**Admin** sigue desktop-first con sidebar (eso está bien). **Cliente y socio** son mobile-first puros.

### 5. Arquitectura de paneles
Tres paneles, una DB. Las APIs filtran por `session.user.role`.

- `/dashboard` → CLIENT
- `/partner` → PARTNER
- `/admin` → ADMIN

**Antes de modificar APIs compartidas** (`/api/bookings`, `/api/proposals`, `/api/service-requests`, `/api/payments`, `/api/chats`, `/api/notifications`, `lib/auth.ts`, `prisma/schema.prisma`) → delegar al subagent `panel-impact-reviewer`.

### 6. Credenciales y secretos
- Nunca commitear `.env*`, `PROJECT.md`, `.claude/settings.local.json`, `*.sql`.
- Lectura de `.env*` pide confirmación al usuario (configurado en `permissions.ask`).
- Credenciales de prueba viven en `PROJECT.md` (local).

---

## Tooling disponible

### Subagents (`.claude/agents/`)

| Agente | Cuándo usar |
| ------ | ----------- |
| `db-migration-writer` | Cualquier cambio en `prisma/schema.prisma`. Genera SQL standalone. |
| `panel-impact-reviewer` | Tocas API/auth/schema compartido — verifica impacto en los 3 paneles. |
| `rappi-design-reviewer` | Cambios UI/UX en CLIENT o PARTNER. Revisa contra principios Rappi-style (cards, categorías, bottom nav, sin mapas embebidos). |
| `security-auditor` | Cambios en auth, pagos, KYC, file upload, endpoints sensibles. |
| `supabase-runner` | Lectura read-only de la DB prod (counts, sample, verificación post-migración). |

### Slash commands (`.claude/commands/`)

| Comando | Función |
| ------- | ------- |
| `/deploy-check` | Pre-deploy: type-check + audit + env + drift DB + panel impact. |
| `/new-feature <desc>` | Análisis previo a codear: scope, modelos, APIs, UI, comunicaciones, tests. |
| `/sql-migration <name>` | Genera SQL para Supabase desde diff de schema. |
| `/test-panels` | Smoke Playwright de los 3 paneles. |
| `/rappi-review <route>` | Design review Rappi-style sobre una ruta. |

### Hooks activos

- **Bloqueo automático** de `prisma migrate/db push` y `git push --force`.
- **Aviso** cuando se edita `prisma/schema.prisma` (recordatorio SQL).
- **Aviso** cuando se edita una API compartida (sugiere `panel-impact-reviewer`).
- **Notificación macOS** al terminar tarea (`Stop` hook).

### MCP servers
Lista y guía de instalación en `.claude/MCP_SETUP.md`. **Recomendado agregar**: Supabase MCP (read-only), GitHub MCP, Sentry MCP.

### CI / GitHub Action (template inactivo)
[.claude/templates/github-claude-pr-review.yml](.claude/templates/github-claude-pr-review.yml) — workflow para que Claude revise cada PR automáticamente. **Está fuera de `.github/workflows/` adrede** para que se pueda commitear sin necesidad de un PAT con scope `workflow`.

**Cómo activarlo** (cuando tengas un PAT con scope `workflow`):
1. `mkdir -p .github/workflows && cp .claude/templates/github-claude-pr-review.yml .github/workflows/claude-pr-review.yml`
2. Añade el secret `ANTHROPIC_API_KEY` en GitHub: Settings → Secrets and variables → Actions → New repository secret.
3. `git add .github && git commit -m "ci: activate claude pr review" && git push`

---

## Checklist antes de cerrar cualquier tarea

- [ ] ¿Qué panel(es) afecta? (CLIENT / PARTNER / ADMIN / público)
- [ ] ¿Toca DB? → SQL preparado y entregado (no ejecutado).
- [ ] ¿Toca UI? → probada en `localhost:3000` mobile-first (375×812).
- [ ] `npm run lint` pasa.
- [ ] Si toca API compartida o auth → `panel-impact-reviewer` corrió.
- [ ] Si toca pagos/KYC/upload → `security-auditor` corrió.
- [ ] Si es UI cliente/socio → `rappi-design-reviewer` corrió.
- [ ] Validación final post-deploy en `lohaggo.com` señalada al usuario.

---

## Convenciones

- **Commits**: conventional (`feat(area):`, `fix(area):`, `refactor(area):`). Ver `git log`.
- **No** mezclar dominios de panel en un mismo commit salvo refactor transversal explícito.
- **No** crear documentación nueva (*.md) salvo pedido.
- **No** añadir comentarios obvios al código.
- **Mobile-first** en CLIENT y PARTNER; admin puede ser desktop-first.

---

## Si tienes dudas

1. Consulta `PROJECT.md` (local) para arquitectura detallada.
2. Si la duda persiste, pregunta al usuario antes de actuar — especialmente en cambios destructivos.

---
description: Smoke-test the three panels (CLIENT, PARTNER, ADMIN) with Playwright against localhost. Use after UI changes.
---

Run a smoke test of the three Haggo panels against `http://localhost:3000`. Use the Playwright MCP tools.

## Pre-check
1. Verify dev server is up. If not, start it in background:
   ```bash
   npm run dev
   ```
   Wait until `localhost:3000` responds.

## Accounts to use (existen en DB de prod)
- ADMIN: `admin@servicios.com` / `password123` → `/admin`
- CLIENT: `johnwainer@gmail.com` / `123456` → `/dashboard`
- PARTNER: `jvalencia@pasosalexito.com` / `John0785**` → `/partner`

## Per-panel smoke test

For each of the 3 roles:
1. Navigate to `/login`, fill form, submit.
2. Resize viewport to 375×812 (mobile baseline).
3. Take a screenshot of the landing dashboard.
4. Check console for errors (`browser_console_messages`).
5. Navigate to one secondary route:
   - ADMIN: `/admin?section=bookings`
   - CLIENT: `/dashboard` then click a section
   - PARTNER: `/partner/requests`
6. Take a second screenshot.
7. Sign out.

## Report

```
PANEL SMOKE TEST

ADMIN:    login ✓/✗ | nav ✓/✗ | console clean ✓/✗
CLIENT:   login ✓/✗ | nav ✓/✗ | console clean ✓/✗
PARTNER:  login ✓/✗ | nav ✓/✗ | console clean ✓/✗

Screenshots: <list of paths>

Issues:
- <route> — <error/warning>

Verdict: PASS / FAIL
```

Stop and report immediately if login fails for any account.

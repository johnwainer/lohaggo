---
description: Pre-deploy validation. Type-check, audit, env vars, and panel impact review on the staged diff.
---

Run a complete pre-deploy check on the current branch before the user does `git push`. Sequence:

1. **Working tree status**
   ```bash
   git status --short
   git diff --stat HEAD
   ```
   Confirm nothing accidental is staged (no `.env*`, no `PROJECT.md`, no `CLAUDE.md`, no `.sql` files).

2. **Type-check**
   ```bash
   npm run lint
   ```
   Must pass without errors.

3. **Dependency audit**
   ```bash
   npm audit --omit=dev || true
   ```
   Report HIGH/CRITICAL only; do not fail on LOW.

4. **Env validation**
   ```bash
   npm run validate-env
   ```

5. **DB schema drift check**
   If `prisma/schema.prisma` is modified, ensure a matching `.sql` file exists in `migrations/` for this change. If not, STOP and tell the user to delegate to the `db-migration-writer` subagent.

6. **Panel impact** (if shared files touched)
   If the diff touches `app/api/bookings`, `app/api/proposals`, `app/api/service-requests`, `app/api/payments`, `lib/auth.ts`, or `prisma/schema.prisma`, run the `panel-impact-reviewer` subagent.

7. **Final report**
   ```
   PRE-DEPLOY CHECK
   - Type-check: ✓ / ✗
   - Audit: ✓ / ⚠ (count of HIGH+)
   - Env: ✓ / ✗
   - DB drift: ✓ / needs SQL
   - Panel impact: ✓ / issues / skipped
   - Verdict: SAFE TO PUSH / BLOCK
   ```

If verdict is BLOCK, list the exact actions the user must take. Do not push for them.

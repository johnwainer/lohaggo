---
description: Generate a standalone SQL migration script for Supabase from the current prisma/schema.prisma diff vs main.
argument-hint: <nombre descriptivo de la migración>
---

Generate a standalone SQL migration script that the user will paste manually into Supabase SQL Editor. Name: **$ARGUMENTS**

Steps:

1. **Diff schema vs main**
   ```bash
   git diff origin/main -- prisma/schema.prisma
   ```
   If empty, ask the user what change they want to apply.

2. **Delegate to subagent**
   Spawn the `db-migration-writer` subagent with the diff and the migration name as context. It produces:
   - Updated `prisma/schema.prisma` (if not done already)
   - `migrations/<timestamp>_<name>.sql` (idempotent, with ROLLBACK section)

3. **Format check**
   ```bash
   npx prisma format
   ```

4. **Report to user**
   ```
   SQL READY
   - File: migrations/<timestamp>_<name>.sql
   - Type: <additive | destructive | online | requires-backfill>
   - Execute in: Supabase SQL Editor → New Query → paste → RUN
   - Verify after running with: <a SELECT query the user can run>
   ```

Never run the migration. The user runs it manually.

# MCP Servers recomendados para Haggo

Los MCP servers se instalan **a nivel de usuario** (no por proyecto) con el comando `claude mcp add`. Esta lista vive aquí como referencia.

## Ya activos (visibles en sesión)

- **playwright** — automatización de browser para QA visual de los 3 paneles.
- **firecrawl** — scraping/research web.
- **claude_ai_Gmail**, **claude_ai_Google_Drive**, **claude_ai_Slack**, **claude_ai_Zoho_CRM** — integraciones cloud.

## Recomendados para agregar

### 1. Supabase MCP (lectura directa de DB prod)

Útil para que el subagent `supabase-runner` consulte sin abrir psql manualmente. **No** otorga permisos de escritura (lo limitamos por convención + deny list).

```bash
claude mcp add supabase --transport stdio -- \
  npx -y @supabase/mcp-server-supabase \
  --access-token <tu-access-token-supabase> \
  --project-ref kcuwlsfdqpjjondzgdqp \
  --read-only
```

> El flag `--read-only` es **crítico**: bloquea cualquier write desde la sesión.

### 2. GitHub MCP

Permite leer/comentar/aprobar PRs sin salir de la sesión. Útil para combinar con `/deploy-check`.

```bash
claude mcp add github --transport stdio -- \
  npx -y @modelcontextprotocol/server-github
```

Necesita `GITHUB_PERSONAL_ACCESS_TOKEN` en el env del MCP server. **NO** uses el PAT que tienes en `.claude/settings.local.json` — genera uno nuevo con scope mínimo (`repo:status`, `repo_deployment`, `public_repo`, `read:user`, `read:project`) y rota el viejo.

### 3. Sentry MCP (cuando integres Sentry)

Para leer errores en prod directamente desde la sesión.

```bash
claude mcp add sentry --transport http \
  --url https://mcp.sentry.dev/sse \
  --header "Authorization: Bearer <sentry-token>"
```

## Comandos útiles

```bash
claude mcp list             # ver MCPs activos
claude mcp remove <name>    # eliminar uno
claude mcp get <name>       # ver config de uno
```

## Notas de seguridad

- Los MCP servers **viven en tu máquina** (no en Vercel) — no afectan deploy.
- Nunca incluyas tokens en archivos versionados. Usa el env del MCP server o un keychain.
- Si compartes este repo con colaboradores, ellos corren sus propios `claude mcp add` con sus credenciales.

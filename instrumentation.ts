/** Server start: send every logged error and every unhandled request error to Salud del sistema. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ setErrorSink, sanitizeForLog }, { recordError }] = await Promise.all([import('./lib/logger'), import('./lib/system/errors')])
  setErrorSink(({ context, message, error, data }) => {
    const detail = error instanceof Error ? `${message}: ${error.message}` : message
    void recordError({ source: 'server', context, message: detail, sample: { data: sanitizeForLog(data ?? (error && !(error instanceof Error) ? error : undefined)), stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6).join('\n') : undefined } })
  })
}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routerKind: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { recordError } = await import('./lib/system/errors')
  const e = err instanceof Error ? err : new Error(String(err))
  await recordError({ source: 'server', context: `${context.routeType}`, message: e.message, route: `${request.method} ${request.path.split('?')[0]}`, sample: { stack: e.stack?.split('\n').slice(0, 6).join('\n') } })
}

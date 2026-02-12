type SessionHourBucket = {
  total: number
  success: number
  rateLimited: number
  errors: number
}

type OpsHourBucket = {
  authSession429: number
  authSessionErrors: number
  loginFailures: number
  apiErrors: number
}

type OpsMinuteBucket = {
  authSession429: number
  loginFailures: number
  apiErrors: number
}

const METRICS_RETENTION_HOURS = 24

const globalState = globalThis as typeof globalThis & {
  __sessionMetrics?: Map<string, SessionHourBucket>
  __opsMetrics?: Map<string, OpsHourBucket>
  __opsMinuteMetrics?: Map<string, OpsMinuteBucket>
}

const sessionMetrics = globalState.__sessionMetrics || new Map<string, SessionHourBucket>()
const opsMetrics = globalState.__opsMetrics || new Map<string, OpsHourBucket>()
const opsMinuteMetrics = globalState.__opsMinuteMetrics || new Map<string, OpsMinuteBucket>()

globalState.__sessionMetrics = sessionMetrics
globalState.__opsMetrics = opsMetrics
globalState.__opsMinuteMetrics = opsMinuteMetrics

const hourKey = (d = new Date()) => d.toISOString().slice(0, 13)
const minuteKey = (d = new Date()) => d.toISOString().slice(0, 16)

function pruneOldBuckets<T>(map: Map<string, T>, retentionHours: number) {
  const now = Date.now()
  for (const key of Array.from(map.keys())) {
    const bucketTime = Date.parse(`${key}:00:00.000Z`)
    if (Number.isNaN(bucketTime)) continue
    const diffHours = (now - bucketTime) / (1000 * 60 * 60)
    if (diffHours > retentionHours) {
      map.delete(key)
    }
  }
}

function pruneOldMinuteBuckets(map: Map<string, OpsMinuteBucket>, retentionMinutes: number) {
  const now = Date.now()
  for (const key of Array.from(map.keys())) {
    const bucketTime = Date.parse(`${key}:00.000Z`)
    if (Number.isNaN(bucketTime)) continue
    const diffMinutes = (now - bucketTime) / (1000 * 60)
    if (diffMinutes > retentionMinutes) {
      map.delete(key)
    }
  }
}

export function recordAuthSessionMetric(status: number, rateLimitHit: boolean) {
  const key = hourKey()
  const bucket = sessionMetrics.get(key) || {
    total: 0,
    success: 0,
    rateLimited: 0,
    errors: 0,
  }

  bucket.total += 1
  if (status >= 200 && status < 400) bucket.success += 1
  if (rateLimitHit || status === 429) bucket.rateLimited += 1
  if (status >= 400 && status !== 429) bucket.errors += 1

  sessionMetrics.set(key, bucket)
  pruneOldBuckets(sessionMetrics, METRICS_RETENTION_HOURS)
}

export type OperationalMetricType =
  | 'auth_session_429'
  | 'auth_session_error'
  | 'login_failure'
  | 'api_error'

export function recordOperationalMetric(type: OperationalMetricType) {
  const hKey = hourKey()
  const mKey = minuteKey()

  const hourBucket = opsMetrics.get(hKey) || {
    authSession429: 0,
    authSessionErrors: 0,
    loginFailures: 0,
    apiErrors: 0,
  }

  const minuteBucket = opsMinuteMetrics.get(mKey) || {
    authSession429: 0,
    loginFailures: 0,
    apiErrors: 0,
  }

  if (type === 'auth_session_429') {
    hourBucket.authSession429 += 1
    minuteBucket.authSession429 += 1
  } else if (type === 'auth_session_error') {
    hourBucket.authSessionErrors += 1
  } else if (type === 'login_failure') {
    hourBucket.loginFailures += 1
    minuteBucket.loginFailures += 1
  } else if (type === 'api_error') {
    hourBucket.apiErrors += 1
    minuteBucket.apiErrors += 1
  }

  opsMetrics.set(hKey, hourBucket)
  opsMinuteMetrics.set(mKey, minuteBucket)
  pruneOldBuckets(opsMetrics, METRICS_RETENTION_HOURS)
  pruneOldMinuteBuckets(opsMinuteMetrics, 120)
}

export function getAuthSessionMetrics(hours = 24) {
  const now = Date.now()
  return Array.from(sessionMetrics.entries())
    .filter(([key]) => {
      const bucketTime = Date.parse(`${key}:00:00.000Z`)
      if (Number.isNaN(bucketTime)) return false
      return now - bucketTime <= hours * 60 * 60 * 1000
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, metrics]) => ({ hour, ...metrics }))
}

export function getOperationalMetrics(hours = 24) {
  const now = Date.now()
  const byHour = Array.from(opsMetrics.entries())
    .filter(([key]) => {
      const bucketTime = Date.parse(`${key}:00:00.000Z`)
      if (Number.isNaN(bucketTime)) return false
      return now - bucketTime <= hours * 60 * 60 * 1000
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, metrics]) => ({ hour, ...metrics }))

  const last5Minutes = Array.from(opsMinuteMetrics.entries())
    .filter(([key]) => {
      const bucketTime = Date.parse(`${key}:00.000Z`)
      if (Number.isNaN(bucketTime)) return false
      return now - bucketTime <= 5 * 60 * 1000
    })
    .reduce(
      (acc, [, bucket]) => {
        acc.authSession429 += bucket.authSession429
        acc.loginFailures += bucket.loginFailures
        acc.apiErrors += bucket.apiErrors
        return acc
      },
      { authSession429: 0, loginFailures: 0, apiErrors: 0 }
    )

  const alerts = []
  if (last5Minutes.authSession429 >= 20) {
    alerts.push({
      key: 'auth_session_429_spike',
      level: 'critical',
      message: 'Spike de 429 en /api/auth/session en los últimos 5 minutos',
      count: last5Minutes.authSession429,
    })
  }
  if (last5Minutes.loginFailures >= 10) {
    alerts.push({
      key: 'login_failures_spike',
      level: 'warning',
      message: 'Spike de fallos de login en los últimos 5 minutos',
      count: last5Minutes.loginFailures,
    })
  }
  if (last5Minutes.apiErrors >= 10) {
    alerts.push({
      key: 'api_errors_spike',
      level: 'critical',
      message: 'Spike de errores de API en los últimos 5 minutos',
      count: last5Minutes.apiErrors,
    })
  }

  return { byHour, last5Minutes, alerts }
}

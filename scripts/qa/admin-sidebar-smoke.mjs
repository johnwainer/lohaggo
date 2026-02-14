import fs from 'fs/promises'

let chromium
try {
  const playwright = await import('playwright')
  chromium = playwright.chromium
} catch {
  const playwright = await import('/tmp/lohaggo-final-qa/node_modules/playwright/index.mjs')
  chromium = playwright.chromium
}

const BASE = process.env.QA_BASE_URL || 'https://www.lohaggo.com'
const OUT = process.env.QA_OUT || 'docs/qa/admin-sidebar-smoke.json'

const creds = {
  email: process.env.QA_ADMIN_EMAIL,
  password: process.env.QA_ADMIN_PASSWORD,
}

const targets = [
  { id: 'dashboard', group: 'panel-general', expected: ['/admin', '/admin?section=dashboard'] },
  { id: 'training', group: 'panel-general', expected: ['/admin/training'] },
  { id: 'monitoring', group: 'panel-general', expected: ['/admin/monitoring'] },
  { id: 'analytics', group: 'panel-general', expected: ['/admin?section=analytics'] },
  { id: 'bookings', group: 'operacion-diaria', expected: ['/admin?section=bookings'] },
  { id: 'payments', group: 'operacion-diaria', expected: ['/admin?section=payments'] },
  { id: 'payouts', group: 'operacion-diaria', expected: ['/admin?section=payouts'] },
  { id: 'finance-ops', group: 'operacion-diaria', expected: ['/admin/finance-ops'] },
  { id: 'users', group: 'usuarios-y-verificacion', expected: ['/admin?section=users'] },
  { id: 'partners', group: 'usuarios-y-verificacion', expected: ['/admin?section=partners'] },
  { id: 'compliance', group: 'usuarios-y-verificacion', expected: ['/admin/compliance'] },
  { id: 'documents', group: 'usuarios-y-verificacion', expected: ['/admin/documents'] },
  { id: 'services', group: 'servicios-y-ubicaciones', expected: ['/admin?section=services'] },
  { id: 'cities', group: 'servicios-y-ubicaciones', expected: ['/admin?section=cities'] },
  { id: 'ads', group: 'marketing', expected: ['/admin/ads'] },
  { id: 'search-analytics', group: 'marketing', expected: ['/admin/search-analytics'] },
  { id: 'platform-control', group: 'marketing', expected: ['/admin/platform-control'] },
  { id: 'commissions', group: 'configuracion', expected: ['/admin?section=commissions'] },
  { id: 'payment-config', group: 'configuracion', expected: ['/admin/payment-config'] },
  { id: 'security', group: 'configuracion', expected: ['/admin/security'] },
  { id: 'notifications', group: 'configuracion', expected: ['/admin?section=notifications'] },
  { id: 'settings', group: 'configuracion', expected: ['/admin?section=settings'] },
]

async function dismissOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.locator('label:has-text("He leído y acepto")').first().click({ timeout: 500 }).catch(() => {})
  await page.locator('button:has-text("Aceptar y continuar")').first().click({ timeout: 700 }).catch(() => {})
  await page.locator('button:has-text("Aceptar")').first().click({ timeout: 700 }).catch(() => {})
  await page.locator('div[aria-label="Selector de ciudad"]').click({ position: { x: 10, y: 10 }, timeout: 500 }).catch(() => {})
}

async function run() {
  const required = ['QA_ADMIN_EMAIL', 'QA_ADMIN_PASSWORD']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing QA env vars: ${missing.join(', ')}`)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const req = context.request
  const csrf = await (await req.get(`${BASE}/api/auth/csrf`)).json()
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: creds.email,
    password: creds.password,
    callbackUrl: `${BASE}/admin`,
    json: 'true',
  })

  const loginRes = await req.post(`${BASE}/api/auth/callback/credentials`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: body.toString(),
  })

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await dismissOverlays(page)

  const results = []

  for (const target of targets) {
    await dismissOverlays(page)
    const groupButton = page.locator(`[data-testid="admin-group-${target.group}"]`).first()
    if (await groupButton.isVisible().catch(() => false)) {
      const expanded = await groupButton.getAttribute('aria-expanded').catch(() => null)
      if (expanded === 'false') {
        await groupButton.click({ force: true, timeout: 3000 }).catch(() => {})
      }
    }

    const locator = page.locator(`[data-testid="admin-nav-${target.id}"]`).first()

    const visible = await locator.isVisible().catch(() => false)
    let clicked = false

    if (visible) {
      await locator.click({ force: true, timeout: 4000 }).catch(() => {})
      clicked = true
    }

    await page.waitForTimeout(700)
    const url = page.url()
    const ok = clicked && target.expected.some((expectedUrl) => url.includes(expectedUrl))
    results.push({ id: target.id, clicked, ok, expected: target.expected, url })
  }

  const summary = {
    baseUrl: BASE,
    generatedAt: new Date().toISOString(),
    loginStatus: loginRes.status(),
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    results,
  }

  await fs.mkdir('docs/qa', { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2))

  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

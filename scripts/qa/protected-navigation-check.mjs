import fs from 'fs/promises'

let chromium
let devices

try {
  const playwright = await import('playwright')
  chromium = playwright.chromium
  devices = playwright.devices
} catch {
  const playwright = await import('/tmp/lohaggo-final-qa/node_modules/playwright/index.mjs')
  chromium = playwright.chromium
  devices = playwright.devices
}

const BASE = process.env.QA_BASE_URL || 'https://www.lohaggo.com'
const OUT = 'docs/qa/protected-navigation-report.json'

const users = {
  client: {
    email: process.env.QA_CLIENT_EMAIL || 'johnwainer@gmail.com',
    password: process.env.QA_CLIENT_PASSWORD || '123456',
    home: '/dashboard',
    routes: ['/dashboard', '/profile', '/dashboard/addresses', '/dashboard/payment-methods', '/notifications', '/my-ratings'],
  },
  partner: {
    email: process.env.QA_PARTNER_EMAIL || 'jvalencia@pasosalexito.com',
    password: process.env.QA_PARTNER_PASSWORD || '123456',
    home: '/partner',
    routes: ['/partner', '/partner/services', '/partner/verification', '/partner/notifications', '/profile'],
  },
}

async function loginByApi(context, user) {
  const req = context.request
  const csrf = await (await req.get(`${BASE}/api/auth/csrf`)).json()
  const params = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: user.email,
    password: user.password,
    callbackUrl: `${BASE}${user.home}`,
    json: 'true',
  })

  const post = await req.post(`${BASE}/api/auth/callback/credentials`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: params.toString(),
  })

  return post.status() === 200
}

async function run() {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    scenarios: [],
  }

  const viewports = [
    ['desktop', { viewport: { width: 1366, height: 820 } }],
    ['mobile', { ...devices['iPhone 13'] }],
  ]

  for (const [viewport, options] of viewports) {
    for (const [role, user] of Object.entries(users)) {
      const browser = await chromium.launch({ headless: true })
      const context = await browser.newContext(options)
      const page = await context.newPage()

      const loginOk = await loginByApi(context, user)

      const validSession = []
      for (const route of user.routes) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(700)
        validSession.push({ route, finalUrl: page.url(), ok: page.url().includes(route) })
      }

      const incognitoContext = await browser.newContext(options)
      const incognitoPage = await incognitoContext.newPage()
      const incognito = []
      for (const route of user.routes.slice(0, 3)) {
        await incognitoPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
        await incognitoPage.waitForTimeout(600)
        incognito.push({ route, finalUrl: incognitoPage.url(), ok: incognitoPage.url().includes('/login') })
      }
      await incognitoContext.close()

      report.scenarios.push({ viewport, role, loginOk, validSession, incognito })
      await browser.close()
    }
  }

  await fs.mkdir('docs/qa', { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(report, null, 2))

  const summary = report.scenarios.map((s) => ({
    viewport: s.viewport,
    role: s.role,
    loginOk: s.loginOk,
    validOk: `${s.validSession.filter((x) => x.ok).length}/${s.validSession.length}`,
    incognitoOk: `${s.incognito.filter((x) => x.ok).length}/${s.incognito.length}`,
  }))

  console.log(JSON.stringify(summary, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

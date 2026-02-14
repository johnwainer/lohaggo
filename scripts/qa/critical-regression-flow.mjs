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
const OUT = 'docs/qa/critical-regression-flow.json'

const users = {
  client: {
    email: process.env.QA_CLIENT_EMAIL,
    password: process.env.QA_CLIENT_PASSWORD,
  },
  partner: {
    email: process.env.QA_PARTNER_EMAIL,
    password: process.env.QA_PARTNER_PASSWORD,
  },
  admin: {
    email: process.env.QA_ADMIN_EMAIL,
    password: process.env.QA_ADMIN_PASSWORD,
  },
}

async function loginByApi(context, email, password, callbackUrl) {
  const req = context.request
  const csrf = await (await req.get(`${BASE}/api/auth/csrf`)).json()
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl,
    json: 'true',
  })
  const post = await req.post(`${BASE}/api/auth/callback/credentials`, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    data: body.toString(),
  })
  return post.status() === 200
}

function hasAnyUrl(url, candidates) {
  return candidates.some((candidate) => url.includes(candidate))
}

async function runScenario(role, target) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await context.newPage()
  const user = users[role]
  const result = { role, loginOk: false, checks: [] }

  result.loginOk = await loginByApi(context, user.email, user.password, `${BASE}${target.home}`)
  await page.goto(`${BASE}${target.home}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)

  for (const check of target.checks) {
    await page.goto(`${BASE}${check.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const url = page.url()
    result.checks.push({
      id: check.id,
      path: check.path,
      ok: hasAnyUrl(url, check.expect),
      url,
      expect: check.expect,
    })
  }

  await browser.close()
  return result
}

async function run() {
  const required = [
    'QA_CLIENT_EMAIL',
    'QA_CLIENT_PASSWORD',
    'QA_PARTNER_EMAIL',
    'QA_PARTNER_PASSWORD',
    'QA_ADMIN_EMAIL',
    'QA_ADMIN_PASSWORD',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing QA env vars: ${missing.join(', ')}`)
  }

  const targets = {
    client: {
      home: '/dashboard',
      checks: [
        { id: 'login', path: '/dashboard', expect: ['/dashboard'] },
        { id: 'service-request', path: '/solicitar', expect: ['/solicitar', '/servicios'] },
        { id: 'payment-methods', path: '/dashboard/payment-methods', expect: ['/dashboard/payment-methods'] },
        { id: 'booking-cancel', path: '/my-bookings', expect: ['/my-bookings'] },
      ],
    },
    partner: {
      home: '/partner',
      checks: [
        { id: 'login', path: '/partner', expect: ['/partner'] },
        { id: 'proposals', path: '/partner', expect: ['/partner'] },
        { id: 'payouts-bank', path: '/partner/bank-accounts', expect: ['/partner/bank-accounts'] },
        { id: 'profile', path: '/profile', expect: ['/profile'] },
      ],
    },
    admin: {
      home: '/admin',
      checks: [
        { id: 'dashboard', path: '/admin', expect: ['/admin'] },
        { id: 'finance-ops', path: '/admin/finance-ops', expect: ['/admin/finance-ops'] },
        { id: 'compliance', path: '/admin/compliance', expect: ['/admin/compliance'] },
        { id: 'security', path: '/admin/security', expect: ['/admin/security'] },
      ],
    },
  }

  const [client, partner, admin] = await Promise.all([
    runScenario('client', targets.client),
    runScenario('partner', targets.partner),
    runScenario('admin', targets.admin),
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    scenarios: [client, partner, admin],
  }

  await fs.mkdir('docs/qa', { recursive: true })
  await fs.writeFile(OUT, JSON.stringify(report, null, 2))

  const summary = report.scenarios.map((scenario) => ({
    role: scenario.role,
    loginOk: scenario.loginOk,
    pass: scenario.checks.filter((check) => check.ok).length,
    fail: scenario.checks.filter((check) => !check.ok).length,
  }))

  console.log(JSON.stringify(summary, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})

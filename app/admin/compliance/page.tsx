'use client'

import { useEffect, useState } from 'react'

type ComplianceRule = {
  id: string
  key: string
  name: string
  ruleType: 'DOCUMENT_REQUIRED' | 'RISK_SCORE_THRESHOLD' | 'CITY_RESTRICTION' | 'SERVICE_RESTRICTION'
  enabled: boolean
  country: string
  city: string | null
  serviceSlug: string | null
}

type ComplianceEvaluation = {
  id: string
  status: 'PASS' | 'WARNING' | 'FAIL'
  score: number
  findings: string
  evaluatedAt: string
  partner: { id: string; user: { name: string | null; email: string } | null } | null
}

export default function AdminCompliancePage() {
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [evaluations, setEvaluations] = useState<ComplianceEvaluation[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [rulesRes, evalRes] = await Promise.all([
        fetch('/api/admin/compliance/rules', { cache: 'no-store' }),
        fetch('/api/admin/compliance/evaluations', { cache: 'no-store' }),
      ])
      const [rulesData, evalData] = await Promise.all([rulesRes.json(), evalRes.json()])
      setRules(rulesData.rules || [])
      setEvaluations(evalData.evaluations || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleRule = async (rule: ComplianceRule) => {
    await fetch('/api/admin/compliance/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Compliance KYC / KYB</h1>
        <p className="text-gray-600 mt-1">Reglas por país, ciudad y servicio para evaluación de riesgo operacional.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Reglas activas</p>
              <p className="text-3xl font-bold">{rules.filter((r) => r.enabled).length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Evaluaciones FAIL</p>
              <p className="text-3xl font-bold">{evaluations.filter((e) => e.status === 'FAIL').length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Evaluaciones WARNING</p>
              <p className="text-3xl font-bold">{evaluations.filter((e) => e.status === 'WARNING').length}</p>
            </div>
          </div>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Reglas de cumplimiento</h2>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-xs text-gray-500">
                      {rule.ruleType} · {rule.country}{rule.city ? `/${rule.city}` : ''}{rule.serviceSlug ? ` · ${rule.serviceSlug}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`px-3 py-1 rounded text-sm ${rule.enabled ? 'bg-green-600 text-white' : 'border'}`}
                  >
                    {rule.enabled ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Últimas evaluaciones</h2>
            <div className="space-y-2">
              {evaluations.slice(0, 30).map((evaluation) => (
                <div key={evaluation.id} className="border rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {evaluation.partner?.user?.name || evaluation.partner?.user?.email || evaluation.partner?.id || 'Socio'}
                    </p>
                    <span className="text-sm font-semibold">{evaluation.status} · score {evaluation.score}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{evaluation.findings}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

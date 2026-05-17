'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

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
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin mr-3" />
          <span className="text-sm font-medium">Cargando…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reglas activas</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{rules.filter((r) => r.enabled).length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Evaluaciones FAIL</p>
              <p className="text-3xl font-black text-red-600 mt-1">{evaluations.filter((e) => e.status === 'FAIL').length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Evaluaciones WARNING</p>
              <p className="text-3xl font-black text-yellow-600 mt-1">{evaluations.filter((e) => e.status === 'WARNING').length}</p>
            </div>
          </div>

          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900">Reglas de cumplimiento</h2>
            <div className="space-y-2">
              {rules.length === 0 && <p className="text-sm text-gray-400">Sin reglas configuradas.</p>}
              {rules.map((rule) => (
                <div key={rule.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{rule.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {rule.ruleType} · {rule.country}{rule.city ? `/${rule.city}` : ''}{rule.serviceSlug ? ` · ${rule.serviceSlug}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      rule.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {rule.enabled ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900">Últimas evaluaciones</h2>
            <div className="space-y-2">
              {evaluations.length === 0 && <p className="text-sm text-gray-400">Sin evaluaciones registradas.</p>}
              {evaluations.slice(0, 30).map((evaluation) => (
                <div key={evaluation.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-gray-900">
                      {evaluation.partner?.user?.name || evaluation.partner?.user?.email || evaluation.partner?.id || 'Socio'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        evaluation.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                        evaluation.status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{evaluation.status}</span>
                      <span className="text-xs text-gray-500">score {evaluation.score}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{evaluation.findings}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

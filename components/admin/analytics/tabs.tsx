'use client'

import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChannelIcon, channelLabel } from '@/components/admin/ChannelIcon'
import { BarList, CITY_LABEL, Card, Empty, Kpi, axis, dayLabel, hours, minutes, money, monthLabel, num, pct, tooltipStyle } from '@/components/admin/analytics/ui'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any

// ─── Negocio ────────────────────────────────────────────────────────────────

export function BusinessTab({ d }: { d: Data }) {
  const k = d.kpis
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Dinero cobrado" value={money(k.amount.value)} change={k.amount.change} />
        <Kpi label="Comisión de la plataforma" value={money(k.commission.value)} change={k.commission.change} />
        <Kpi label="Ticket promedio" value={money(k.ticket.value)} change={k.ticket.change} hint={`${num(k.payments.value)} pagos`} />
        <Kpi label="Reservas creadas" value={num(k.bookings.value)} change={k.bookings.change} hint={`${pct(k.completionRate.value)} completadas · ${pct(k.cancellationRate.value)} canceladas`} />
      </div>
      <Card title="Últimos 12 meses" subtitle="Dinero cobrado por mes (pagos aprobados, por fecha de pago) y reservas creadas">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.monthly.map((m: Data) => ({ ...m, label: monthLabel(m.month) }))}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis yAxisId="m" {...axis} tickFormatter={(v: number) => money(v)} width={70} />
              <YAxis yAxisId="c" orientation="right" {...axis} allowDecimals={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [name === 'Cobrado' ? money(Number(v ?? 0)) : num(Number(v ?? 0)), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="m" dataKey="amount" name="Cobrado" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Line yAxisId="c" dataKey="bookings" name="Reservas" stroke="#0EA5E9" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Por servicio" subtitle="Cobrado en el periodo · reservas">
          <BarList rows={d.byService.map((r: Data) => ({ name: r.name, value: r.amount, detail: `${r.bookings} res.` }))} format={money} color="bg-emerald-500" />
        </Card>
        <Card title="Por categoría">
          <BarList rows={d.byCategory.map((r: Data) => ({ name: r.name, value: r.amount, detail: `${r.bookings} res.` }))} format={money} color="bg-emerald-500" />
        </Card>
        <Card title="Por ciudad">
          <BarList rows={d.byCity.map((r: Data) => ({ name: CITY_LABEL[r.name] ?? r.name, value: r.amount, detail: `${r.bookings} res.` }))} format={money} color="bg-emerald-500" />
        </Card>
      </div>
    </div>
  )
}

// ─── Embudo ─────────────────────────────────────────────────────────────────

export function FunnelTab({ d }: { d: Data }) {
  const first = d.stages[0]?.count || 0
  const STATUS: Record<string, string> = { ACTIVE: 'Activas', ACCEPTED: 'Aceptadas', EXPIRED: 'Vencidas', CANCELLED: 'Canceladas' }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Búsquedas en el sitio" value={num(d.searches.total)} change={d.searches.change} hint={`${num(d.searches.people)} personas`} />
        <Kpi label="Solicitudes" value={num(first)} change={d.previous[0]?.count ? Math.round(((first - d.previous[0].count) / d.previous[0].count) * 1000) / 10 : first ? null : 0} />
        <Kpi label="Primera propuesta (mediana)" value={hours(d.firstProposalHours.median)} hint={`75 % en menos de ${hours(d.firstProposalHours.p75)}`} />
        <Kpi label="Reservas directas" value={num(d.directBookings)} hint="sin pasar por solicitud" />
      </div>
      <Card title="Embudo de las solicitudes del periodo" subtitle="Se sigue cada solicitud creada en el periodo hasta el pago: son las mismas personas en cada etapa">
        {!first ? <p className="text-sm text-gray-500">No hubo solicitudes en este periodo.</p> : (
          <div className="space-y-3">
            {d.stages.map((s: Data, i: number) => (
              <div key={s.key} className="grid grid-cols-[160px_1fr_120px] items-center gap-3 text-sm">
                <span className="text-gray-700">{s.label}</span>
                <div className="h-8 rounded-lg bg-gray-100">
                  <div className="flex h-8 items-center rounded-lg bg-gradient-to-r from-primary-500 to-primary-400 px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(3, (s.count / first) * 100)}%` }}>{num(s.count)}</div>
                </div>
                <span className="text-right text-xs text-gray-500">{i === 0 ? '—' : <><strong className="text-gray-800">{pct(s.fromPrevious)}</strong> de la etapa anterior</>}<br />{i > 0 && <>{pct(s.fromStart)} del total · antes {pct(d.previous[i]?.fromStart)}</>}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Solicitudes por día" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.daily.map((x: Data) => ({ ...x, label: dayLabel(x.d) }))}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="label" {...axis} minTickGap={20} />
                <YAxis {...axis} allowDecimals={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [num(Number(v ?? 0)), 'Solicitudes']} />
                <Bar dataKey="n" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Cómo terminaron las solicitudes">
          <BarList rows={d.requestStatus.map((s: Data) => ({ name: STATUS[s.status] ?? s.status, value: s.n }))} />
        </Card>
      </div>
    </div>
  )
}

// ─── Oferta y demanda ───────────────────────────────────────────────────────

export function SupplyTab({ d }: { d: Data }) {
  return (
    <div className="space-y-4">
      {d.gaps.length > 0 && (
        <Card title="Dónde faltan socios" subtitle="Servicios con solicitudes y sin socios verificados, o donde menos de la mitad de las solicitudes recibe propuesta">
          <div className="flex flex-wrap gap-2">
            {d.gaps.map((g: Data) => (
              <span key={g.name} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                {g.name}: {g.requests} solicitudes · {g.partners} socios · {pct(g.answeredRate)} con propuesta
              </span>
            ))}
          </div>
        </Card>
      )}
      <Card title="Por servicio" subtitle="Demanda del periodo frente a socios verificados y activos que lo ofrecen">
        {!d.services.length ? <p className="text-sm text-gray-500">Sin solicitudes ni socios con estos filtros.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="py-2 pr-3">Servicio</th><th className="px-3 text-right">Solicitudes</th><th className="px-3 text-right">Con propuesta</th><th className="px-3 text-right">1.ª propuesta</th><th className="px-3 text-right">Socios</th><th className="pl-3 text-right">Solicitudes por socio</th></tr></thead>
              <tbody>
                {d.services.map((s: Data) => (
                  <tr key={s.name} className="border-t border-gray-100">
                    <td className="py-2 pr-3"><p className="text-gray-900">{s.name}</p><p className="text-[11px] text-gray-400">{s.category}</p></td>
                    <td className="px-3 text-right tabular-nums">{num(s.requests)}</td>
                    <td className={`px-3 text-right tabular-nums ${s.requests && (s.answeredRate ?? 0) < 50 ? 'text-rose-600 font-semibold' : ''}`}>{s.requests ? pct(s.answeredRate) : '—'}</td>
                    <td className="px-3 text-right tabular-nums">{hours(s.medianHours)}</td>
                    <td className={`px-3 text-right tabular-nums ${s.partners === 0 && s.requests ? 'text-rose-600 font-semibold' : ''}`}>{num(s.partners)}</td>
                    <td className="pl-3 text-right tabular-nums">{s.pressure == null ? (s.requests ? 'sin socios' : '—') : s.pressure.toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Por ciudad" subtitle="Solicitudes del periodo · socios verificados activos">
          <BarList rows={d.cities.map((c: Data) => ({ name: CITY_LABEL[c.city] ?? c.city, value: c.requests, detail: `${c.partners} socios` }))} />
        </Card>
        <Card title="Búsquedas sin resultados" subtitle="Lo que la gente busca y no encuentra: servicios que faltan o nombres que no reconocemos">
          <BarList rows={d.zeroResults.map((z: Data) => ({ name: z.q, value: z.n, detail: `${z.people} personas` }))} empty="Ninguna búsqueda sin resultados en el periodo (o aún no hay datos: el registro empezó con esta versión)." color="bg-amber-500" />
        </Card>
      </div>
    </div>
  )
}

// ─── Clientes y socios ──────────────────────────────────────────────────────

export function PeopleTab({ d }: { d: Data }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Clientes que reservaron" value={num(d.activeClients)} hint="en el periodo" />
        <Kpi label="Clientes que volvieron" value={num(d.returningClients)} hint={d.activeClients ? `${pct((d.returningClients / d.activeClients) * 100)} ya habían reservado antes` : undefined} />
        <Kpi label="Clientes nuevos (12 meses)" value={num(d.signups.reduce((a: number, s: Data) => a + s.clients, 0))} />
        <Kpi label="Socios nuevos (12 meses)" value={num(d.signups.reduce((a: number, s: Data) => a + s.partners, 0))} />
      </div>
      <Card title="Registros por mes">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.signups.map((s: Data) => ({ ...s, label: monthLabel(s.month) }))}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} allowDecimals={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="clients" name="Clientes" stackId="a" fill="#7C3AED" />
              <Bar dataKey="partners" name="Socios" stackId="a" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cohortes de clientes" subtitle="Por mes de registro: cuántos reservaron en sus primeros 30 días y cuántos volvieron a reservar">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Mes</th><th className="text-right">Registrados</th><th className="text-right">Reservaron (30 d)</th><th className="text-right">Repitieron</th></tr></thead>
            <tbody>{d.clientCohorts.map((c: Data) => <tr key={c.month} className="border-t border-gray-100"><td className="py-1.5">{monthLabel(c.month)}</td><td className="text-right tabular-nums">{num(c.users)}</td><td className="text-right tabular-nums">{pct(c.activatedRate)}</td><td className="text-right tabular-nums">{pct(c.repeatRate)}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Cohortes de socios" subtitle="Por mes de registro: cuántos se verificaron y cuántos completaron al menos un trabajo">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Mes</th><th className="text-right">Registrados</th><th className="text-right">Verificados</th><th className="text-right">Trabajaron</th></tr></thead>
            <tbody>{d.partnerCohorts.map((c: Data) => <tr key={c.month} className="border-t border-gray-100"><td className="py-1.5">{monthLabel(c.month)}</td><td className="text-right tabular-nums">{num(c.users)}</td><td className="text-right tabular-nums">{pct(c.verifiedRate)}</td><td className="text-right tabular-nums">{pct(c.workedRate)}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>
      <Card title="De dónde llegan" subtitle="Cuentas nuevas del periodo según su primera visita (UTM o sitio que las trajo) y cuántas terminaron reservando">
        {!d.sources.length ? <p className="text-sm text-gray-500">Sin cuentas nuevas en el periodo.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Fuente</th><th className="text-right">Clientes</th><th className="text-right">Socios</th><th className="text-right">Reservaron</th><th className="pl-3">Campañas</th></tr></thead>
            <tbody>{d.sources.map((s: Data) => <tr key={s.source} className="border-t border-gray-100"><td className="py-1.5 text-gray-900">{s.source}</td><td className="text-right tabular-nums">{num(s.clients)}</td><td className="text-right tabular-nums">{num(s.partners)}</td><td className="text-right tabular-nums">{num(s.booked)} <span className="text-xs text-gray-400">({pct(s.conversion)})</span></td><td className="pl-3 text-xs text-gray-500">{s.campaigns.join(', ') || '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ─── Atención ───────────────────────────────────────────────────────────────

export function ServiceTab({ d }: { d: Data }) {
  const k = d.kpis
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Conversaciones nuevas" value={num(k.conversations.value)} change={k.conversations.change} />
        <Kpi label="Resueltas solo por la IA" value={pct(k.aiResolved)} hint={`${num(k.handoffs)} pasaron a una persona`} />
        <Kpi label="Primera respuesta (mediana)" value={minutes(k.firstResponse.median)} hint={`90 % en menos de ${minutes(k.firstResponse.p90)}`} />
        <Kpi label="Primera respuesta: IA / personas" value={`${minutes(k.firstResponse.ai)} / ${minutes(k.firstResponse.human)}`} hint={`${num(k.firstResponse.answered)} respondidas`} />
      </div>
      <Card title="Mensajes por día" subtitle="Recibidos y respondidos por la IA o por personas">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.daily.map((x: Data) => ({ ...x, label: dayLabel(x.d) }))}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={20} />
              <YAxis {...axis} allowDecimals={false} width={35} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inbound" name="Recibidos" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ai" name="Respuestas IA" stackId="o" fill="#8B5CF6" />
              <Bar dataKey="human" name="Respuestas personas" stackId="o" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Por canal">
        {!d.byChannel.length ? <p className="text-sm text-gray-500">Sin conversaciones en el periodo.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Canal</th><th className="text-right">Conversaciones</th><th className="text-right">Solo IA</th><th className="text-right">Pasaron a persona</th></tr></thead>
            <tbody>{d.byChannel.map((c: Data) => <tr key={c.channel} className="border-t border-gray-100"><td className="py-1.5"><span className="flex items-center gap-2"><ChannelIcon channel={c.channel} size={16} />{channelLabel(c.channel)}</span></td><td className="text-right tabular-nums">{num(c.conversations)}</td><td className="text-right tabular-nums">{pct(c.aiResolved)}</td><td className="text-right tabular-nums">{num(c.handoffs)}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ─── Búsquedas ──────────────────────────────────────────────────────────────

export function SearchTab({ d }: { d: Data }) {
  const k = d.kpis
  const ROLE: Record<string, string> = { VISITOR: 'Visitantes sin cuenta', CLIENT: 'Clientes', PARTNER: 'Socios', ADMIN: 'Equipo' }
  if (!d.trackingSince) return <Empty>El registro completo de búsquedas empieza con esta versión: todas las búsquedas (también de visitantes y sin resultados) aparecerán aquí desde ahora.</Empty>
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Registro completo desde el {new Date(d.trackingSince).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Búsquedas" value={num(k.total.value)} change={k.total.change} />
        <Kpi label="Personas que buscaron" value={num(k.people)} />
        <Kpi label="Términos distintos" value={num(k.terms)} />
        <Kpi label="Sin resultados" value={pct(k.zeroRate.value)} hint={`antes ${pct(k.zeroRate.previous)}`} />
      </div>
      <Card title="Búsquedas por día">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.daily.map((x: Data) => ({ ...x, ok: x.n - x.zero, label: dayLabel(x.d) }))}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={20} />
              <YAxis {...axis} allowDecimals={false} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ok" name="Con resultados" stackId="s" fill="#7C3AED" />
              <Bar dataKey="zero" name="Sin resultados" stackId="s" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Lo más buscado" className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Término</th><th className="text-right">Búsquedas</th><th className="text-right">Personas</th><th className="text-right">Resultados (prom.)</th><th className="text-right">Sin resultados</th></tr></thead>
            <tbody>{d.top.map((t: Data) => <tr key={t.q} className="border-t border-gray-100"><td className="py-1.5 text-gray-900">{t.q}</td><td className="text-right tabular-nums">{num(t.n)}</td><td className="text-right tabular-nums">{num(t.people)}</td><td className="text-right tabular-nums">{num(t.results)}</td><td className={`text-right tabular-nums ${(t.zeroRate ?? 0) > 50 ? 'font-semibold text-amber-600' : ''}`}>{pct(t.zeroRate)}</td></tr>)}</tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card title="Quién busca"><BarList rows={d.byRole.map((r: Data) => ({ name: ROLE[r.role] ?? r.role, value: r.n }))} /></Card>
          <Card title="Hora del día (Bogotá)">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.byHour}>
                  <XAxis dataKey="h" {...axis} interval={3} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(h) => `${h}:00`} formatter={(v) => [num(Number(v ?? 0)), 'Búsquedas']} />
                  <Bar dataKey="n" fill="#A78BFA" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Tráfico web (GA4) ──────────────────────────────────────────────────────

export function TrafficTab({ d }: { d: Data }) {
  const k = d.kpis
  const secs = (s: number | null) => (s == null ? '—' : `${Math.floor(s / 60)} min ${s % 60} s`)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Usuarios" value={num(k.users.value)} change={k.users.change} hint={`${num(k.newUsers.value)} nuevos`} />
        <Kpi label="Sesiones" value={num(k.sessions.value)} change={k.sessions.change} />
        <Kpi label="Páginas vistas" value={num(k.pageviews.value)} change={k.pageviews.change} />
        <Kpi label="Sesiones con interacción" value={pct(k.engagementRate)} hint={`duración media ${secs(k.avgSessionSeconds)}`} />
      </div>
      <Card title="Usuarios y sesiones por día">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.daily.map((x: Data) => ({ ...x, label: dayLabel(x.d) }))}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" {...axis} minTickGap={20} />
              <YAxis {...axis} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sessions" name="Sesiones" fill="#DDD6FE" radius={[4, 4, 0, 0]} />
              <Line dataKey="users" name="Usuarios" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Canales" subtitle="Cómo llegan las sesiones"><BarList rows={d.channels.map((c: Data) => ({ name: c.channel, value: c.sessions }))} /></Card>
        <Card title="Fuente / medio"><BarList rows={d.sources.map((c: Data) => ({ name: c.source, value: c.sessions }))} /></Card>
        <Card title="Dispositivos y ciudades">
          <BarList rows={d.devices.map((c: Data) => ({ name: c.device === 'mobile' ? 'Celular' : c.device === 'desktop' ? 'Computador' : c.device === 'tablet' ? 'Tableta' : c.device, value: c.users }))} />
          <div className="mt-4"><BarList rows={d.cities.map((c: Data) => ({ name: c.city === '(not set)' ? 'Sin dato' : c.city, value: c.users }))} /></div>
        </Card>
      </div>
      <Card title="Páginas más vistas">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500"><tr><th className="py-1.5">Página</th><th className="text-right">Vistas</th><th className="text-right">Usuarios</th></tr></thead>
          <tbody>{d.pages.map((p: Data) => <tr key={p.path} className="border-t border-gray-100"><td className="max-w-md truncate py-1.5 text-gray-900">{p.path}</td><td className="text-right tabular-nums">{num(p.views)}</td><td className="text-right tabular-nums">{num(p.users)}</td></tr>)}</tbody>
        </table>
      </Card>
    </div>
  )
}

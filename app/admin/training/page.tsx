'use client'

import { BookOpen, Shield, Wallet, Users, BarChart3, Workflow, Megaphone, Settings } from 'lucide-react'

const sectionGuides = [
  {
    title: 'Panel General',
    icon: BookOpen,
    purpose: 'Monitorear la salud global de la plataforma y entender el estado operativo actual.',
    options: [
      'Dashboard: KPIs ejecutivos (usuarios, ingresos, reservas, servicios activos).',
      'Monitoreo: alertas técnicas y señales de regresión en autenticación/API.',
      'Centro Ops: incidentes, casos críticos y bitácora administrativa.',
      'Workflow: embudo de negocio y evolución de reservas en tiempo real.',
    ],
  },
  {
    title: 'Operación Diaria',
    icon: Workflow,
    purpose: 'Gestionar la ejecución operativa del negocio y resolver bloqueos del día a día.',
    options: [
      'Reservas: seguimiento de estado de punta a punta.',
      'Pagos: conciliación de cobros y validación de transacciones.',
      'Pagos a socios: control de payout, trazabilidad y fallos de dispersión.',
      'Finanzas Ops: incidentes de pago, reembolsos y documentos tributarios.',
    ],
  },
  {
    title: 'Usuarios y Verificación',
    icon: Users,
    purpose: 'Asegurar crecimiento con calidad, identidad validada y riesgo controlado.',
    options: [
      'Usuarios: gestión de cuentas cliente y comportamiento.',
      'Socios: desempeño operativo y calidad de cumplimiento.',
      'KYC/KYB: reglas por país/ciudad/servicio y evaluaciones de riesgo.',
      'Verificación: revisión documental y aprobaciones regulatorias.',
    ],
  },
  {
    title: 'Servicios y Ubicaciones',
    icon: Settings,
    purpose: 'Definir el catálogo y cobertura geográfica para crecimiento ordenado.',
    options: [
      'Servicios: estructura, activación y priorización de categorías.',
      'Ciudades: control de expansión, lanzamiento y operación local.',
    ],
  },
  {
    title: 'Marketing y Demanda',
    icon: Megaphone,
    purpose: 'Impulsar adquisición y optimizar conversión del embudo comercial.',
    options: [
      'Publicidad: campañas por ciudad/servicio y prioridades.',
      'Búsquedas: entender demanda real y detectar faltantes de oferta.',
      'Control de Plataforma: reglas y switches de crecimiento controlado.',
    ],
  },
  {
    title: 'Seguridad y Gobernanza',
    icon: Shield,
    purpose: 'Proteger la plataforma contra abuso y mantener trazabilidad ejecutiva.',
    options: [
      'Seguridad: eventos maliciosos, bloqueo IP y respuesta operativa.',
      'Comisiones/Config. Pagos/Bancos: gobierno financiero y riesgo de transacción.',
      'Bitácora/Auditoría: quién cambió qué, cuándo y por qué.',
    ],
  },
]

const investorHighlights = [
  'Modelo de control en capas: operación, finanzas, riesgo, compliance y seguridad.',
  'Trazabilidad total de casos críticos: incidentes, eventos, SLA y resolución.',
  'Capacidad de expansión geográfica con reglas configurables y monitoreo por ciudad.',
  'Embudo medible en tiempo real para decisiones de crecimiento basadas en datos.',
  'Arquitectura de mitigación de fraude con playbooks y acciones automáticas/administrativas.',
]

export default function AdminTrainingPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start gap-3">
          <BookOpen className="h-7 w-7 text-primary-600 mt-1" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centro de Entrenamiento Admin</h1>
            <p className="text-gray-600 mt-1">
              Guía oficial para onboarding de administradores, operación diaria y presentación ejecutiva para inversionistas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sectionGuides.map((guide) => {
          const Icon = guide.icon
          return (
            <section key={guide.title} className="rounded-xl border bg-white p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">{guide.title}</h2>
              </div>
              <p className="text-sm text-gray-600">{guide.purpose}</p>
              <ul className="space-y-2 text-sm text-gray-700">
                {guide.options.map((option) => (
                  <li key={option} className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                    {option}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <section className="rounded-xl border bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Narrativa para Inversionistas</h2>
        </div>
        <p className="text-sm text-gray-600">
          Esta sección resume cómo el panel administra riesgo, eficiencia operativa y escalabilidad del negocio.
        </p>
        <ul className="space-y-2 text-sm text-gray-700">
          {investorHighlights.map((highlight) => (
            <li key={highlight} className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2">
              {highlight}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Checklist de Operación Segura</h2>
        </div>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
          <li>Revisar alertas de monitoreo y seguridad al inicio del turno.</li>
          <li>Priorizar incidentes por severidad y SLA.</li>
          <li>Resolver reembolsos y casos de soporte con trazabilidad completa.</li>
          <li>Auditar cambios de configuración crítica (pagos, comisiones, reglas de riesgo).</li>
          <li>Validar diariamente métricas de embudo y calidad de servicio.</li>
        </ol>
      </section>
    </div>
  )
}

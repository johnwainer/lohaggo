import type { Metadata } from 'next'
import { getPublicTrustSafe, type PublicTrust } from '@/lib/public/trust'
import { commissionFaq, partnerPayout } from '@/lib/public/copy'

export const revalidate = 600

const BASE_URL = 'https://www.lohaggo.com'

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes – LoHaggo',
  description: 'Resuelve tus dudas sobre LoHaggo: cómo reservar servicios, cómo unirse como socio, métodos de pago, cancelaciones y más. Encuentra respuestas rápidas aquí.',
  keywords: [
    'preguntas frecuentes LoHaggo',
    'cómo funciona LoHaggo',
    'reservar servicios Colombia',
    'registro profesional Colombia',
    'pago servicios a domicilio',
    'cancelar reserva servicio',
    'socios verificados Colombia',
    'FAQ servicios profesionales',
  ],
  alternates: { canonical: `${BASE_URL}/faq` },
  openGraph: {
    title: 'Preguntas Frecuentes – LoHaggo',
    description: 'Resuelve tus dudas sobre LoHaggo: cómo reservar, cómo unirse como socio, métodos de pago y más.',
    url: `${BASE_URL}/faq`,
    siteName: 'LoHaggo',
    locale: 'es_CO',
    type: 'website',
    images: [{ url: `${BASE_URL}/icon-512.png`, width: 512, height: 512, alt: 'LoHaggo FAQ' }],
  },
  twitter: {
    card: 'summary',
    title: 'Preguntas Frecuentes – LoHaggo',
    description: 'Todo lo que necesitas saber sobre LoHaggo: reservas, pagos, socios verificados y más.',
    creator: '@lohaggo',
  },
}

const faqItems = (trust: PublicTrust) => [
  {
    q: '¿Cómo puedo reservar un servicio?',
    a: 'Para reservar un servicio, primero debes registrarte en la plataforma. Luego, navega a la sección de "Servicios", selecciona el servicio que necesitas, completa los detalles de tu solicitud (fecha, hora, dirección) y confirma tu reserva. Recibirás una notificación cuando un socio acepte tu solicitud.',
  },
  {
    q: '¿Cuánto tiempo tarda en confirmarse mi reserva?',
    a: 'Depende de la disponibilidad de los socios. El socio confirma la reserva y te avisamos por WhatsApp.',
  },
  {
    q: '¿Puedo cancelar o modificar mi reserva?',
    a: 'Sí, puedes cancelar tu reserva desde tu panel de cliente en la sección "Mis Reservas". Las políticas de cancelación pueden variar según el servicio y el tiempo de anticipación.',
  },
  {
    q: '¿Cómo funcionan los pagos?',
    a: 'El pago se acuerda y se realiza directamente entre el cliente y el socio. Puedes pagar en efectivo o por transferencia bancaria a la cuenta que el socio te indique. El cliente reporta el pago en la app y el socio confirma la recepción al finalizar el servicio.',
  },
  {
    q: '¿Los socios están verificados?',
    a: trust.claims.trust_background_check
      ? 'Sí, revisamos la identidad y los antecedentes de cada socio antes de que reciba solicitudes. Además, contamos con un sistema de calificaciones y reseñas.'
      : 'Sí, nuestro equipo verifica la identidad de cada socio antes de que reciba solicitudes. Además, contamos con un sistema de calificaciones y reseñas.',
  },
  {
    q: '¿Qué hago si tengo un problema con el servicio?',
    a: 'Si tienes algún problema con el servicio recibido, puedes reportarlo desde tu panel de cliente. Nuestro equipo de soporte revisará tu caso y trabajará para encontrar una solución satisfactoria.',
  },
  {
    q: '¿Cómo puedo registrarme como socio?',
    a: 'Para registrarte como socio, haz clic en "Registrarse" y selecciona la opción "Soy Profesional". Completa el formulario con tu información personal, experiencia profesional y los servicios que ofreces. Nuestro equipo revisa tus documentos y te avisamos al aprobarlos.',
  },
  {
    q: '¿Cuánto cobra LoHaggo por cada servicio completado?',
    a: commissionFaq(trust),
  },
  {
    q: '¿Cuándo y cómo recibo mis pagos como socio?',
    a: partnerPayout(trust),
  },
]

export default async function FAQLayout({ children }: { children: React.ReactNode }) {
  const trust = await getPublicTrustSafe()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems(trust).map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}

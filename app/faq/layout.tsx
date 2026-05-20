import type { Metadata } from 'next'

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

const FAQ_ITEMS = [
  {
    q: '¿Cómo puedo reservar un servicio?',
    a: 'Para reservar un servicio, primero debes registrarte en la plataforma. Luego, navega a la sección de "Servicios", selecciona el servicio que necesitas, completa los detalles de tu solicitud (fecha, hora, dirección) y confirma tu reserva. Recibirás una notificación cuando un socio acepte tu solicitud.',
  },
  {
    q: '¿Cuánto tiempo tarda en confirmarse mi reserva?',
    a: 'El tiempo de confirmación varía según la disponibilidad de los socios. Generalmente, las reservas se confirman en un plazo de 1 a 24 horas.',
  },
  {
    q: '¿Puedo cancelar o modificar mi reserva?',
    a: 'Sí, puedes cancelar tu reserva desde tu panel de cliente en la sección "Mis Reservas". Las políticas de cancelación pueden variar según el servicio y el tiempo de anticipación.',
  },
  {
    q: '¿Cómo funcionan los pagos?',
    a: 'Los pagos se procesan de forma segura a través de nuestra plataforma. Puedes pagar con tarjeta de crédito, débito o transferencia bancaria. El pago se realiza después de que el servicio haya sido completado y confirmado por ambas partes.',
  },
  {
    q: '¿Los socios están verificados?',
    a: 'Sí, todos nuestros socios pasan por un proceso de verificación que incluye validación de identidad, experiencia y referencias. Además, contamos con un sistema de calificaciones y reseñas.',
  },
  {
    q: '¿Qué hago si tengo un problema con el servicio?',
    a: 'Si tienes algún problema con el servicio recibido, puedes reportarlo desde tu panel de cliente. Nuestro equipo de soporte revisará tu caso y trabajará para encontrar una solución satisfactoria.',
  },
  {
    q: '¿Cómo puedo registrarme como socio?',
    a: 'Para registrarte como socio, haz clic en "Registrarse" y selecciona la opción "Soy Profesional". Completa el formulario con tu información personal, experiencia profesional y los servicios que ofreces. Nuestro equipo revisará tu solicitud en un plazo de 24-48 horas.',
  },
  {
    q: '¿Cuánto cobra LoHaggo por cada servicio completado?',
    a: 'LoHaggo cobra una comisión por cada servicio completado exitosamente. La comisión exacta depende del tipo de servicio y se detalla en tu panel de socio.',
  },
  {
    q: '¿Cuándo y cómo recibo mis pagos como socio?',
    a: 'Los pagos se procesan automáticamente después de que el cliente confirme la finalización del servicio. El dinero se transfiere a tu cuenta bancaria registrada dentro de los siguientes 2-3 días hábiles.',
  },
]

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
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

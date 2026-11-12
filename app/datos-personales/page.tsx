import Link from 'next/link'
import type { Metadata } from 'next'
import DataRequestForm from '@/components/legal/DataRequestForm'

export const metadata: Metadata = {
  title: 'Tus datos personales',
  description: 'Conoce, corrige o elimina tus datos personales en LoHaggo (Ley 1581 de 2012). Respondemos en 15 días hábiles.',
  alternates: { canonical: '/datos-personales' },
}

export default function DatosPersonalesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
        <h1 className="text-3xl font-black text-gray-900">Tus datos personales</h1>
        <p className="mt-3 text-gray-600">
          Como titular de tus datos puedes pedirnos que te mostremos qué información tenemos de ti, que la corrijamos o que la eliminemos
          (Ley 1581 de 2012). No necesitas iniciar sesión. Respondemos dentro de los 15 días hábiles siguientes.
        </p>
        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <DataRequestForm />
        </div>
        <section className="mt-8 space-y-2 text-sm text-gray-600">
          <h2 className="text-base font-bold text-gray-900">Qué pasa cuando pides eliminar tus datos</h2>
          <p>Antes de eliminar verificamos tu identidad. No podemos eliminar la cuenta mientras tengas reservas activas (pendientes, confirmadas o en curso) o pagos sin liquidar; te avisamos y lo hacemos cuando terminen.</p>
          <p><strong>Eliminamos o reemplazamos:</strong> tu nombre, correo, teléfono y foto; tus direcciones y tarjetas guardadas; tu contraseña y accesos; en conversaciones de WhatsApp o chat, tu nombre, tu número y los mensajes que escribiste; y, si eres socio, tu perfil público, las fotos de tus trabajos, los archivos de tus documentos de verificación y los datos del titular de tu cuenta bancaria (el número queda enmascarado, solo los últimos 4 dígitos). Las fotos y los archivos que subiste también se borran de nuestro almacenamiento, no solo de tu perfil.</p>
          <p><strong>Conservamos por obligación legal:</strong> los registros de reservas, pagos, liquidaciones a socios y calificaciones, que exigen las normas contables y tributarias. Quedan sin tu nombre ni tus datos de contacto, desvinculados de tu identidad.</p>
          <p>También puedes escribirnos a <strong>hola@lohaggo.com</strong> con el asunto «Datos personales». Más información en la <Link href="/privacy" className="font-semibold text-primary-600 underline">Política de privacidad</Link>.</p>
        </section>
      </div>
    </main>
  )
}

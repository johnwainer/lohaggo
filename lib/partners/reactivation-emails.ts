/**
 * The two emails of the partner reactivation campaign, in the standard layout. Pure: the caller checks the
 * address is real (never @clientes.lohaggo.com), the preferences and the opt-out, and sends.
 */
import { buildEmailHtml } from '@/lib/email-layout'

const BASE = 'https://www.lohaggo.com'
const utm = (content: string) => `utm_source=email&utm_medium=socio&utm_campaign=reactivar_socios&utm_content=${content}`
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const step = (n: number, title: string, text: string) =>
  `<tr><td style="padding:0 0 14px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:top;padding-right:12px;"><div style="width:28px;height:28px;border-radius:14px;background:#0a66c2;color:#fff;font-weight:700;font-size:14px;line-height:28px;text-align:center;">${n}</div></td>
    <td style="vertical-align:top;font-size:15px;line-height:1.5;color:#1f2937;"><strong>${title}</strong><br/>${text}</td>
  </tr></table></td></tr>`

/** «Tu perfil de socio está a un paso»: A/B partners, day 0. */
export function docsEmail(name: string) {
  const first = esc(name)
  const url = `${BASE}/partner/verification?${utm('docs_email')}`
  const body = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hola ${first}, tu perfil de socio en LoHaggo ya está creado. Para empezar a recibir solicitudes de clientes solo faltan dos documentos. Son tres pasos y toman menos de 5 minutos:</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
${step(1, 'Foto de tu cédula', 'Por ambos lados, con buena luz y que se lean los datos. También sirve cédula de extranjería, pasaporte o PEP.')}
${step(2, 'Certificado de antecedentes', 'Es gratis: entra a la página de la Policía Nacional, escribe tu número de cédula y descarga el PDF. Si no puedes descargarlo, una captura de pantalla donde se vean tu nombre, tu cédula y la fecha también sirve.')}
${step(3, 'Listo', 'Súbelos en tu perfil (o envíalos por nuestro WhatsApp). Los revisamos en menos de 24 horas y te avisamos.')}
</table>
<p style="margin:8px 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">Sin estos documentos no podemos mostrarte a los clientes: los pedimos para que quien te contrata sepa que eres una persona verificada.</p>`
  return {
    subject: `${name}, tu perfil de socio está a un paso`,
    html: buildEmailHtml({
      title: 'Tu perfil de socio está a un paso',
      preheader: 'Sube tu cédula y tus antecedentes y empieza a recibir solicitudes.',
      body,
      ctaLabel: 'Subir mis documentos',
      ctaUrl: url,
      footerNote: 'Recibes este correo porque te registraste como socio en LoHaggo. Si no quieres recibir más correos como este, escríbenos por WhatsApp desde lohaggo.com y te sacamos de la lista.',
    }),
  }
}

/** «Cómo ganar tu primera reserva»: verified partners who never sent a proposal (F). */
export function tipsEmail(name: string, slug: string | null) {
  const first = esc(name)
  const profile = slug ? `${BASE}/pro/${encodeURIComponent(slug)}?${utm('tips_email')}` : null
  const body = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hola ${first}, ya eres socio verificado de LoHaggo. Estas son las cuatro cosas que más ayudan a ganar la primera reserva:</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
${step(1, 'Responde rápido', 'Cuando te llegue una solicitud, envía tu propuesta en menos de 10 minutos: el cliente suele quedarse con la primera buena propuesta.')}
${step(2, 'Muestra tu trabajo', 'Sube fotos de trabajos que hayas hecho. Un perfil con fotos genera mucha más confianza.')}
${step(3, 'Precio justo y claro', 'Di qué incluye tu precio (materiales, desplazamiento) para que el cliente compare sin sorpresas.')}
${step(4, 'Comparte tu perfil', profile ? `Envía tu enlace a tus clientes, amigos y vecinos o ponlo en tus estados de WhatsApp: <a href="${profile}" style="color:#0a66c2;">${esc(`lohaggo.com/pro/${slug}`)}</a>. Quien te pide desde ahí te llega directo a ti.` : 'Compártelo desde tu panel de socio: quien te pide desde tu enlace te llega directo a ti.')}
</table>
<p style="margin:8px 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">Mantén activos los servicios que sabes hacer y márcate como disponible para que te lleguen los avisos.</p>`
  return {
    subject: `${name}, así ganas tu primera reserva en LoHaggo`,
    html: buildEmailHtml({
      title: 'Cómo ganar tu primera reserva',
      preheader: 'Responde rápido, muestra fotos, precio claro y comparte tu perfil.',
      body,
      ctaLabel: 'Ver mi panel de socio',
      ctaUrl: `${BASE}/partner?${utm('tips_email')}`,
      footerNote: 'Recibes este correo porque eres socio de LoHaggo. Si no quieres recibir más correos como este, escríbenos por WhatsApp desde lohaggo.com y te sacamos de la lista.',
    }),
  }
}

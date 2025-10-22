import Link from 'next/link'
import { Shield, ArrowLeft, FileText, Calendar, Mail } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white pt-24 pb-16">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-8 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black">
                Política de Privacidad
              </h1>
              <p className="text-white/90 font-medium mt-2">
                Última actualización: Diciembre 2024
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100">
            
            {/* Introduction */}
            <div className="mb-12">
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                En <strong>LoHaggo</strong> (en adelante, "la Plataforma", "nosotros" o "nuestro"), 
                nos comprometemos a proteger la privacidad y los datos personales de nuestros usuarios. 
                Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos 
                su información personal de acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013 
                de la República de Colombia sobre Protección de Datos Personales.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Al utilizar nuestros servicios, usted acepta las prácticas descritas en esta política.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">1</span>
                Responsable del Tratamiento de Datos
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p><strong>Razón Social:</strong> LoHaggo S.A.S.</p>
                <p><strong>Domicilio:</strong> Colombia</p>
                <p><strong>Correo electrónico:</strong> privacidad@lohaggo.com</p>
                <p><strong>Teléfono:</strong> +57 (1) 234 5678</p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">2</span>
                Información que Recopilamos
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">2.1. Datos de Registro</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Nombre completo</li>
                    <li>Documento de identidad (cédula de ciudadanía, cédula de extranjería, pasaporte)</li>
                    <li>Correo electrónico</li>
                    <li>Número de teléfono</li>
                    <li>Dirección física</li>
                    <li>Fecha de nacimiento</li>
                    <li>Fotografía de perfil (opcional)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">2.2. Datos de Profesionales/Socios</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Información profesional y certificaciones</li>
                    <li>Experiencia laboral</li>
                    <li>Servicios ofrecidos</li>
                    <li>Tarifas y disponibilidad</li>
                    <li>Datos bancarios para pagos</li>
                    <li>Documentos de verificación (RUT, certificados profesionales)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">2.3. Datos de Uso</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Dirección IP</li>
                    <li>Tipo de navegador y dispositivo</li>
                    <li>Páginas visitadas y tiempo de navegación</li>
                    <li>Ubicación geográfica (con su consentimiento)</li>
                    <li>Cookies y tecnologías similares</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">2.4. Datos de Transacciones</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Historial de servicios solicitados y prestados</li>
                    <li>Información de pagos (procesada por terceros seguros)</li>
                    <li>Calificaciones y reseñas</li>
                    <li>Comunicaciones entre usuarios</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">3</span>
                Finalidad del Tratamiento de Datos
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Utilizamos sus datos personales para:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Crear y gestionar su cuenta de usuario</li>
                  <li>Facilitar la conexión entre clientes y profesionales</li>
                  <li>Procesar solicitudes de servicios y pagos</li>
                  <li>Verificar la identidad y antecedentes de profesionales</li>
                  <li>Enviar notificaciones sobre servicios, actualizaciones y promociones</li>
                  <li>Mejorar nuestros servicios mediante análisis de uso</li>
                  <li>Prevenir fraudes y garantizar la seguridad de la plataforma</li>
                  <li>Cumplir con obligaciones legales y regulatorias</li>
                  <li>Resolver disputas y brindar soporte al cliente</li>
                  <li>Realizar estudios de mercado y análisis estadísticos</li>
                </ul>
              </div>
            </div>

            {/* Section 4 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">4</span>
                Base Legal del Tratamiento
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>El tratamiento de sus datos personales se fundamenta en:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Consentimiento:</strong> Al registrarse y aceptar esta política</li>
                  <li><strong>Ejecución de contrato:</strong> Para prestar los servicios solicitados</li>
                  <li><strong>Obligación legal:</strong> Cumplimiento de normativas fiscales y regulatorias</li>
                  <li><strong>Interés legítimo:</strong> Mejora de servicios y prevención de fraudes</li>
                </ul>
              </div>
            </div>

            {/* Section 5 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">5</span>
                Compartir Información con Terceros
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <p>Podemos compartir su información con:</p>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.1. Proveedores de Servicios</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Procesadores de pagos (pasarelas de pago certificadas)</li>
                    <li>Servicios de almacenamiento en la nube</li>
                    <li>Proveedores de análisis y marketing</li>
                    <li>Servicios de verificación de identidad</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.2. Otros Usuarios</h3>
                  <p>Información de perfil necesaria para facilitar la prestación de servicios (nombre, foto, calificaciones).</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.3. Autoridades</h3>
                  <p>Cuando sea requerido por ley o para proteger nuestros derechos legales.</p>
                </div>
                <p className="font-semibold">
                  Todos los terceros están obligados contractualmente a proteger sus datos y solo pueden 
                  usarlos para los fines específicos autorizados.
                </p>
              </div>
            </div>

            {/* Section 6 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">6</span>
                Derechos de los Titulares (Ley 1581 de 2012)
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Como titular de datos personales, usted tiene derecho a:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Acceso:</strong> Conocer qué datos tenemos sobre usted</li>
                  <li><strong>Actualización:</strong> Solicitar la corrección de datos inexactos</li>
                  <li><strong>Rectificación:</strong> Modificar datos incompletos o erróneos</li>
                  <li><strong>Supresión:</strong> Solicitar la eliminación de sus datos cuando sea procedente</li>
                  <li><strong>Revocación:</strong> Retirar su consentimiento en cualquier momento</li>
                  <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos en ciertos casos</li>
                  <li><strong>Portabilidad:</strong> Recibir sus datos en formato estructurado</li>
                </ul>
                <p className="mt-4">
                  Para ejercer estos derechos, puede contactarnos en: <strong>privacidad@lohaggo.com</strong>
                </p>
                <p>
                  Responderemos a su solicitud dentro de los 15 días hábiles siguientes a su recepción, 
                  conforme a lo establecido en la normativa colombiana.
                </p>
              </div>
            </div>

            {/* Section 7 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">7</span>
                Seguridad de los Datos
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Implementamos medidas técnicas, administrativas y físicas para proteger sus datos:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Cifrado SSL/TLS para transmisión de datos</li>
                  <li>Almacenamiento seguro con cifrado en reposo</li>
                  <li>Controles de acceso estrictos</li>
                  <li>Auditorías de seguridad periódicas</li>
                  <li>Capacitación continua del personal</li>
                  <li>Protocolos de respuesta ante incidentes</li>
                </ul>
                <p className="mt-4">
                  Sin embargo, ningún sistema es 100% seguro. Le recomendamos mantener la confidencialidad 
                  de sus credenciales de acceso.
                </p>
              </div>
            </div>

            {/* Section 8 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">8</span>
                Retención de Datos
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Conservamos sus datos personales:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Mientras su cuenta esté activa</li>
                  <li>Durante el tiempo necesario para cumplir con las finalidades descritas</li>
                  <li>Por el período requerido por obligaciones legales (mínimo 5 años para datos fiscales)</li>
                  <li>Hasta que solicite su eliminación, salvo excepciones legales</li>
                </ul>
                <p className="mt-4">
                  Después de este período, sus datos serán eliminados o anonimizados de forma segura.
                </p>
              </div>
            </div>

            {/* Section 9 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">9</span>
                Transferencias Internacionales
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Algunos de nuestros proveedores de servicios pueden estar ubicados fuera de Colombia. 
                  En estos casos, garantizamos que:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Los países de destino ofrecen niveles adecuados de protección de datos</li>
                  <li>Existen cláusulas contractuales que garantizan la protección de su información</li>
                  <li>Se cumple con la normativa colombiana sobre transferencias internacionales</li>
                </ul>
              </div>
            </div>

            {/* Section 10 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">10</span>
                Menores de Edad
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos 
                  intencionalmente datos de menores de edad sin el consentimiento de sus padres o tutores legales.
                </p>
                <p>
                  Si descubrimos que hemos recopilado datos de un menor sin autorización, eliminaremos 
                  dicha información de inmediato.
                </p>
              </div>
            </div>

            {/* Section 11 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">11</span>
                Cookies y Tecnologías Similares
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Utilizamos cookies y tecnologías similares para mejorar su experiencia. Para más información, 
                  consulte nuestra <Link href="/cookies" className="text-[#FF2D55] font-bold hover:underline">Política de Cookies</Link>.
                </p>
              </div>
            </div>

            {/* Section 12 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">12</span>
                Cambios a esta Política
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre 
                  cambios significativos mediante:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Correo electrónico</li>
                  <li>Notificación en la plataforma</li>
                  <li>Actualización de la fecha de "Última actualización"</li>
                </ul>
                <p className="mt-4">
                  Le recomendamos revisar esta política periódicamente.
                </p>
              </div>
            </div>

            {/* Section 13 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">13</span>
                Contacto
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Para consultas sobre esta Política de Privacidad o el tratamiento de sus datos:</p>
                <div className="bg-gray-50 rounded-xl p-6 mt-4">
                  <p className="font-bold text-gray-900 mb-3">Oficial de Protección de Datos</p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#FF2D55]" />
                      <strong>Email:</strong> privacidad@lohaggo.com
                    </p>
                    <p><strong>Dirección:</strong> Colombia</p>
                    <p><strong>Teléfono:</strong> +57 (1) 234 5678</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 14 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">14</span>
                Autoridad de Control
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Si considera que sus derechos han sido vulnerados, puede presentar una queja ante la 
                  Superintendencia de Industria y Comercio de Colombia:
                </p>
                <div className="bg-gray-50 rounded-xl p-6 mt-4">
                  <p className="font-bold text-gray-900 mb-3">Superintendencia de Industria y Comercio</p>
                  <div className="space-y-2">
                    <p><strong>Sitio web:</strong> www.sic.gov.co</p>
                    <p><strong>Línea gratuita:</strong> 01 8000 910 165</p>
                    <p><strong>Dirección:</strong> Carrera 13 No. 27 - 00, Bogotá D.C., Colombia</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-[#FF2D55]" />
                <span>Última actualización: Diciembre 2024</span>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Esta política cumple con la Ley 1581 de 2012 y el Decreto 1377 de 2013 de la República de Colombia.
              </p>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-xl font-bold text-gray-900 hover:shadow-lg transition-all border border-gray-200"
            >
              <FileText className="w-4 h-4 text-[#FF2D55]" />
              Términos y Condiciones
            </Link>
            <Link
              href="/cookies"
              className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-xl font-bold text-gray-900 hover:shadow-lg transition-all border border-gray-200"
            >
              <FileText className="w-4 h-4 text-[#FF2D55]" />
              Política de Cookies
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

import Link from 'next/link'
import { FileText, ArrowLeft, Scale, Calendar, Mail, AlertTriangle } from 'lucide-react'

export default function TermsPage() {
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
              <Scale className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black">
                Términos y Condiciones
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
                Bienvenido a <strong>LoHaggo</strong>. Estos Términos y Condiciones (en adelante, "Términos") 
                regulan el acceso y uso de nuestra plataforma digital que conecta clientes con profesionales 
                para la prestación de servicios diversos.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Al registrarse, acceder o utilizar nuestros servicios, usted acepta estar legalmente vinculado 
                por estos Términos. Si no está de acuerdo, no debe utilizar la plataforma.
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800 font-medium">
                    <strong>Importante:</strong> Lea estos términos cuidadosamente antes de usar nuestros servicios. 
                    El uso continuado de la plataforma constituye su aceptación de estos términos.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">1</span>
                Definiciones
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p><strong>"Plataforma":</strong> Se refiere al sitio web, aplicación móvil y servicios de LoHaggo.</p>
                <p><strong>"Usuario":</strong> Cualquier persona que acceda o utilice la Plataforma.</p>
                <p><strong>"Cliente":</strong> Usuario que solicita servicios a través de la Plataforma.</p>
                <p><strong>"Profesional" o "Socio":</strong> Usuario que ofrece y presta servicios a través de la Plataforma.</p>
                <p><strong>"Servicio":</strong> Cualquier actividad profesional ofrecida por un Profesional a través de la Plataforma.</p>
                <p><strong>"Contenido":</strong> Información, textos, imágenes, videos y otros materiales en la Plataforma.</p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">2</span>
                Naturaleza de la Plataforma
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  <strong>LoHaggo actúa como intermediario tecnológico</strong> que facilita la conexión entre 
                  Clientes y Profesionales. No somos empleadores ni contratistas de los Profesionales, ni 
                  prestamos directamente los servicios ofrecidos en la Plataforma.
                </p>
                <p>
                  La relación contractual para la prestación de servicios se establece directamente entre el 
                  Cliente y el Profesional. LoHaggo no es parte de dicha relación contractual.
                </p>
                <p>
                  Conforme al Código de Comercio colombiano y la Ley 527 de 1999 sobre comercio electrónico, 
                  actuamos como plataforma de intermediación digital.
                </p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">3</span>
                Registro y Cuenta de Usuario
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">3.1. Requisitos de Registro</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Ser mayor de 18 años</li>
                    <li>Tener capacidad legal para contratar</li>
                    <li>Proporcionar información veraz, completa y actualizada</li>
                    <li>Aceptar estos Términos y la Política de Privacidad</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">3.2. Responsabilidades del Usuario</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Mantener la confidencialidad de sus credenciales de acceso</li>
                    <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
                    <li>Actualizar su información cuando sea necesario</li>
                    <li>No compartir su cuenta con terceros</li>
                    <li>Ser responsable de todas las actividades realizadas desde su cuenta</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">3.3. Verificación de Profesionales</h3>
                  <p>
                    Los Profesionales deben someterse a un proceso de verificación que incluye validación de 
                    identidad, antecedentes y certificaciones profesionales cuando aplique.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">4</span>
                Uso de la Plataforma
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">4.1. Usos Permitidos</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Buscar y contratar servicios profesionales</li>
                    <li>Ofrecer servicios profesionales legítimos</li>
                    <li>Comunicarse con otros usuarios para coordinar servicios</li>
                    <li>Calificar y reseñar servicios recibidos</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">4.2. Usos Prohibidos</h3>
                  <p>Está estrictamente prohibido:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Publicar contenido falso, engañoso o fraudulento</li>
                    <li>Ofrecer o solicitar servicios ilegales</li>
                    <li>Acosar, amenazar o discriminar a otros usuarios</li>
                    <li>Intentar eludir las medidas de seguridad de la Plataforma</li>
                    <li>Realizar ingeniería inversa o copiar la Plataforma</li>
                    <li>Usar bots, scripts o herramientas automatizadas no autorizadas</li>
                    <li>Recopilar datos de usuarios sin autorización</li>
                    <li>Publicar contenido que infrinja derechos de propiedad intelectual</li>
                    <li>Evadir el sistema de pagos de la Plataforma</li>
                    <li>Crear múltiples cuentas para manipular calificaciones</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 5 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">5</span>
                Servicios y Transacciones
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.1. Solicitud de Servicios</h3>
                  <p>
                    Los Clientes pueden solicitar servicios especificando sus necesidades. Los Profesionales 
                    pueden aceptar o rechazar solicitudes a su discreción.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.2. Prestación de Servicios</h3>
                  <p>
                    Los Profesionales se comprometen a prestar los servicios con diligencia, profesionalismo 
                    y conforme a los estándares de calidad aplicables. El contrato de prestación de servicios 
                    se rige por el Código Civil y Código de Comercio colombiano.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.3. Precios y Pagos</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Los precios son establecidos por los Profesionales</li>
                    <li>Los pagos se procesan a través de la Plataforma mediante pasarelas seguras</li>
                    <li>LoHaggo cobra una comisión por el uso de la Plataforma</li>
                    <li>Los precios incluyen IVA cuando aplique según la legislación colombiana</li>
                    <li>Los pagos se liberan al Profesional una vez confirmada la prestación del servicio</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.4. Cancelaciones y Reembolsos</h3>
                  <p>
                    Las políticas de cancelación varían según el tipo de servicio. Los reembolsos se procesarán 
                    conforme a la Ley 1480 de 2011 (Estatuto del Consumidor) y nuestras políticas específicas.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">6</span>
                Comisiones y Tarifas
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  LoHaggo cobra una comisión por facilitar la conexión entre Clientes y Profesionales. 
                  Las tarifas actuales son:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Comisión de servicio para Profesionales: Variable según el tipo de servicio</li>
                  <li>Tarifa de procesamiento de pagos: Según proveedor de pagos</li>
                  <li>Servicios premium opcionales: Según plan seleccionado</li>
                </ul>
                <p className="mt-4">
                  Las tarifas pueden modificarse con previo aviso de 30 días. El uso continuado de la 
                  Plataforma después de la notificación constituye aceptación de las nuevas tarifas.
                </p>
              </div>
            </div>

            {/* Section 7 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">7</span>
                Calificaciones y Reseñas
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Los usuarios pueden calificar y reseñar servicios. Las reseñas deben ser:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Honestas y basadas en experiencias reales</li>
                  <li>Respetuosas y sin lenguaje ofensivo</li>
                  <li>Relevantes al servicio prestado</li>
                  <li>Libres de conflictos de interés</li>
                </ul>
                <p className="mt-4">
                  Nos reservamos el derecho de eliminar reseñas que violen estos principios o nuestras políticas.
                </p>
              </div>
            </div>

            {/* Section 8 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">8</span>
                Propiedad Intelectual
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo diseño, código, 
                  marca, logotipos y contenido, son propiedad exclusiva de LoHaggo S.A.S. o sus licenciantes.
                </p>
                <p>
                  Se prohíbe la reproducción, distribución, modificación o uso comercial del contenido de la 
                  Plataforma sin autorización expresa, conforme a la Decisión Andina 486 y la Ley 23 de 1982.
                </p>
                <p>
                  Los usuarios conservan los derechos sobre el contenido que publican, pero otorgan a LoHaggo 
                  una licencia mundial, no exclusiva y libre de regalías para usar, reproducir y mostrar dicho 
                  contenido en la Plataforma.
                </p>
              </div>
            </div>

            {/* Section 9 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">9</span>
                Limitación de Responsabilidad
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <p>
                  <strong>LoHaggo no se hace responsable de:</strong>
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>La calidad, seguridad o legalidad de los servicios prestados por Profesionales</li>
                  <li>La veracidad de la información proporcionada por los usuarios</li>
                  <li>Daños o perjuicios derivados de la relación entre Clientes y Profesionales</li>
                  <li>Interrupciones o errores en el funcionamiento de la Plataforma</li>
                  <li>Pérdida de datos o información</li>
                  <li>Acciones de terceros o fuerza mayor</li>
                </ul>
                <p className="mt-4">
                  En ningún caso la responsabilidad de LoHaggo excederá el monto de las comisiones pagadas 
                  por el usuario en los últimos 12 meses.
                </p>
                <p>
                  Esta limitación se aplica en la máxima medida permitida por la ley colombiana, sin perjuicio 
                  de los derechos irrenunciables del consumidor establecidos en la Ley 1480 de 2011.
                </p>
              </div>
            </div>

            {/* Section 10 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">10</span>
                Indemnización
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Usted acepta indemnizar y mantener indemne a LoHaggo, sus directivos, empleados y afiliados 
                  de cualquier reclamación, pérdida, responsabilidad, daño o gasto (incluyendo honorarios legales) 
                  que surjan de:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Su uso de la Plataforma</li>
                  <li>Violación de estos Términos</li>
                  <li>Violación de derechos de terceros</li>
                  <li>Servicios prestados o recibidos a través de la Plataforma</li>
                </ul>
              </div>
            </div>

            {/* Section 11 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">11</span>
                Suspensión y Terminación
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">11.1. Por el Usuario</h3>
                  <p>
                    Puede cancelar su cuenta en cualquier momento desde la configuración de su perfil o 
                    contactando a soporte@lohaggo.com.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">11.2. Por LoHaggo</h3>
                  <p>
                    Podemos suspender o terminar su cuenta inmediatamente si:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Viola estos Términos</li>
                    <li>Realiza actividades fraudulentas o ilegales</li>
                    <li>Recibimos múltiples quejas sobre su conducta</li>
                    <li>Es necesario por razones legales o de seguridad</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">11.3. Efectos de la Terminación</h3>
                  <p>
                    Al terminar su cuenta, perderá acceso a la Plataforma y su contenido. Las obligaciones 
                    pendientes (pagos, servicios contratados) permanecerán vigentes.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 12 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">12</span>
                Resolución de Disputas
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">12.1. Mediación Interna</h3>
                  <p>
                    En caso de disputa entre usuarios, LoHaggo puede ofrecer servicios de mediación voluntaria 
                    para facilitar una solución amistosa.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">12.2. Jurisdicción</h3>
                  <p>
                    Estos Términos se rigen por las leyes de la República de Colombia. Cualquier disputa se 
                    someterá a la jurisdicción de los tribunales competentes de Colombia.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">12.3. Arbitraje</h3>
                  <p>
                    Las partes pueden acordar someter sus disputas a arbitraje conforme al Centro de Arbitraje 
                    y Conciliación de la Cámara de Comercio, según la Ley 1563 de 2012.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 13 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">13</span>
                Modificaciones
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios 
                  significativos serán notificados con al menos 15 días de anticipación mediante:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Correo electrónico</li>
                  <li>Notificación en la Plataforma</li>
                  <li>Actualización de la fecha de "Última actualización"</li>
                </ul>
                <p className="mt-4">
                  El uso continuado de la Plataforma después de la entrada en vigor de los cambios constituye 
                  su aceptación de los nuevos Términos.
                </p>
              </div>
            </div>

            {/* Section 14 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">14</span>
                Disposiciones Generales
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  <strong>Acuerdo Completo:</strong> Estos Términos constituyen el acuerdo completo entre 
                  usted y LoHaggo respecto al uso de la Plataforma.
                </p>
                <p>
                  <strong>Divisibilidad:</strong> Si alguna disposición es declarada inválida, las demás 
                  permanecerán en pleno vigor.
                </p>
                <p>
                  <strong>Renuncia:</strong> La falta de ejercicio de un derecho no constituye renuncia al mismo.
                </p>
                <p>
                  <strong>Cesión:</strong> No puede ceder estos Términos sin nuestro consentimiento previo por escrito.
                </p>
                <p>
                  <strong>Idioma:</strong> En caso de conflicto entre versiones en diferentes idiomas, 
                  prevalecerá la versión en español.
                </p>
              </div>
            </div>

            {/* Section 15 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">15</span>
                Contacto
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Para consultas sobre estos Términos:</p>
                <div className="bg-gray-50 rounded-xl p-6 mt-4">
                  <p className="font-bold text-gray-900 mb-3">LoHaggo S.A.S.</p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#FF2D55]" />
                      <strong>Email:</strong> legal@lohaggo.com
                    </p>
                    <p><strong>Soporte:</strong> soporte@lohaggo.com</p>
                    <p><strong>Teléfono:</strong> +57 (1) 234 5678</p>
                    <p><strong>Dirección:</strong> Colombia</p>
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
                Estos términos cumplen con la legislación colombiana vigente, incluyendo el Código Civil, 
                Código de Comercio, Ley 527 de 1999, Ley 1480 de 2011 y Ley 1581 de 2012.
              </p>
            </div>
          </div>

          {/* Related Links */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-xl font-bold text-gray-900 hover:shadow-lg transition-all border border-gray-200"
            >
              <FileText className="w-4 h-4 text-[#FF2D55]" />
              Política de Privacidad
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

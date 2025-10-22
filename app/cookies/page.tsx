import Link from 'next/link'
import { Cookie, ArrowLeft, FileText, Calendar, Mail, Settings, Eye, BarChart, Shield } from 'lucide-react'

export default function CookiesPage() {
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
              <Cookie className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black">
                Política de Cookies
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
                En <strong>LoHaggo</strong> utilizamos cookies y tecnologías similares para mejorar su experiencia 
                en nuestra plataforma, personalizar contenido, analizar el tráfico y ofrecer funcionalidades 
                específicas.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Esta Política de Cookies explica qué son las cookies, cómo las utilizamos, qué tipos empleamos 
                y cómo puede controlarlas, en cumplimiento con la Ley 1581 de 2012 y normativas aplicables en Colombia.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">1</span>
                ¿Qué son las Cookies?
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Las cookies son pequeños archivos de texto que se almacenan en su dispositivo (computadora, 
                  tablet o móvil) cuando visita un sitio web. Permiten que el sitio web reconozca su dispositivo 
                  y recuerde información sobre su visita.
                </p>
                <p>
                  Las cookies pueden ser:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>De sesión:</strong> Se eliminan cuando cierra el navegador</li>
                  <li><strong>Persistentes:</strong> Permanecen en su dispositivo por un período determinado</li>
                  <li><strong>Propias:</strong> Establecidas por LoHaggo</li>
                  <li><strong>De terceros:</strong> Establecidas por servicios externos que utilizamos</li>
                </ul>
              </div>
            </div>

            {/* Section 2 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">2</span>
                ¿Por qué Utilizamos Cookies?
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Utilizamos cookies para:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Mantener su sesión activa y recordar sus preferencias</li>
                  <li>Mejorar la seguridad de la plataforma</li>
                  <li>Analizar cómo los usuarios interactúan con nuestro sitio</li>
                  <li>Personalizar contenido y publicidad</li>
                  <li>Facilitar funcionalidades de redes sociales</li>
                  <li>Optimizar el rendimiento de la plataforma</li>
                  <li>Realizar estudios estadísticos y de mercado</li>
                </ul>
              </div>
            </div>

            {/* Section 3 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">3</span>
                Tipos de Cookies que Utilizamos
              </h2>
              <div className="pl-11 space-y-6 text-gray-700">
                
                {/* Strictly Necessary */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">
                        3.1. Cookies Estrictamente Necesarias
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Esenciales para el funcionamiento básico de la plataforma. No pueden desactivarse.
                      </p>
                      <div className="space-y-2">
                        <p><strong>Finalidad:</strong></p>
                        <ul className="list-disc pl-6 space-y-1">
                          <li>Autenticación de usuarios</li>
                          <li>Seguridad y prevención de fraudes</li>
                          <li>Mantener sesiones activas</li>
                          <li>Recordar información del carrito de servicios</li>
                        </ul>
                        <p className="mt-3"><strong>Duración:</strong> Sesión o hasta 1 año</p>
                        <p><strong>Ejemplos:</strong> session_id, csrf_token, auth_token</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Functional */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">
                        3.2. Cookies Funcionales
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Permiten recordar sus preferencias y mejorar su experiencia.
                      </p>
                      <div className="space-y-2">
                        <p><strong>Finalidad:</strong></p>
                        <ul className="list-disc pl-6 space-y-1">
                          <li>Recordar idioma preferido</li>
                          <li>Guardar configuraciones de usuario</li>
                          <li>Recordar ubicación geográfica</li>
                          <li>Personalizar interfaz según preferencias</li>
                        </ul>
                        <p className="mt-3"><strong>Duración:</strong> Hasta 2 años</p>
                        <p><strong>Ejemplos:</strong> language_pref, location_data, ui_settings</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center flex-shrink-0">
                      <BarChart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">
                        3.3. Cookies Analíticas
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Nos ayudan a entender cómo los usuarios interactúan con la plataforma.
                      </p>
                      <div className="space-y-2">
                        <p><strong>Finalidad:</strong></p>
                        <ul className="list-disc pl-6 space-y-1">
                          <li>Análisis de tráfico y comportamiento</li>
                          <li>Estadísticas de uso</li>
                          <li>Identificación de errores técnicos</li>
                          <li>Optimización de rendimiento</li>
                        </ul>
                        <p className="mt-3"><strong>Duración:</strong> Hasta 2 años</p>
                        <p><strong>Proveedores:</strong> Google Analytics, Mixpanel</p>
                        <p><strong>Ejemplos:</strong> _ga, _gid, _gat</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Marketing */}
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">
                        3.4. Cookies de Marketing y Publicidad
                      </h3>
                      <p className="text-gray-700 mb-3">
                        Utilizadas para mostrar publicidad relevante y medir la efectividad de campañas.
                      </p>
                      <div className="space-y-2">
                        <p><strong>Finalidad:</strong></p>
                        <ul className="list-disc pl-6 space-y-1">
                          <li>Publicidad personalizada</li>
                          <li>Remarketing</li>
                          <li>Medición de conversiones</li>
                          <li>Segmentación de audiencias</li>
                        </ul>
                        <p className="mt-3"><strong>Duración:</strong> Hasta 2 años</p>
                        <p><strong>Proveedores:</strong> Google Ads, Facebook Pixel, LinkedIn Insight</p>
                        <p><strong>Ejemplos:</strong> _fbp, fr, IDE, test_cookie</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Section 4 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">4</span>
                Cookies de Terceros
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <p>
                  Utilizamos servicios de terceros que pueden establecer sus propias cookies. Estos incluyen:
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">4.1. Google Analytics</h3>
                    <p>Para análisis de tráfico y comportamiento de usuarios.</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Más información: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">policies.google.com/privacy</a>
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">4.2. Google Ads</h3>
                    <p>Para publicidad y remarketing.</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Más información: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">policies.google.com/technologies/ads</a>
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">4.3. Facebook Pixel</h3>
                    <p>Para análisis y publicidad en redes sociales.</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Más información: <a href="https://www.facebook.com/privacy/explanation" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">facebook.com/privacy</a>
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">4.4. Pasarelas de Pago</h3>
                    <p>Para procesar transacciones de forma segura (Stripe, PayU, etc.).</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">4.5. Servicios de Mapas</h3>
                    <p>Google Maps para funcionalidades de ubicación.</p>
                  </div>
                </div>

                <p className="mt-4 font-semibold">
                  No tenemos control sobre las cookies de terceros. Le recomendamos revisar las políticas 
                  de privacidad de estos servicios.
                </p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">5</span>
                Cómo Controlar las Cookies
              </h2>
              <div className="pl-11 space-y-4 text-gray-700">
                <p>
                  Usted tiene control sobre las cookies que acepta. Puede gestionarlas de las siguientes formas:
                </p>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.1. Panel de Configuración de Cookies</h3>
                  <p>
                    Al visitar nuestra plataforma por primera vez, se le presenta un banner de cookies donde 
                    puede aceptar o rechazar cookies no esenciales. Puede cambiar sus preferencias en cualquier 
                    momento desde la configuración de su cuenta.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.2. Configuración del Navegador</h3>
                  <p>La mayoría de navegadores permiten:</p>
                  <ul className="list-disc pl-6 space-y-2 mt-2">
                    <li>Ver qué cookies están almacenadas</li>
                    <li>Eliminar cookies individualmente o todas</li>
                    <li>Bloquear cookies de sitios específicos</li>
                    <li>Bloquear todas las cookies de terceros</li>
                    <li>Eliminar cookies al cerrar el navegador</li>
                  </ul>
                  
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">Instrucciones por navegador:</p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
                      <li><strong>Firefox:</strong> Opciones → Privacidad y seguridad → Cookies</li>
                      <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies</li>
                      <li><strong>Edge:</strong> Configuración → Privacidad → Cookies</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">5.3. Herramientas de Terceros</h3>
                  <p>Puede optar por no participar en cookies de publicidad mediante:</p>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    <li>Google Ads Settings: <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">adssettings.google.com</a></li>
                    <li>Your Online Choices: <a href="http://www.youronlinechoices.com" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">youronlinechoices.com</a></li>
                    <li>Network Advertising Initiative: <a href="http://www.networkadvertising.org" target="_blank" rel="noopener noreferrer" className="text-[#FF2D55] hover:underline">networkadvertising.org</a></li>
                  </ul>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl mt-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    <strong>Nota:</strong> Bloquear o eliminar cookies puede afectar la funcionalidad de la 
                    plataforma y su experiencia de usuario. Algunas funciones pueden no estar disponibles.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">6</span>
                Otras Tecnologías de Seguimiento
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Además de cookies, utilizamos otras tecnologías similares:</p>
                
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">6.1. Web Beacons (Píxeles de Seguimiento)</h3>
                  <p>
                    Pequeñas imágenes invisibles en páginas web o correos electrónicos que nos permiten 
                    saber si ha visitado una página o abierto un correo.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">6.2. Local Storage</h3>
                  <p>
                    Almacenamiento local en el navegador para guardar datos de forma más persistente que las cookies.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">6.3. Session Storage</h3>
                  <p>
                    Similar al Local Storage pero los datos se eliminan al cerrar la pestaña del navegador.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-2">6.4. Identificadores de Dispositivo</h3>
                  <p>
                    En aplicaciones móviles, podemos usar identificadores únicos del dispositivo para 
                    funcionalidades similares a las cookies.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 7 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">7</span>
                Cookies y Datos Personales
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Algunas cookies pueden contener datos personales, especialmente si está autenticado en la 
                  plataforma. El tratamiento de estos datos se rige por nuestra{' '}
                  <Link href="/privacy" className="text-[#FF2D55] font-bold hover:underline">
                    Política de Privacidad
                  </Link>.
                </p>
                <p>
                  Usted tiene los mismos derechos sobre los datos recopilados mediante cookies que sobre 
                  cualquier otro dato personal (acceso, rectificación, supresión, etc.), conforme a la 
                  Ley 1581 de 2012.
                </p>
              </div>
            </div>

            {/* Section 8 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">8</span>
                Actualizaciones de esta Política
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>
                  Podemos actualizar esta Política de Cookies periódicamente para reflejar cambios en las 
                  tecnologías que utilizamos o requisitos legales.
                </p>
                <p>
                  Le notificaremos sobre cambios significativos mediante un aviso en la plataforma o por 
                  correo electrónico. La fecha de "Última actualización" al inicio de esta política indica 
                  cuándo fue modificada por última vez.
                </p>
              </div>
            </div>

            {/* Section 9 */}
            <div className="mb-10">
              <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-8 h-8 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-lg flex items-center justify-center text-white text-sm">9</span>
                Contacto
              </h2>
              <div className="pl-11 space-y-3 text-gray-700">
                <p>Si tiene preguntas sobre nuestra Política de Cookies:</p>
                <div className="bg-gray-50 rounded-xl p-6 mt-4">
                  <p className="font-bold text-gray-900 mb-3">Departamento de Privacidad</p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#FF2D55]" />
                      <strong>Email:</strong> privacidad@lohaggo.com
                    </p>
                    <p><strong>Soporte:</strong> soporte@lohaggo.com</p>
                    <p><strong>Teléfono:</strong> +57 (1) 234 5678</p>
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
                Esta política cumple con la Ley 1581 de 2012 de Colombia y las mejores prácticas 
                internacionales en materia de cookies y privacidad.
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
              href="/terms"
              className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-xl font-bold text-gray-900 hover:shadow-lg transition-all border border-gray-200"
            >
              <FileText className="w-4 h-4 text-[#FF2D55]" />
              Términos y Condiciones
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

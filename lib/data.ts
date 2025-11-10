export const categories = [
  { name: "Hogar", slug: "hogar", icon: "🏠" },
  { name: "Limpieza", slug: "limpieza", icon: "🧹" },
  { name: "Reparaciones", slug: "reparaciones", icon: "🔧" },
  { name: "Belleza", slug: "belleza", icon: "💅" },
  { name: "Salud", slug: "salud", icon: "⚕️" },
  { name: "Tecnología", slug: "tecnologia", icon: "💻" },
  { name: "Transporte", slug: "transporte", icon: "🚗" },
  { name: "Educación", slug: "educacion", icon: "📚" },
  { name: "Eventos", slug: "eventos", icon: "🎉" },
  { name: "Mascotas", slug: "mascotas", icon: "🐕" },
  { name: "Automotriz", slug: "automotriz", icon: "🚙" },
  { name: "Profesional", slug: "profesional", icon: "💼" },
];

export const services = [
  // Hogar y Limpieza
  { name: "Plomería", slug: "plomeria", description: "Reparación de tuberías, grifos y sistemas de agua", icon: "🚰", category: "hogar", basePrice: 50, duration: 120, popular: true },
  { name: "Electricidad", slug: "electricidad", description: "Instalación y reparación eléctrica", icon: "⚡", category: "hogar", basePrice: 60, duration: 90, popular: true },
  { name: "Limpieza de hogar", slug: "limpieza-hogar", description: "Limpieza profunda de casas y apartamentos", icon: "🧹", category: "limpieza", basePrice: 40, duration: 180, popular: true },
  { name: "Limpieza de oficinas", slug: "limpieza-oficinas", description: "Limpieza profesional de espacios comerciales", icon: "🏢", category: "limpieza", basePrice: 80, duration: 240, popular: false },
  { name: "Carpintería", slug: "carpinteria", description: "Fabricación y reparación de muebles", icon: "🪚", category: "hogar", basePrice: 70, duration: 180, popular: false },
  { name: "Pintura", slug: "pintura", description: "Pintura de interiores y exteriores", icon: "🎨", category: "hogar", basePrice: 100, duration: 480, popular: true },
  { name: "Jardinería", slug: "jardineria", description: "Mantenimiento de jardines y áreas verdes", icon: "🌱", category: "hogar", basePrice: 45, duration: 120, popular: false },
  { name: "Fumigación", slug: "fumigacion", description: "Control de plagas y fumigación", icon: "🦟", category: "hogar", basePrice: 55, duration: 90, popular: false },
  { name: "Lavado de alfombras", slug: "lavado-alfombras", description: "Limpieza profunda de alfombras y tapetes", icon: "🧼", category: "limpieza", basePrice: 35, duration: 60, popular: false },
  { name: "Limpieza de ventanas", slug: "limpieza-ventanas", description: "Limpieza de ventanas y cristales", icon: "🪟", category: "limpieza", basePrice: 30, duration: 90, popular: false },

  // Reparaciones
  { name: "Reparación de electrodomésticos", slug: "reparacion-electrodomesticos", description: "Reparación de lavadoras, refrigeradores, etc.", icon: "🔌", category: "reparaciones", basePrice: 65, duration: 120, popular: true },
  { name: "Cerrajería", slug: "cerrajeria", description: "Apertura y cambio de cerraduras", icon: "🔑", category: "reparaciones", basePrice: 50, duration: 60, popular: true },
  { name: "Reparación de aires acondicionados", slug: "reparacion-aires", description: "Mantenimiento y reparación de AC", icon: "❄️", category: "reparaciones", basePrice: 75, duration: 120, popular: true },
  { name: "Reparación de calentadores", slug: "reparacion-calentadores", description: "Reparación de calentadores de agua", icon: "🔥", category: "reparaciones", basePrice: 60, duration: 90, popular: false },
  { name: "Instalación de muebles", slug: "instalacion-muebles", description: "Armado e instalación de muebles", icon: "🛋️", category: "hogar", basePrice: 40, duration: 120, popular: false },

  // Belleza y Cuidado Personal
  { name: "Peluquería a domicilio", slug: "peluqueria", description: "Corte y peinado en tu hogar", icon: "💇", category: "belleza", basePrice: 25, duration: 60, popular: true },
  { name: "Manicure y pedicure", slug: "manicure-pedicure", description: "Cuidado de uñas profesional", icon: "💅", category: "belleza", basePrice: 30, duration: 90, popular: true },
  { name: "Masajes", slug: "masajes", description: "Masajes terapéuticos y relajantes", icon: "💆", category: "belleza", basePrice: 50, duration: 60, popular: true },
  { name: "Maquillaje", slug: "maquillaje", description: "Maquillaje profesional para eventos", icon: "💄", category: "belleza", basePrice: 45, duration: 90, popular: false },
  { name: "Barbería", slug: "barberia", description: "Corte y arreglo de barba", icon: "✂️", category: "belleza", basePrice: 20, duration: 45, popular: false },

  // Salud y Bienestar
  { name: "Enfermería a domicilio", slug: "enfermeria", description: "Cuidados de enfermería en casa", icon: "💉", category: "salud", basePrice: 60, duration: 60, popular: false },
  { name: "Fisioterapia", slug: "fisioterapia", description: "Terapia física y rehabilitación", icon: "🏥", category: "salud", basePrice: 70, duration: 60, popular: false },
  { name: "Nutrición", slug: "nutricion", description: "Consultas nutricionales personalizadas", icon: "🥗", category: "salud", basePrice: 50, duration: 60, popular: false },
  { name: "Entrenador personal", slug: "entrenador-personal", description: "Entrenamiento físico personalizado", icon: "💪", category: "salud", basePrice: 40, duration: 60, popular: true },
  { name: "Yoga", slug: "yoga", description: "Clases de yoga a domicilio", icon: "🧘", category: "salud", basePrice: 35, duration: 60, popular: false },

  // Tecnología
  { name: "Reparación de computadoras", slug: "reparacion-computadoras", description: "Reparación y mantenimiento de PC", icon: "💻", category: "tecnologia", basePrice: 50, duration: 120, popular: true },
  { name: "Reparación de celulares", slug: "reparacion-celulares", description: "Reparación de smartphones y tablets", icon: "📱", category: "tecnologia", basePrice: 40, duration: 60, popular: true },
  { name: "Instalación de software", slug: "instalacion-software", description: "Instalación y configuración de programas", icon: "⚙️", category: "tecnologia", basePrice: 35, duration: 90, popular: false },
  { name: "Soporte técnico", slug: "soporte-tecnico", description: "Asistencia técnica remota o presencial", icon: "🖥️", category: "tecnologia", basePrice: 45, duration: 60, popular: false },
  { name: "Instalación de redes", slug: "instalacion-redes", description: "Configuración de redes WiFi y cableado", icon: "📡", category: "tecnologia", basePrice: 60, duration: 120, popular: false },

  // Transporte y Mudanzas
  { name: "Mudanzas", slug: "mudanzas", description: "Servicio de mudanzas local", icon: "📦", category: "transporte", basePrice: 150, duration: 480, popular: true },
  { name: "Transporte de carga", slug: "transporte-carga", description: "Transporte de mercancías", icon: "🚚", category: "transporte", basePrice: 80, duration: 180, popular: false },
  { name: "Mensajería", slug: "mensajeria", description: "Entrega de paquetes y documentos", icon: "📮", category: "transporte", basePrice: 15, duration: 60, popular: true },

  // Educación
  { name: "Clases particulares", slug: "clases-particulares", description: "Tutorías académicas personalizadas", icon: "👨‍🏫", category: "educacion", basePrice: 30, duration: 60, popular: true },
  { name: "Clases de idiomas", slug: "clases-idiomas", description: "Enseñanza de idiomas extranjeros", icon: "🗣️", category: "educacion", basePrice: 35, duration: 60, popular: true },
  { name: "Clases de música", slug: "clases-musica", description: "Clases de instrumentos musicales", icon: "🎸", category: "educacion", basePrice: 40, duration: 60, popular: false },
  { name: "Clases de cocina", slug: "clases-cocina", description: "Aprende a cocinar con profesionales", icon: "👨‍🍳", category: "educacion", basePrice: 45, duration: 120, popular: false },

  // Eventos
  { name: "Catering", slug: "catering", description: "Servicio de comida para eventos", icon: "🍽️", category: "eventos", basePrice: 200, duration: 240, popular: true },
  { name: "Fotografía", slug: "fotografia", description: "Fotografía profesional para eventos", icon: "📷", category: "eventos", basePrice: 150, duration: 240, popular: true },
  { name: "DJ", slug: "dj", description: "Música y animación para fiestas", icon: "🎧", category: "eventos", basePrice: 180, duration: 240, popular: false },
  { name: "Decoración de eventos", slug: "decoracion-eventos", description: "Decoración profesional para eventos", icon: "🎈", category: "eventos", basePrice: 120, duration: 180, popular: false },
  { name: "Animación infantil", slug: "animacion-infantil", description: "Entretenimiento para fiestas infantiles", icon: "🤡", category: "eventos", basePrice: 100, duration: 180, popular: false },

  // Mascotas
  { name: "Veterinaria a domicilio", slug: "veterinaria", description: "Atención veterinaria en casa", icon: "🐾", category: "mascotas", basePrice: 60, duration: 60, popular: true },
  { name: "Peluquería canina", slug: "peluqueria-canina", description: "Baño y corte para mascotas", icon: "🐕", category: "mascotas", basePrice: 35, duration: 90, popular: true },
  { name: "Paseo de perros", slug: "paseo-perros", description: "Paseo y ejercicio para tu mascota", icon: "🦮", category: "mascotas", basePrice: 15, duration: 60, popular: true },
  { name: "Entrenamiento canino", slug: "entrenamiento-canino", description: "Adiestramiento profesional de perros", icon: "🎾", category: "mascotas", basePrice: 50, duration: 60, popular: false },
  { name: "Cuidado de mascotas", slug: "cuidado-mascotas", description: "Cuidado temporal de mascotas", icon: "🏠", category: "mascotas", basePrice: 25, duration: 480, popular: false },

  // Otros servicios
  { name: "Lavado de autos", slug: "lavado-autos", description: "Lavado y detallado de vehículos", icon: "🚗", category: "transporte", basePrice: 30, duration: 90, popular: true },
  { name: "Costura y arreglos", slug: "costura", description: "Arreglos de ropa y confección", icon: "🧵", category: "hogar", basePrice: 20, duration: 60, popular: false },
  { name: "Asesoría legal", slug: "asesoria-legal", description: "Consultas legales básicas", icon: "⚖️", category: "profesional", basePrice: 80, duration: 60, popular: false },

  // Hogar y Mantenimiento - Nuevos
  { name: "Impermeabilización", slug: "impermeabilizacion", description: "Protección de techos y terrazas contra filtraciones", icon: "☔", category: "hogar", basePrice: 120, duration: 240, popular: true },
  { name: "Instalación de cortinas", slug: "instalacion-cortinas", description: "Medición, instalación y reparación de cortinas y persianas", icon: "🪟", category: "hogar", basePrice: 35, duration: 90, popular: false },
  { name: "Pulido de pisos", slug: "pulido-pisos", description: "Pulido y brillado de mármol, granito y madera", icon: "✨", category: "hogar", basePrice: 80, duration: 180, popular: false },
  { name: "Reparación de techos", slug: "reparacion-techos", description: "Reparación de goteras, tejas e impermeabilización", icon: "🏠", category: "hogar", basePrice: 90, duration: 240, popular: true },
  { name: "Instalación de cielo raso", slug: "instalacion-cielo-raso", description: "Instalación de drywall, PVC y aluminio", icon: "🔨", category: "hogar", basePrice: 85, duration: 300, popular: false },
  { name: "Herrería", slug: "herreria", description: "Fabricación de rejas, portones y estructuras metálicas", icon: "🔩", category: "hogar", basePrice: 95, duration: 240, popular: false },
  { name: "Instalación de enchapes", slug: "instalacion-enchapes", description: "Enchapes para baños, cocinas y pisos", icon: "🧱", category: "hogar", basePrice: 75, duration: 360, popular: false },
  { name: "Reparación de puertas", slug: "reparacion-puertas", description: "Ajustes, cambio de vidrios y reparación de puertas y ventanas", icon: "🚪", category: "hogar", basePrice: 45, duration: 90, popular: false },
  { name: "Instalación de riego", slug: "instalacion-riego", description: "Sistemas de riego para jardines y cultivos urbanos", icon: "💧", category: "hogar", basePrice: 70, duration: 180, popular: false },
  { name: "Mantenimiento de piscinas", slug: "mantenimiento-piscinas", description: "Limpieza, químicos y reparaciones de piscinas", icon: "🏊", category: "hogar", basePrice: 60, duration: 120, popular: false },
];

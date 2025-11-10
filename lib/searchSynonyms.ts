export const serviceSynonyms: Record<string, string[]> = {
  // SERVICIOS EXISTENTES - Sinónimos expandidos
  'plomero': ['plomería', 'fontanero', 'gasfitero', 'cañería', 'tubería', 'agua', 'desagüe', 'fuga', 'llave', 'grifo', 'inodoro', 'sanitario', 'baño', 'ducha', 'sifón', 'válvula', 'tubo', 'destape', 'alcantarilla', 'drenaje'],
  'electricista': ['electricidad', 'luz', 'corriente', 'cable', 'instalación eléctrica', 'toma', 'enchufe', 'interruptor', 'breaker', 'tablero', 'corto circuito', 'voltaje', 'amperaje', 'cableado', 'iluminación', 'lámpara', 'bombillo', 'apagón'],
  'carpintero': ['carpintería', 'madera', 'mueble', 'puerta', 'ventana', 'closet', 'armario', 'estante', 'repisa', 'cajonera', 'escritorio', 'mesa', 'silla', 'cama', 'ropero', 'biblioteca', 'mueble a medida'],
  'pintor': ['pintura', 'pintar', 'pared', 'color', 'brocha', 'rodillo', 'esmalte', 'latex', 'vinilo', 'techo', 'fachada', 'retoque', 'acabado', 'imprimante', 'sellador', 'barniz', 'laca'],
  'limpieza': ['limpiar', 'aseo', 'limpiador', 'desinfección', 'higiene', 'orden', 'organización', 'trapear', 'barrer', 'aspirar', 'sacudir', 'pulir', 'brillar', 'lavar'],
  'jardinero': ['jardinería', 'jardín', 'pasto', 'césped', 'plantas', 'poda', 'riego', 'paisajismo', 'cortar pasto', 'guadaña', 'fertilizante', 'abono', 'flores', 'árboles', 'arbustos', 'diseño jardín'],
  'cerrajero': ['cerradura', 'llave', 'candado', 'puerta', 'seguridad', 'chapa', 'cilindro', 'bombín', 'duplicado llave', 'apertura puerta', 'cambio chapa', 'llave codificada', 'llave auto'],
  'albañil': ['albañilería', 'construcción', 'obra', 'cemento', 'ladrillo', 'pared', 'muro', 'mampostería', 'concreto', 'hormigón', 'revoque', 'estuco', 'friso', 'columna', 'viga', 'cimiento'],
  'mecánico': ['mecánica', 'auto', 'carro', 'vehículo', 'motor', 'reparación', 'mantenimiento', 'taller', 'frenos', 'suspensión', 'transmisión', 'embrague', 'batería', 'alternador', 'arranque', 'radiador', 'escape', 'afinación', 'diagnóstico', 'scanner', 'aceite', 'filtros'],
  'aire acondicionado': ['clima', 'climatización', 'refrigeración', 'ventilación', 'frío', 'calor', 'hvac', 'split', 'minisplit', 'central', 'ventana', 'portátil', 'mantenimiento aire', 'recarga gas', 'limpieza aire', 'instalación aire'],
  'mudanza': ['mudanzas', 'traslado', 'transporte', 'embalaje', 'empaque', 'mover', 'trasteo', 'acarreo', 'carga', 'descarga', 'camión', 'flete', 'bodegaje'],
  'fumigación': ['fumigar', 'plagas', 'insectos', 'control de plagas', 'desinfección', 'exterminio', 'cucarachas', 'hormigas', 'ratones', 'termitas', 'mosquitos', 'chinches', 'pulgas', 'garrapatas'],
  'vidrio': ['vidriero', 'cristal', 'ventana', 'espejo', 'vitrina', 'parabrisas', 'vidrio templado', 'vidrio laminado', 'instalación vidrio', 'cambio vidrio', 'corte vidrio'],
  'tapicería': ['tapizar', 'muebles', 'sofá', 'silla', 'tela', 'cuero', 'retapizar', 'restauración muebles', 'cojines', 'respaldo', 'asiento'],
  'soldadura': ['soldar', 'soldador', 'metal', 'hierro', 'acero', 'soldadura eléctrica', 'soldadura mig', 'soldadura tig', 'soldadura autógena', 'aluminio', 'inoxidable', 'reparación metal'],
  'techado': ['techo', 'tejado', 'goteras', 'impermeabilización', 'tejas', 'zinc', 'eternit', 'teja española', 'teja asfáltica', 'cubierta', 'canal', 'bajante', 'reparación techo'],
  'piscina': ['alberca', 'pileta', 'mantenimiento de piscina', 'limpieza de piscina', 'cloro', 'químicos', 'filtro', 'bomba', 'jacuzzi', 'hidromasaje'],
  'masaje': ['masajista', 'terapia', 'relajación', 'spa', 'masoterapia', 'masaje terapéutico', 'masaje deportivo', 'masaje relajante', 'quiromasaje', 'reflexología', 'drenaje linfático'],
  'peluquería': ['peluquero', 'corte de pelo', 'cabello', 'estilista', 'barbería', 'barber', 'corte hombre', 'corte mujer', 'corte niño', 'peinado', 'brushing', 'secado', 'tintura', 'color'],
  'manicure': ['uñas', 'manicura', 'pedicure', 'nail art', 'esmaltado', 'gel', 'acrílico', 'semipermanente', 'decoración uñas', 'cutícula', 'limado'],
  'maquillaje': ['maquillador', 'makeup', 'belleza', 'cosmética', 'maquillaje social', 'maquillaje novia', 'maquillaje profesional', 'cejas', 'pestañas', 'base', 'corrector'],
  'entrenador': ['entrenamiento', 'fitness', 'gym', 'ejercicio', 'personal trainer', 'coach', 'rutina', 'pesas', 'cardio', 'funcional', 'crossfit', 'yoga', 'pilates', 'spinning'],
  'nutricionista': ['nutrición', 'dieta', 'alimentación', 'dietista', 'plan alimenticio', 'bajar peso', 'adelgazar', 'ganar masa', 'nutrición deportiva', 'consulta nutricional'],
  'clases': ['profesor', 'maestro', 'tutor', 'enseñanza', 'educación', 'academia', 'tutoría', 'refuerzo', 'apoyo escolar', 'matemáticas', 'inglés', 'español', 'física', 'química'],
  'fotografía': ['fotógrafo', 'foto', 'sesión fotográfica', 'book', 'fotografía profesional', 'retrato', 'eventos', 'bodas', 'quinceaños', 'producto', 'estudio fotográfico'],
  'catering': ['comida', 'eventos', 'banquete', 'buffet', 'servicio de comida', 'pasabocas', 'coctel', 'almuerzo', 'cena', 'desayuno', 'refrigerio'],
  'dj': ['música', 'fiesta', 'evento', 'sonido', 'disc jockey', 'animación', 'boda', 'quinceaños', 'cumpleaños', 'corporativo', 'equipo sonido', 'luces'],
  'decoración': ['decorador', 'diseño de interiores', 'ambientación', 'decoración eventos', 'decoración hogar', 'interiorismo', 'cortinas', 'tapetes', 'cuadros', 'adornos'],
  'seguridad': ['vigilancia', 'guardia', 'protección', 'custodia', 'vigilante', 'escolta', 'seguridad privada', 'ronda', 'monitoreo'],
  'niñera': ['cuidado de niños', 'babysitter', 'nanny', 'cuidadora', 'niñero', 'cuidado infantil', 'guardería', 'acompañamiento niños'],
  'enfermera': ['enfermería', 'cuidado', 'salud', 'atención médica', 'enfermero', 'auxiliar enfermería', 'curaciones', 'inyecciones', 'toma signos', 'presión'],
  'veterinario': ['veterinaria', 'mascota', 'perro', 'gato', 'animal', 'consulta veterinaria', 'vacunas', 'desparasitación', 'cirugía', 'peluquería canina', 'baño mascota'],
  'lavandería': ['lavar', 'ropa', 'tintorería', 'planchado', 'lavado', 'secado', 'doblado', 'limpieza en seco', 'lavado alfombras', 'lavado cortinas'],
  'costura': ['costurera', 'arreglo de ropa', 'confección', 'sastre', 'modista', 'ajuste', 'dobladillo', 'cierre', 'botones', 'reparación ropa', 'vestido a medida'],
  'computadora': ['computador', 'pc', 'laptop', 'ordenador', 'informática', 'tecnología', 'soporte técnico', 'reparación pc', 'formateo', 'windows', 'mac', 'virus', 'lento', 'mantenimiento pc'],
  'celular': ['móvil', 'smartphone', 'teléfono', 'reparación de celular', 'pantalla', 'batería', 'iphone', 'samsung', 'android', 'táctil', 'software', 'desbloqueo'],
  'internet': ['wifi', 'red', 'conexión', 'router', 'modem', 'fibra óptica', 'banda ancha', 'instalación internet', 'configuración red', 'repetidor', 'señal'],
  'software': ['programa', 'aplicación', 'app', 'sistema', 'desarrollo', 'programación', 'web', 'móvil', 'base datos', 'erp', 'crm'],
  'diseño': ['diseñador', 'gráfico', 'web', 'logo', 'branding', 'diseño gráfico', 'diseño web', 'ux', 'ui', 'photoshop', 'illustrator', 'flyer', 'banner', 'tarjetas'],
  'traducción': ['traductor', 'idioma', 'lenguaje', 'inglés', 'francés', 'alemán', 'portugués', 'traducción documentos', 'interpretación', 'subtítulos'],
  'contabilidad': ['contador', 'contable', 'finanzas', 'impuestos', 'declaración renta', 'facturación', 'nómina', 'estados financieros', 'balance', 'auditoría'],
  'legal': ['abogado', 'jurídico', 'derecho', 'asesoría legal', 'consulta legal', 'demanda', 'contrato', 'laboral', 'civil', 'penal', 'familia', 'divorcio'],
  'arquitectura': ['arquitecto', 'planos', 'diseño arquitectónico', 'construcción', 'remodelación', 'proyecto', 'obra', 'licencia construcción', 'renders', 'maqueta', 'presupuesto obra'],

  // HOGAR Y MANTENIMIENTO - Servicios nuevos con sinónimos expandidos
  'impermeabilización': ['impermeabilizar', 'filtración', 'humedad', 'goteras', 'terraza', 'azotea', 'techo', 'sika', 'membrana', 'sellado', 'protección agua', 'anti goteras', 'filtraciones'],
  'cortinas': ['persianas', 'blackout', 'roller', 'vertical', 'horizontal', 'enrollable', 'romana', 'sheer', 'instalación cortinas', 'medición cortinas', 'reparación persianas'],
  'pulido': ['brillado', 'abrillantado', 'mármol', 'granito', 'piso', 'cristalizado', 'encerado', 'lustrado', 'brillo', 'pulir pisos', 'madera'],
  'cielo raso': ['drywall', 'plafón', 'falso techo', 'cielorraso', 'pvc', 'aluminio', 'yeso', 'superboard', 'instalación techo'],
  'herrería': ['herrero', 'rejas', 'portones', 'metal', 'hierro forjado', 'estructuras metálicas', 'barandas', 'escaleras', 'soldadura', 'fabricación metal'],
  'enchapes': ['baldosas', 'cerámica', 'porcelanato', 'azulejos', 'revestimiento', 'piso', 'pared', 'baño', 'cocina', 'instalación baldosas'],
  'tanque': ['tanque de agua', 'cisterna', 'aljibe', 'reservorio', 'limpieza tanque', 'desinfección tanque', 'agua potable'],
  'riego': ['sistema de riego', 'aspersores', 'goteo', 'jardín', 'plantas', 'automatización riego', 'timer', 'válvulas'],
  'piscinas': ['alberca', 'pileta', 'mantenimiento piscina', 'limpieza piscina', 'químicos', 'cloro', 'filtro', 'bomba'],
  'puertas': ['puerta', 'ventana', 'ajuste', 'reparación', 'vidrio', 'chapa', 'bisagra', 'marco'],

  // LIMPIEZA ESPECIALIZADA - Sinónimos expandidos
  'post-construcción': ['post construcción', 'después obra', 'escombros', 'polvo', 'limpieza obra', 'remodelación', 'construcción'],
  'desinfección': ['sanitización', 'desinfectar', 'higienizar', 'esterilizar', 'covid', 'virus', 'bacterias', 'fumigación', 'ozono'],
  'tapizados': ['tapicería', 'sofá', 'muebles', 'colchón', 'limpieza profunda', 'sillas', 'alfombra', 'vapor', 'manchas'],
  'organización': ['organizador', 'orden', 'marie kondo', 'declutter', 'ordenar', 'clasificar', 'closet', 'armario'],
  'fachadas': ['fachada', 'edificio', 'casa', 'local', 'limpieza altura', 'presión', 'hidrolavadora'],
  'cocinas industriales': ['cocina industrial', 'restaurante', 'cafetería', 'campana', 'grasa', 'horno', 'parrilla'],
  'garajes': ['garaje', 'bodega', 'sótano', 'parqueadero', 'estacionamiento', 'limpieza profunda'],

  // REPARACIONES Y MANTENIMIENTO - Sinónimos expandidos
  'lavadora': ['lavadora', 'secadora', 'lavasecadora', 'centrifugado', 'reparación lavadora', 'mantenimiento lavadora', 'lg', 'samsung', 'whirlpool', 'mabe'],
  'nevera': ['refrigerador', 'frigorífico', 'congelador', 'freezer', 'reparación nevera', 'no enfría', 'fuga gas', 'termostato'],
  'estufa': ['cocina', 'hornilla', 'horno', 'gas', 'eléctrica', 'reparación estufa', 'quemador', 'encendido'],
  'gas': ['gasodoméstico', 'instalación gas', 'fuga gas', 'certificado gas', 'tubería gas', 'regulador', 'válvula', 'gas natural', 'pipeta'],
  'persianas': ['persiana', 'enrollable', 'vertical', 'horizontal', 'reparación persiana', 'motor', 'cadena', 'lamas'],
  'bicicleta': ['bici', 'cicla', 'rodado', 'frenos', 'cambios', 'reparación bicicleta', 'mantenimiento bici', 'llanta', 'cadena', 'piñón'],
  'tapicería muebles': ['tapizar', 'retapizar', 'sofá', 'silla', 'restauración', 'tela', 'cuero', 'espuma', 'resortes'],

  // BELLEZA Y BIENESTAR - Sinónimos expandidos
  'depilación': ['depilar', 'cera', 'láser', 'hilo', 'rasurar', 'depilación definitiva', 'ipl', 'luz pulsada', 'brasilera', 'axilas', 'piernas'],
  'facial': ['limpieza facial', 'tratamiento facial', 'hidratación', 'anti-edad', 'peeling', 'mascarilla', 'piel', 'acné', 'manchas'],
  'pestañas': ['extensiones', 'lifting', 'permanente', 'tinte', 'pestañas pelo a pelo', 'volumen', 'rizado', 'lash lift'],
  'micropigmentación': ['microblading', 'cejas', 'labios', 'delineado permanente', 'tatuaje', 'pigmentación', 'pelo a pelo', 'ombré'],
  'keratina': ['alisado', 'botox capilar', 'tratamiento capilar', 'liso', 'alisado brasilero', 'nanoplastia', 'progresivo'],
  'spa': ['spa domicilio', 'masaje', 'relajación', 'jacuzzi', 'sauna', 'aromaterapia', 'piedras calientes', 'exfoliación'],
  'asesoría imagen': ['personal shopper', 'estilismo', 'vestuario', 'colorimetría', 'armario', 'estilo personal', 'moda'],

  // SALUD Y CUIDADO - Sinónimos expandidos
  'psicología': ['psicólogo', 'terapia', 'consulta psicológica', 'salud mental', 'ansiedad', 'depresión', 'estrés', 'terapia online', 'psicoterapia'],
  'adultos mayores': ['tercera edad', 'ancianos', 'cuidador', 'acompañamiento', 'enfermería geriátrica', 'abuelos', 'personas mayores'],
  'inyecciones': ['inyección', 'vacuna', 'medicamento', 'enfermería', 'intramuscular', 'intravenosa', 'aplicación medicamentos'],
  'respiratoria': ['terapia respiratoria', 'nebulización', 'pulmones', 'oxígeno', 'fisioterapia respiratoria', 'epoc', 'asma'],
  'terapia ocupacional': ['rehabilitación', 'funcional', 'motricidad', 'actividades diarias', 'terapeuta ocupacional'],

  // TECNOLOGÍA Y SEGURIDAD - Sinónimos expandidos
  'cámaras': ['cctv', 'seguridad', 'vigilancia', 'alarma', 'dvr', 'nvr', 'ip', 'hikvision', 'dahua', 'video vigilancia', 'monitoreo'],
  'tv': ['televisor', 'televisión', 'home theater', 'montaje', 'soporte', 'smart tv', 'samsung', 'lg', 'sony', 'instalación tv', 'pared'],
  'consolas': ['playstation', 'xbox', 'nintendo', 'switch', 'videojuegos', 'ps4', 'ps5', 'reparación consola', 'joystick'],
  'paneles solares': ['energía solar', 'fotovoltaica', 'renovable', 'inversor', 'solar', 'ahorro energía', 'batería', 'autoconsumo'],
  'smart home': ['domótica', 'casa inteligente', 'alexa', 'google home', 'automatización', 'iot', 'control voz', 'luces inteligentes'],
  'datos': ['recuperación', 'disco duro', 'backup', 'información perdida', 'recuperar archivos', 'ssd', 'usb', 'celular', 'formateo'],

  // AUTOMOTRIZ - Sinónimos expandidos
  'aceite': ['cambio aceite', 'filtro', 'lubricante', 'motor', 'aceite motor', 'sintético', 'mineral', 'mantenimiento carro'],
  'polarizado': ['lámina', 'insulfilm', 'tintado', 'vidrios', 'polarizado auto', 'película', 'oscurecer vidrios', 'rayos uv'],
  'mecánica domicilio': ['mecánico casa', 'reparación auto', 'carro', 'vehículo', 'diagnóstico', 'scanner', 'frenos', 'suspensión'],
  'pintura automotriz': ['pintura carro', 'retoque', 'rayón', 'abolladura', 'latonería', 'pintura auto', 'cabina'],

  // PROFESIONAL - Sinónimos expandidos
  'asesoría contable': ['contador', 'contabilidad', 'declaración renta', 'impuestos', 'facturación', 'rut', 'dian', 'estados financieros', 'nómina'],
}

export function expandSearchTerms(searchTerm: string): string[] {
  const normalizedTerm = searchTerm.toLowerCase().trim()
  const expandedTerms = [normalizedTerm]

  for (const [key, synonyms] of Object.entries(serviceSynonyms)) {
    if (normalizedTerm.includes(key) || key.includes(normalizedTerm)) {
      expandedTerms.push(key, ...synonyms)
    }

    for (const synonym of synonyms) {
      if (normalizedTerm.includes(synonym) || synonym.includes(normalizedTerm)) {
        expandedTerms.push(key, ...synonyms)
        break
      }
    }
  }

  return Array.from(new Set(expandedTerms))
}

export function calculateRelevanceScore(service: any, searchTerm: string): number {
  const normalizedSearch = searchTerm.toLowerCase().trim()
  let score = 0

  const name = service.name.toLowerCase()
  const description = service.description.toLowerCase()
  const category = service.category.name.toLowerCase()

  if (name === normalizedSearch) score += 100
  else if (name.includes(normalizedSearch)) score += 50
  else if (normalizedSearch.includes(name)) score += 40

  if (description.includes(normalizedSearch)) score += 20

  if (category === normalizedSearch) score += 30
  else if (category.includes(normalizedSearch)) score += 15

  const expandedTerms = expandSearchTerms(normalizedSearch)
  for (const term of expandedTerms) {
    if (name.includes(term)) score += 10
    if (description.includes(term)) score += 5
    if (category.includes(term)) score += 8
  }

  return score
}

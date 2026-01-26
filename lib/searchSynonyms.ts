function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

export const serviceSynonyms: Record<string, string[]> = {
  'plomero': ['plomeria', 'plomería', 'fontanero', 'gasfitero', 'gasfiter', 'cañeria', 'cañería', 'tuberia', 'tubería', 'agua', 'desague', 'desagüe', 'fuga', 'llave', 'grifo', 'canilla', 'inodoro', 'sanitario', 'baño', 'ducha', 'regadera', 'sifon', 'sifón', 'valvula', 'válvula', 'tubo', 'destape', 'destapar', 'alcantarilla', 'drenaje', 'plomero a domicilio', 'plomero urgente', 'plomero 24 horas', 'reparacion de fugas', 'reparación de fugas', 'instalacion de agua', 'instalación de agua'],

  'electricista': ['electricidad', 'electrisista', 'electrisidad', 'luz', 'corriente', 'cable', 'instalacion electrica', 'instalación eléctrica', 'toma', 'enchufe', 'tomacorriente', 'interruptor', 'breaker', 'breker', 'tablero', 'corto circuito', 'cortocircuito', 'voltaje', 'amperaje', 'cableado', 'iluminacion', 'iluminación', 'lampara', 'lámpara', 'bombillo', 'foco', 'apagon', 'apagón', 'electricista a domicilio', 'electricista urgente', 'electricista 24 horas', 'instalacion de luz', 'instalación de luz', 'reparacion electrica', 'reparación eléctrica'],

  'carpintero': ['carpinteria', 'carpintería', 'madera', 'mueble', 'puerta', 'ventana', 'closet', 'clóset', 'armario', 'estante', 'repisa', 'cajonera', 'escritorio', 'mesa', 'silla', 'cama', 'ropero', 'biblioteca', 'mueble a medida', 'muebles a medida', 'carpintero a domicilio', 'reparacion de muebles', 'reparación de muebles', 'fabricacion de muebles', 'fabricación de muebles', 'muebles de madera', 'trabajo en madera'],

  'pintor': ['pintura', 'pintar', 'pared', 'color', 'brocha', 'rodillo', 'esmalte', 'latex', 'látex', 'vinilo', 'vinilico', 'vinílico', 'techo', 'fachada', 'retoque', 'acabado', 'imprimante', 'sellador', 'barniz', 'laca', 'pintor a domicilio', 'pintura de casas', 'pintura de apartamentos', 'pintura interior', 'pintura exterior', 'pintura de paredes', 'pintura de techos'],

  'limpieza': ['limpiar', 'aseo', 'limpiador', 'desinfeccion', 'desinfección', 'higiene', 'orden', 'organizacion', 'organización', 'trapear', 'barrer', 'aspirar', 'sacudir', 'pulir', 'brillar', 'lavar', 'limpieza del hogar', 'limpieza de casa', 'limpieza de apartamento', 'limpieza profunda', 'limpieza general', 'limpieza a domicilio', 'servicio de limpieza', 'empleada domestica', 'empleada doméstica', 'señora de limpieza'],

  'jardinero': ['jardineria', 'jardinería', 'jardin', 'jardín', 'pasto', 'cesped', 'césped', 'grama', 'plantas', 'poda', 'riego', 'paisajismo', 'cortar pasto', 'cortar cesped', 'cortar césped', 'guadaña', 'guadañar', 'fertilizante', 'abono', 'flores', 'arboles', 'árboles', 'arbustos', 'diseño jardin', 'diseño jardín', 'mantenimiento de jardin', 'mantenimiento de jardín', 'jardinero a domicilio'],

  'cerrajero': ['cerradura', 'llave', 'candado', 'puerta', 'seguridad', 'chapa', 'cilindro', 'bombin', 'bombín', 'duplicado llave', 'copia de llave', 'apertura puerta', 'abrir puerta', 'cambio chapa', 'cambio de cerradura', 'llave codificada', 'llave auto', 'cerrajero a domicilio', 'cerrajero urgente', 'cerrajero 24 horas', 'cerrajeria', 'cerrajería'],

  'albañil': ['albañileria', 'albañilería', 'construccion', 'construcción', 'obra', 'cemento', 'ladrillo', 'pared', 'muro', 'mamposteria', 'mampostería', 'concreto', 'hormigon', 'hormigón', 'revoque', 'estuco', 'friso', 'columna', 'viga', 'cimiento', 'albañil a domicilio', 'maestro de obra', 'construccion de casas', 'construcción de casas', 'remodelacion', 'remodelación', 'ampliacion', 'ampliación'],

  'mecanico': ['mecánico', 'mecanica', 'mecánica', 'auto', 'carro', 'coche', 'vehiculo', 'vehículo', 'motor', 'reparacion', 'reparación', 'mantenimiento', 'taller', 'frenos', 'suspension', 'suspensión', 'transmision', 'transmisión', 'embrague', 'clutch', 'bateria', 'batería', 'alternador', 'arranque', 'radiador', 'escape', 'afinacion', 'afinación', 'diagnostico', 'diagnóstico', 'scanner', 'escaner', 'aceite', 'filtros', 'mecanico a domicilio', 'mecánico a domicilio', 'mecanica automotriz', 'mecánica automotriz'],

  'aire acondicionado': ['aire', 'clima', 'climatizacion', 'climatización', 'refrigeracion', 'refrigeración', 'ventilacion', 'ventilación', 'frio', 'frío', 'calor', 'hvac', 'split', 'minisplit', 'mini split', 'central', 'ventana', 'portatil', 'portátil', 'mantenimiento aire', 'recarga gas', 'limpieza aire', 'instalacion aire', 'instalación aire', 'reparacion aire acondicionado', 'reparación aire acondicionado', 'tecnico de aire', 'técnico de aire'],

  'mudanza': ['mudanzas', 'traslado', 'transporte', 'embalaje', 'empaque', 'mover', 'trasteo', 'acarreo', 'carga', 'descarga', 'camion', 'camión', 'flete', 'bodegaje', 'mudanza de casa', 'mudanza de apartamento', 'mudanza de oficina', 'servicio de mudanza', 'empresa de mudanzas'],

  'fumigacion': ['fumigación', 'fumigar', 'plagas', 'insectos', 'control de plagas', 'desinfeccion', 'desinfección', 'exterminio', 'cucarachas', 'hormigas', 'ratones', 'ratas', 'termitas', 'comején', 'mosquitos', 'zancudos', 'chinches', 'pulgas', 'garrapatas', 'fumigacion a domicilio', 'fumigación a domicilio', 'control de insectos'],

  'vidrio': ['vidriero', 'cristal', 'ventana', 'espejo', 'vitrina', 'parabrisas', 'vidrio templado', 'vidrio laminado', 'instalacion vidrio', 'instalación vidrio', 'cambio vidrio', 'corte vidrio', 'reparacion de vidrios', 'reparación de vidrios', 'vidriero a domicilio'],

  'tapiceria': ['tapicería', 'tapizar', 'muebles', 'sofa', 'sofá', 'silla', 'tela', 'cuero', 'retapizar', 'restauracion muebles', 'restauración muebles', 'cojines', 'respaldo', 'asiento', 'tapiceria de muebles', 'tapicería de muebles', 'tapicero'],

  'soldadura': ['soldar', 'soldador', 'metal', 'hierro', 'acero', 'soldadura electrica', 'soldadura eléctrica', 'soldadura mig', 'soldadura tig', 'soldadura autogena', 'soldadura autógena', 'aluminio', 'inoxidable', 'reparacion metal', 'reparación metal', 'soldador a domicilio', 'trabajo de soldadura'],

  'techado': ['techo', 'tejado', 'goteras', 'impermeabilizacion', 'impermeabilización', 'tejas', 'zinc', 'eternit', 'teja española', 'teja asfaltica', 'teja asfáltica', 'cubierta', 'canal', 'bajante', 'reparacion techo', 'reparación techo', 'instalacion de techo', 'instalación de techo', 'techador'],

  'piscina': ['alberca', 'pileta', 'mantenimiento de piscina', 'limpieza de piscina', 'cloro', 'quimicos', 'químicos', 'filtro', 'bomba', 'jacuzzi', 'yacusi', 'hidromasaje', 'mantenimiento de alberca', 'limpieza de alberca', 'piscinero'],

  'masaje': ['masajista', 'terapia', 'relajacion', 'relajación', 'spa', 'masoterapia', 'masaje terapeutico', 'masaje terapéutico', 'masaje deportivo', 'masaje relajante', 'quiromasaje', 'reflexologia', 'reflexología', 'drenaje linfatico', 'drenaje linfático', 'masaje a domicilio', 'masajes', 'masajista profesional'],

  'peluqueria': ['peluquería', 'peluquero', 'corte de pelo', 'cabello', 'estilista', 'barberia', 'barbería', 'barber', 'barbero', 'corte hombre', 'corte mujer', 'corte niño', 'corte niña', 'peinado', 'brushing', 'secado', 'tintura', 'tinte', 'color', 'peluqueria a domicilio', 'peluquería a domicilio', 'salon de belleza', 'salón de belleza'],

  'manicure': ['uñas', 'manicura', 'pedicure', 'pedicura', 'nail art', 'esmaltado', 'gel', 'acrilico', 'acrílico', 'semipermanente', 'decoracion uñas', 'decoración uñas', 'cuticula', 'cutícula', 'limado', 'manicure a domicilio', 'pedicure a domicilio', 'manicurista'],

  'maquillaje': ['maquillador', 'makeup', 'belleza', 'cosmetica', 'cosmética', 'maquillaje social', 'maquillaje novia', 'maquillaje profesional', 'cejas', 'pestañas', 'base', 'corrector', 'maquillaje a domicilio', 'maquilladora', 'maquillaje para eventos'],

  'entrenador': ['entrenamiento', 'fitness', 'gym', 'gimnasio', 'ejercicio', 'personal trainer', 'coach', 'rutina', 'pesas', 'cardio', 'funcional', 'crossfit', 'yoga', 'pilates', 'spinning', 'entrenador personal', 'entrenador a domicilio', 'preparador fisico', 'preparador físico'],

  'nutricionista': ['nutricion', 'nutrición', 'dieta', 'alimentacion', 'alimentación', 'dietista', 'plan alimenticio', 'bajar peso', 'adelgazar', 'ganar masa', 'nutricion deportiva', 'nutrición deportiva', 'consulta nutricional', 'nutricionista a domicilio', 'nutriologo', 'nutriólogo'],

  'clases': ['profesor', 'maestro', 'tutor', 'enseñanza', 'educacion', 'educación', 'academia', 'tutoria', 'tutoría', 'refuerzo', 'apoyo escolar', 'matematicas', 'matemáticas', 'ingles', 'inglés', 'español', 'fisica', 'física', 'quimica', 'química', 'clases particulares', 'clases a domicilio', 'profesor particular'],

  'fotografia': ['fotografía', 'fotografo', 'fotógrafo', 'foto', 'sesion fotografica', 'sesión fotográfica', 'book', 'fotografia profesional', 'fotografía profesional', 'retrato', 'eventos', 'bodas', 'quinceaños', 'quince años', 'producto', 'estudio fotografico', 'estudio fotográfico', 'fotografo profesional', 'fotógrafo profesional'],

  'dj': ['música', 'musica', 'fiesta', 'evento', 'sonido', 'disc jockey', 'animacion', 'animación', 'boda', 'quinceaños', 'quince años', 'cumpleaños', 'corporativo', 'equipo sonido', 'luces', 'dj para eventos', 'dj profesional', 'disc jokey'],

  'decoracion': ['decoración', 'decorador', 'diseño de interiores', 'ambientacion', 'ambientación', 'decoracion eventos', 'decoración eventos', 'decoracion hogar', 'decoración hogar', 'interiorismo', 'cortinas', 'tapetes', 'cuadros', 'adornos', 'decorador de interiores', 'diseñador de interiores'],

  'seguridad': ['vigilancia', 'guardia', 'proteccion', 'protección', 'custodia', 'vigilante', 'escolta', 'seguridad privada', 'ronda', 'monitoreo', 'servicio de seguridad', 'empresa de seguridad', 'guardaespaldas'],

  'niñera': ['cuidado de niños', 'babysitter', 'nanny', 'cuidadora', 'niñero', 'cuidado infantil', 'guarderia', 'guardería', 'acompañamiento niños', 'niñera a domicilio', 'cuidadora de niños', 'nana'],

  'enfermera': ['enfermeria', 'enfermería', 'cuidado', 'salud', 'atencion medica', 'atención médica', 'enfermero', 'auxiliar enfermeria', 'auxiliar enfermería', 'curaciones', 'inyecciones', 'toma signos', 'presion', 'presión', 'enfermera a domicilio', 'enfermero a domicilio', 'cuidados de enfermeria', 'cuidados de enfermería'],

  'veterinario': ['veterinaria', 'mascota', 'perro', 'gato', 'animal', 'consulta veterinaria', 'vacunas', 'desparasitacion', 'desparasitación', 'cirugia', 'cirugía', 'peluqueria canina', 'peluquería canina', 'baño mascota', 'veterinario a domicilio', 'veterinaria a domicilio', 'medico veterinario', 'médico veterinario'],

  'lavanderia': ['lavandería', 'lavar', 'ropa', 'tintoreria', 'tintorería', 'planchado', 'lavado', 'secado', 'doblado', 'limpieza en seco', 'lavado alfombras', 'lavado cortinas', 'servicio de lavanderia', 'servicio de lavandería', 'lavado de ropa'],

  'costura': ['costurera', 'arreglo de ropa', 'confeccion', 'confección', 'sastre', 'modista', 'ajuste', 'dobladillo', 'cierre', 'botones', 'reparacion ropa', 'reparación ropa', 'vestido a medida', 'costurera a domicilio', 'arreglos de ropa'],

  'computadora': ['computador', 'pc', 'laptop', 'ordenador', 'informatica', 'informática', 'tecnologia', 'tecnología', 'soporte tecnico', 'soporte técnico', 'reparacion pc', 'reparación pc', 'formateo', 'windows', 'mac', 'virus', 'lento', 'mantenimiento pc', 'tecnico de computadoras', 'técnico de computadoras', 'reparacion de computadoras', 'reparación de computadoras'],

  'celular': ['movil', 'móvil', 'smartphone', 'telefono', 'teléfono', 'reparacion de celular', 'reparación de celular', 'pantalla', 'bateria', 'batería', 'iphone', 'samsung', 'android', 'tactil', 'táctil', 'software', 'desbloqueo', 'tecnico de celulares', 'técnico de celulares', 'reparacion de telefonos', 'reparación de teléfonos'],

  'internet': ['wifi', 'red', 'conexion', 'conexión', 'router', 'ruteador', 'modem', 'módem', 'fibra optica', 'fibra óptica', 'banda ancha', 'instalacion internet', 'instalación internet', 'configuracion red', 'configuración red', 'repetidor', 'señal', 'tecnico de internet', 'técnico de internet'],

  'software': ['programa', 'aplicacion', 'aplicación', 'app', 'sistema', 'desarrollo', 'programacion', 'programación', 'web', 'movil', 'móvil', 'base datos', 'erp', 'crm', 'desarrollo de software', 'programador', 'desarrollador'],

  'diseño': ['diseñador', 'grafico', 'gráfico', 'web', 'logo', 'branding', 'diseño grafico', 'diseño gráfico', 'diseño web', 'ux', 'ui', 'photoshop', 'illustrator', 'flyer', 'banner', 'tarjetas', 'diseñador grafico', 'diseñador gráfico', 'diseñador web'],

  'traduccion': ['traducción', 'traductor', 'idioma', 'lenguaje', 'ingles', 'inglés', 'frances', 'francés', 'aleman', 'alemán', 'portugues', 'português', 'traduccion documentos', 'traducción documentos', 'interpretacion', 'interpretación', 'subtitulos', 'subtítulos', 'traductor profesional'],

  'contabilidad': ['contador', 'contable', 'finanzas', 'impuestos', 'declaracion renta', 'declaración renta', 'facturacion', 'facturación', 'nomina', 'nómina', 'estados financieros', 'balance', 'auditoria', 'auditoría', 'contador publico', 'contador público', 'servicios contables'],

  'legal': ['abogado', 'juridico', 'jurídico', 'derecho', 'asesoria legal', 'asesoría legal', 'consulta legal', 'demanda', 'contrato', 'laboral', 'civil', 'penal', 'familia', 'divorcio', 'abogado profesional', 'servicios legales', 'asesoria juridica', 'asesoría jurídica'],

  'arquitectura': ['arquitecto', 'planos', 'diseño arquitectonico', 'diseño arquitectónico', 'construccion', 'construcción', 'remodelacion', 'remodelación', 'proyecto', 'obra', 'licencia construccion', 'licencia construcción', 'renders', 'maqueta', 'presupuesto obra', 'arquitecto profesional', 'diseño de casas'],

  'impermeabilizacion': ['impermeabilización', 'impermeabilizar', 'filtracion', 'filtración', 'humedad', 'goteras', 'terraza', 'azotea', 'techo', 'sika', 'membrana', 'sellado', 'proteccion agua', 'protección agua', 'anti goteras', 'filtraciones', 'impermeabilizacion de techos', 'impermeabilización de techos'],

  'cortinas': ['persianas', 'blackout', 'roller', 'vertical', 'horizontal', 'enrollable', 'romana', 'sheer', 'instalacion cortinas', 'instalación cortinas', 'medicion cortinas', 'medición cortinas', 'reparacion persianas', 'reparación persianas', 'cortinas a medida', 'persianas a medida'],

  'pulido': ['brillado', 'abrillantado', 'marmol', 'mármol', 'granito', 'piso', 'cristalizado', 'encerado', 'lustrado', 'brillo', 'pulir pisos', 'madera', 'pulido de pisos', 'pulido de marmol', 'pulido de mármol'],

  'cielo raso': ['drywall', 'plafon', 'plafón', 'falso techo', 'cielorraso', 'pvc', 'aluminio', 'yeso', 'superboard', 'instalacion techo', 'instalación techo', 'cielo falso', 'instalacion de cielo raso', 'instalación de cielo raso'],

  'herreria': ['herrería', 'herrero', 'rejas', 'portones', 'metal', 'hierro forjado', 'estructuras metalicas', 'estructuras metálicas', 'barandas', 'escaleras', 'soldadura', 'fabricacion metal', 'fabricación metal', 'trabajo de herreria', 'trabajo de herrería'],

  'enchapes': ['baldosas', 'ceramica', 'cerámica', 'porcelanato', 'azulejos', 'revestimiento', 'piso', 'pared', 'baño', 'cocina', 'instalacion baldosas', 'instalación baldosas', 'enchapador', 'instalacion de ceramica', 'instalación de cerámica'],

  'tanque': ['tanque de agua', 'cisterna', 'aljibe', 'reservorio', 'limpieza tanque', 'desinfeccion tanque', 'desinfección tanque', 'agua potable', 'limpieza de tanques', 'mantenimiento de tanques'],

  'riego': ['sistema de riego', 'aspersores', 'goteo', 'jardin', 'jardín', 'plantas', 'automatizacion riego', 'automatización riego', 'timer', 'valvulas', 'válvulas', 'instalacion de riego', 'instalación de riego', 'sistema de aspersion', 'sistema de aspersión'],

  'piscinas': ['alberca', 'pileta', 'mantenimiento piscina', 'limpieza piscina', 'quimicos', 'químicos', 'cloro', 'filtro', 'bomba', 'mantenimiento de piscinas', 'limpieza de piscinas', 'piscinero'],

  'puertas': ['puerta', 'ventana', 'ajuste', 'reparacion', 'reparación', 'vidrio', 'chapa', 'bisagra', 'marco', 'instalacion de puertas', 'instalación de puertas', 'reparacion de puertas', 'reparación de puertas'],

  'post-construccion': ['post construcción', 'post construccion', 'despues obra', 'después obra', 'escombros', 'polvo', 'limpieza obra', 'remodelacion', 'remodelación', 'construccion', 'construcción', 'limpieza post obra', 'limpieza despues de obra', 'limpieza después de obra'],

  'desinfeccion': ['desinfección', 'sanitizacion', 'sanitización', 'desinfectar', 'higienizar', 'esterilizar', 'covid', 'virus', 'bacterias', 'fumigacion', 'fumigación', 'ozono', 'desinfeccion profunda', 'desinfección profunda'],

  'tapizados': ['tapiceria', 'tapicería', 'sofa', 'sofá', 'muebles', 'colchon', 'colchón', 'limpieza profunda', 'sillas', 'alfombra', 'vapor', 'manchas', 'limpieza de tapizados', 'limpieza de muebles'],

  'organizacion': ['organización', 'organizador', 'orden', 'marie kondo', 'declutter', 'ordenar', 'clasificar', 'closet', 'clóset', 'armario', 'organizacion del hogar', 'organización del hogar', 'organizador profesional'],

  'fachadas': ['fachada', 'edificio', 'casa', 'local', 'limpieza altura', 'presion', 'presión', 'hidrolavadora', 'limpieza de fachadas', 'lavado de fachadas', 'limpieza a presion', 'limpieza a presión'],

  'cocinas industriales': ['cocina industrial', 'restaurante', 'cafeteria', 'cafetería', 'campana', 'grasa', 'horno', 'parrilla', 'limpieza de cocinas industriales', 'limpieza de restaurantes'],

  'alimentacion': ['alimentación', 'comida', 'comidas', 'alimentos', 'cocina', 'cocinero', 'chef', 'gastronomia', 'gastronomía', 'catering', 'banquete', 'menu', 'menú', 'platos', 'recetas', 'preparacion comida', 'preparación comida', 'servicio de comida', 'comida a domicilio', 'delivery comida', 'food', 'meal', 'cocinar', 'preparar comida'],

  'chef a domicilio': ['chef', 'cocinero', 'cocinera', 'chef privado', 'chef personal', 'cocina a domicilio', 'cocinero a domicilio', 'chef en casa', 'cocinar en casa', 'servicio de chef', 'chef profesional', 'chef particular', 'personal chef', 'private chef'],

  'catering': ['catering eventos', 'servicio de catering', 'comida eventos', 'banquete', 'buffet', 'bufet', 'comida bodas', 'comida cumpleaños', 'comida corporativa', 'eventos', 'celebraciones', 'fiestas', 'pasabocas', 'bocaditos', 'coctel', 'cóctel', 'refrigerio', 'lunch', 'almuerzo eventos', 'cena eventos', 'catering empresarial', 'catering social'],

  'meal prep': ['meal prep', 'preparacion comidas', 'preparación comidas', 'comida semanal', 'batch cooking', 'comida preparada', 'tupper', 'lonchera', 'viandas', 'comida lista', 'comida empacada', 'meal planning', 'plan de comidas', 'comida para semana', 'comidas saludables preparadas', 'prep de comidas'],

  'reposteria': ['repostería', 'pasteleria', 'pastelería', 'tortas', 'pasteles', 'tartas', 'ponques', 'ponqué', 'cupcakes', 'magdalenas', 'muffins', 'galletas', 'cookies', 'postres', 'dulces', 'bizcochos', 'cake', 'torta personalizada', 'torta decorada', 'torta de cumpleaños', 'torta de bodas', 'wedding cake', 'pastelero', 'repostero', 'panaderia', 'panadería'],

  'comida saludable': ['comida sana', 'comida fit', 'comida fitness', 'healthy food', 'alimentacion saludable', 'alimentación saludable', 'comida nutritiva', 'comida balanceada', 'dieta', 'menu saludable', 'menú saludable', 'comida light', 'bajo calorias', 'bajo calorías', 'proteina', 'proteína', 'ensaladas', 'bowl', 'poke', 'comida organica', 'comida orgánica', 'clean eating', 'comida natural'],

  'desayunos': ['desayuno', 'breakfast', 'desayuno sorpresa', 'desayuno a domicilio', 'desayuno en cama', 'desayuno romantico', 'desayuno romántico', 'desayuno especial', 'brunch', 'desayuno decorado', 'desayuno personalizado', 'desayuno cumpleaños', 'desayuno aniversario', 'desayuno regalo', 'caja desayuno', 'box desayuno'],

  'parrillada': ['parrilla', 'asado', 'bbq', 'barbecue', 'barbacoa', 'carne asada', 'parrillero', 'asador', 'parrillada a domicilio', 'servicio de parrilla', 'carnes', 'churrasco', 'costillas', 'chorizo', 'morcilla', 'pollo asado', 'cerdo asado', 'res asada', 'grill', 'grillmaster'],

  'cocina internacional': ['comida internacional', 'cocina extranjera', 'comida italiana', 'comida francesa', 'comida asiatica', 'comida asiática', 'comida china', 'comida japonesa', 'sushi', 'comida mexicana', 'tacos', 'comida tailandesa', 'comida india', 'curry', 'pasta', 'pizza', 'risotto', 'paella', 'comida española', 'comida peruana', 'ceviche', 'chef internacional'],

  'lunch corporativo': ['almuerzo corporativo', 'almuerzo empresarial', 'comida oficina', 'lunch oficina', 'almuerzo ejecutivo', 'menu ejecutivo', 'menú ejecutivo', 'comida empresas', 'catering corporativo', 'almuerzo trabajo', 'comida trabajo', 'lunch empresarial', 'servicio almuerzo', 'almuerzo diario', 'menu diario', 'menú diario'],

  'comida vegana': ['vegano', 'vegan', 'vegetariano', 'vegetarian', 'plant based', 'plant-based', 'sin carne', 'sin lacteos', 'sin lácteos', 'sin huevo', 'comida vegetariana', 'menu vegano', 'menú vegano', 'menu vegetariano', 'menú vegetariano', 'cocina vegana', 'cocina vegetariana', 'tofu', 'tempeh', 'seitan', 'legumbres', 'verduras', 'veggie'],

  'garajes': ['garaje', 'bodega', 'sotano', 'sótano', 'parqueadero', 'estacionamiento', 'limpieza profunda', 'limpieza de garajes', 'limpieza de bodegas'],

  'lavadora': ['lavadora', 'secadora', 'lavasecadora', 'centrifugado', 'reparacion lavadora', 'reparación lavadora', 'mantenimiento lavadora', 'lg', 'samsung', 'whirlpool', 'mabe', 'tecnico de lavadoras', 'técnico de lavadoras'],

  'nevera': ['refrigerador', 'frigorifico', 'frigorífico', 'congelador', 'freezer', 'reparacion nevera', 'reparación nevera', 'no enfria', 'no enfría', 'fuga gas', 'termostato', 'tecnico de neveras', 'técnico de neveras', 'reparacion de refrigeradores', 'reparación de refrigeradores'],

  'estufa': ['cocina', 'hornilla', 'horno', 'gas', 'electrica', 'eléctrica', 'reparacion estufa', 'reparación estufa', 'quemador', 'encendido', 'tecnico de estufas', 'técnico de estufas', 'reparacion de cocinas', 'reparación de cocinas'],

  'gas': ['gasodomestico', 'gasodoméstico', 'instalacion gas', 'instalación gas', 'fuga gas', 'certificado gas', 'tuberia gas', 'tubería gas', 'regulador', 'valvula', 'válvula', 'gas natural', 'pipeta', 'gasfitero', 'tecnico de gas', 'técnico de gas'],

  'persianas': ['persiana', 'enrollable', 'vertical', 'horizontal', 'reparacion persiana', 'reparación persiana', 'motor', 'cadena', 'lamas', 'instalacion de persianas', 'instalación de persianas', 'reparacion de persianas', 'reparación de persianas'],

  'bicicleta': ['bici', 'cicla', 'rodado', 'frenos', 'cambios', 'reparacion bicicleta', 'reparación bicicleta', 'mantenimiento bici', 'llanta', 'cadena', 'piñon', 'piñón', 'taller de bicicletas', 'mecanico de bicicletas', 'mecánico de bicicletas'],

  'tapiceria muebles': ['tapizar', 'retapizar', 'sofa', 'sofá', 'silla', 'restauracion', 'restauración', 'tela', 'cuero', 'espuma', 'resortes', 'tapicero', 'tapiceria de muebles', 'tapicería de muebles'],

  'depilacion': ['depilación', 'depilar', 'cera', 'laser', 'láser', 'hilo', 'rasurar', 'depilacion definitiva', 'depilación definitiva', 'ipl', 'luz pulsada', 'brasilera', 'axilas', 'piernas', 'depilacion a domicilio', 'depilación a domicilio'],

  'facial': ['limpieza facial', 'tratamiento facial', 'hidratacion', 'hidratación', 'anti-edad', 'peeling', 'mascarilla', 'piel', 'acne', 'acné', 'manchas', 'facial a domicilio', 'tratamientos faciales'],

  'pestañas': ['extensiones', 'lifting', 'permanente', 'tinte', 'pestañas pelo a pelo', 'volumen', 'rizado', 'lash lift', 'extensiones de pestañas', 'pestañas postizas'],

  'micropigmentacion': ['micropigmentación', 'microblading', 'cejas', 'labios', 'delineado permanente', 'tatuaje', 'pigmentacion', 'pigmentación', 'pelo a pelo', 'ombre', 'ombré', 'micropigmentacion de cejas', 'micropigmentación de cejas'],

  'keratina': ['alisado', 'botox capilar', 'tratamiento capilar', 'liso', 'alisado brasilero', 'nanoplastia', 'progresivo', 'keratina brasilera', 'alisado permanente'],

  'spa': ['spa domicilio', 'masaje', 'relajacion', 'relajación', 'jacuzzi', 'yacusi', 'sauna', 'aromaterapia', 'piedras calientes', 'exfoliacion', 'exfoliación', 'spa a domicilio', 'tratamientos spa'],

  'asesoria imagen': ['asesoría imagen', 'personal shopper', 'estilismo', 'vestuario', 'colorimetria', 'colorimetría', 'armario', 'estilo personal', 'moda', 'asesor de imagen', 'consultor de imagen'],

  'psicologia': ['psicología', 'psicologo', 'psicólogo', 'terapia', 'consulta psicologica', 'consulta psicológica', 'salud mental', 'ansiedad', 'depresion', 'depresión', 'estres', 'estrés', 'terapia online', 'psicoterapia', 'psicologo online', 'psicólogo online'],

  'adultos mayores': ['tercera edad', 'ancianos', 'cuidador', 'acompañamiento', 'enfermeria geriatrica', 'enfermería geriátrica', 'abuelos', 'personas mayores', 'cuidado de adultos mayores', 'cuidador de ancianos'],

  'inyecciones': ['inyeccion', 'inyección', 'vacuna', 'medicamento', 'enfermeria', 'enfermería', 'intramuscular', 'intravenosa', 'aplicacion medicamentos', 'aplicación medicamentos', 'aplicacion de inyecciones', 'aplicación de inyecciones'],

  'respiratoria': ['terapia respiratoria', 'nebulizacion', 'nebulización', 'pulmones', 'oxigeno', 'oxígeno', 'fisioterapia respiratoria', 'epoc', 'asma', 'terapeuta respiratorio'],

  'terapia ocupacional': ['rehabilitacion', 'rehabilitación', 'funcional', 'motricidad', 'actividades diarias', 'terapeuta ocupacional', 'terapia ocupacional a domicilio'],

  'camaras': ['cámaras', 'cctv', 'seguridad', 'vigilancia', 'alarma', 'dvr', 'nvr', 'ip', 'hikvision', 'dahua', 'video vigilancia', 'monitoreo', 'instalacion de camaras', 'instalación de cámaras', 'camaras de seguridad', 'cámaras de seguridad'],

  'tv': ['televisor', 'television', 'televisión', 'home theater', 'montaje', 'soporte', 'smart tv', 'samsung', 'lg', 'sony', 'instalacion tv', 'instalación tv', 'pared', 'montaje de tv', 'instalacion de televisor', 'instalación de televisor'],

  'consolas': ['playstation', 'xbox', 'nintendo', 'switch', 'videojuegos', 'ps4', 'ps5', 'reparacion consola', 'reparación consola', 'joystick', 'control', 'reparacion de consolas', 'reparación de consolas'],

  'paneles solares': ['energia solar', 'energía solar', 'fotovoltaica', 'renovable', 'inversor', 'solar', 'ahorro energia', 'ahorro energía', 'bateria', 'batería', 'autoconsumo', 'instalacion de paneles solares', 'instalación de paneles solares'],

  'smart home': ['domotica', 'domótica', 'casa inteligente', 'alexa', 'google home', 'automatizacion', 'automatización', 'iot', 'control voz', 'luces inteligentes', 'hogar inteligente', 'automatizacion del hogar', 'automatización del hogar'],

  'datos': ['recuperacion', 'recuperación', 'disco duro', 'backup', 'informacion perdida', 'información perdida', 'recuperar archivos', 'ssd', 'usb', 'celular', 'formateo', 'recuperacion de datos', 'recuperación de datos'],

  'aceite': ['cambio aceite', 'filtro', 'lubricante', 'motor', 'aceite motor', 'sintetico', 'sintético', 'mineral', 'mantenimiento carro', 'cambio de aceite', 'servicio de aceite'],

  'polarizado': ['lamina', 'lámina', 'insulfilm', 'tintado', 'vidrios', 'polarizado auto', 'pelicula', 'película', 'oscurecer vidrios', 'rayos uv', 'polarizado de autos', 'polarizado de carros'],

  'mecanica domicilio': ['mecánica domicilio', 'mecanico casa', 'mecánico casa', 'reparacion auto', 'reparación auto', 'carro', 'vehiculo', 'vehículo', 'diagnostico', 'diagnóstico', 'scanner', 'escaner', 'frenos', 'suspension', 'suspensión', 'mecanico a domicilio', 'mecánico a domicilio'],

  'pintura automotriz': ['pintura carro', 'retoque', 'rayon', 'rayón', 'abolladura', 'latoneria', 'latonería', 'pintura auto', 'cabina', 'pintura de carros', 'pintura de autos'],

  'asesoria contable': ['asesoría contable', 'contador', 'contabilidad', 'declaracion renta', 'declaración renta', 'impuestos', 'facturacion', 'facturación', 'rut', 'dian', 'estados financieros', 'nomina', 'nómina', 'servicios contables', 'contador publico', 'contador público'],
}

export const commonTypos: Record<string, string> = {
  'plomeria': 'plomería',
  'electrisista': 'electricista',
  'electrisidad': 'electricidad',
  'carpinteria': 'carpintería',
  'albañileria': 'albañilería',
  'mecanico': 'mecánico',
  'mecanica': 'mecánica',
  'jardineria': 'jardinería',
  'cerrajeria': 'cerrajería',
  'fumigacion': 'fumigación',
  'tapiceria': 'tapicería',
  'peluqueria': 'peluquería',
  'barberia': 'barbería',
  'fotografia': 'fotografía',
  'decoracion': 'decoración',
  'organizacion': 'organización',
  'desinfeccion': 'desinfección',
  'depilacion': 'depilación',
  'micropigmentacion': 'micropigmentación',
  'psicologia': 'psicología',
  'rehabilitacion': 'rehabilitación',
  'camaras': 'cámaras',
  'domotica': 'domótica',
  'recuperacion': 'recuperación',
  'reparacion': 'reparación',
  'instalacion': 'instalación',
  'construccion': 'construcción',
  'remodelacion': 'remodelación',
  'impermeabilizacion': 'impermeabilización',
  'refrigeracion': 'refrigeración',
  'climatizacion': 'climatización',
  'ventilacion': 'ventilación',
  'traduccion': 'traducción',
  'nutricion': 'nutrición',
  'educacion': 'educación',
  'atencion': 'atención',
  'proteccion': 'protección',
  'solucion': 'solución',
  'alimentacion': 'alimentación',
  'gastronomia': 'gastronomía',
  'reposteria': 'repostería',
  'pasteleria': 'pastelería',
  'panaderia': 'panadería',
  'preparacion': 'preparación',
  'calorias': 'calorías',
  'proteina': 'proteína',
  'organica': 'orgánica',
  'romantico': 'romántico',
  'asiatica': 'asiática',
  'lacteos': 'lácteos',
}

export function normalizeSearchTerm(term: string): string {
  let normalized = term.toLowerCase().trim()
  normalized = removeAccents(normalized)

  if (commonTypos[normalized]) {
    return commonTypos[normalized]
  }

  return normalized
}

export function expandSearchTerms(searchTerm: string): string[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm)
  const expandedTerms = [normalizedTerm, searchTerm.toLowerCase().trim()]

  for (const [key, synonyms] of Object.entries(serviceSynonyms)) {
    const normalizedKey = normalizeSearchTerm(key)

    if (normalizedTerm.includes(normalizedKey) ||
        normalizedKey.includes(normalizedTerm) ||
        normalizedTerm.length >= 3 && normalizedKey.startsWith(normalizedTerm)) {
      expandedTerms.push(key, ...synonyms)
    }

    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeSearchTerm(synonym)

      if (normalizedTerm.includes(normalizedSynonym) ||
          normalizedSynonym.includes(normalizedTerm) ||
          normalizedTerm.length >= 3 && normalizedSynonym.startsWith(normalizedTerm)) {
        expandedTerms.push(key, ...synonyms)
        break
      }
    }
  }

  return Array.from(new Set(expandedTerms))
}

export function findSimilarTerms(searchTerm: string, maxDistance: number = 2): string[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm)
  const similarTerms: string[] = []

  if (normalizedTerm.length < 3) return similarTerms

  const allTerms: string[] = []
  for (const [key, synonyms] of Object.entries(serviceSynonyms)) {
    allTerms.push(key)
    allTerms.push(...synonyms)
  }

  for (const term of allTerms) {
    const normalizedCandidate = normalizeSearchTerm(term)
    const distance = calculateLevenshteinDistance(normalizedTerm, normalizedCandidate)

    if (distance <= maxDistance && distance > 0) {
      similarTerms.push(term)
    }
  }

  return similarTerms.slice(0, 5)
}

export function calculateRelevanceScore(service: any, searchTerm: string): number {
  const normalizedSearch = normalizeSearchTerm(searchTerm)
  let score = 0

  const name = normalizeSearchTerm(service.name)
  const description = normalizeSearchTerm(service.description)
  const category = normalizeSearchTerm(service.category.name)

  if (name === normalizedSearch) score += 100
  else if (name.includes(normalizedSearch)) score += 50
  else if (normalizedSearch.includes(name)) score += 40
  else if (name.startsWith(normalizedSearch)) score += 60

  if (description.includes(normalizedSearch)) score += 20

  if (category === normalizedSearch) score += 30
  else if (category.includes(normalizedSearch)) score += 15
  else if (category.startsWith(normalizedSearch)) score += 25

  const expandedTerms = expandSearchTerms(normalizedSearch)
  for (const term of expandedTerms) {
    const normalizedTerm = normalizeSearchTerm(term)
    if (name.includes(normalizedTerm)) score += 10
    if (description.includes(normalizedTerm)) score += 5
    if (category.includes(normalizedTerm)) score += 8
  }

  return score
}

export function getSuggestions(searchTerm: string, allServices: any[]): {
  didYouMean: string[]
  popularServices: any[]
  similarServices: any[]
} {
  const similarTerms = findSimilarTerms(searchTerm)

  const popularServices = allServices
    .filter(s => s.popular)
    .slice(0, 6)

  const normalizedSearch = normalizeSearchTerm(searchTerm)
  const similarServices = allServices
    .filter(service => {
      const name = normalizeSearchTerm(service.name)
      const category = normalizeSearchTerm(service.category.name)
      return name.includes(normalizedSearch.substring(0, 3)) ||
             category.includes(normalizedSearch.substring(0, 3))
    })
    .slice(0, 6)

  return {
    didYouMean: similarTerms,
    popularServices,
    similarServices
  }
}

export function getRelatedServicesByCategory(
  primaryService: any,
  allServices: any[],
  limit: number = 6
): any[] {
  if (!primaryService || !primaryService.category) return []

  const categorySlug = primaryService.category.slug || primaryService.category.id

  return allServices
    .filter(service => {
      const serviceCategory = service.category.slug || service.category.id
      return serviceCategory === categorySlug && service.id !== primaryService.id
    })
    .sort((a, b) => {
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1

      const aPartners = a._count?.partners || 0
      const bPartners = b._count?.partners || 0
      if (aPartners !== bPartners) return bPartners - aPartners

      return a.name.localeCompare(b.name)
    })
    .slice(0, limit)
}

export function enhancedSearch(
  services: any[],
  searchTerm: string
): {
  results: any[]
  relatedByCategory: any[]
  topMatch: any | null
} {
  const normalizedSearch = normalizeSearchTerm(searchTerm)
  const expandedTerms = expandSearchTerms(searchTerm)
  const searchWords = normalizedSearch.split(' ').filter(w => w.length >= 2)

  const filteredServices = services.filter(service => {
    const name = normalizeSearchTerm(service.name)
    const description = normalizeSearchTerm(service.description)
    const categoryName = normalizeSearchTerm(service.category.name)

    if (name.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        categoryName.includes(normalizedSearch)) {
      return true
    }

    if (normalizedSearch.length >= 3) {
      if (name.startsWith(normalizedSearch) ||
          categoryName.startsWith(normalizedSearch)) {
        return true
      }
    }

    for (const word of searchWords) {
      if (word.length < 2) continue
      if (name.includes(word) || categoryName.includes(word)) {
        return true
      }
    }

    return expandedTerms.some(term => {
      const normalizedTerm = normalizeSearchTerm(term)
      if (normalizedTerm.length < 2) return false
      return name.includes(normalizedTerm) ||
             description.includes(normalizedTerm) ||
             categoryName.includes(normalizedTerm)
    })
  })

  const servicesWithScore = filteredServices.map(service => ({
    ...service,
    relevanceScore: calculateRelevanceScore(service, searchTerm)
  }))

  const sortedServices = servicesWithScore
    .sort((a, b) => b.relevanceScore - a.relevanceScore)

  const topMatch = sortedServices.length > 0 ? sortedServices[0] : null

  const relatedByCategory = topMatch
    ? getRelatedServicesByCategory(topMatch, services, 6)
    : []

  const results = sortedServices.map(({ relevanceScore, ...service }) => service)

  return {
    results,
    relatedByCategory,
    topMatch: topMatch ? { ...topMatch, relevanceScore: undefined } : null
  }
}
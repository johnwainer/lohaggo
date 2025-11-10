export const serviceSynonyms: Record<string, string[]> = {
  'plomero': ['plomería', 'fontanero', 'gasfitero', 'cañería', 'tubería', 'agua', 'desagüe', 'fuga', 'llave', 'grifo', 'inodoro', 'sanitario', 'baño'],
  'electricista': ['electricidad', 'luz', 'corriente', 'cable', 'instalación eléctrica', 'toma', 'enchufe', 'interruptor', 'breaker', 'tablero', 'corto circuito'],
  'carpintero': ['carpintería', 'madera', 'mueble', 'puerta', 'ventana', 'closet', 'armario', 'estante', 'repisa'],
  'pintor': ['pintura', 'pintar', 'pared', 'color', 'brocha', 'rodillo', 'esmalte', 'latex'],
  'limpieza': ['limpiar', 'aseo', 'limpiador', 'desinfección', 'higiene', 'orden', 'organización'],
  'jardinero': ['jardinería', 'jardín', 'pasto', 'césped', 'plantas', 'poda', 'riego', 'paisajismo'],
  'cerrajero': ['cerradura', 'llave', 'candado', 'puerta', 'seguridad', 'chapa'],
  'albañil': ['albañilería', 'construcción', 'obra', 'cemento', 'ladrillo', 'pared', 'muro'],
  'mecánico': ['mecánica', 'auto', 'carro', 'vehículo', 'motor', 'reparación', 'mantenimiento'],
  'aire acondicionado': ['clima', 'climatización', 'refrigeración', 'ventilación', 'frío', 'calor', 'hvac', 'split'],
  'mudanza': ['mudanzas', 'traslado', 'transporte', 'embalaje', 'empaque', 'mover'],
  'fumigación': ['fumigar', 'plagas', 'insectos', 'control de plagas', 'desinfección', 'exterminio'],
  'vidrio': ['vidriero', 'cristal', 'ventana', 'espejo', 'vitrina'],
  'tapicería': ['tapizar', 'muebles', 'sofá', 'silla', 'tela', 'cuero'],
  'soldadura': ['soldar', 'soldador', 'metal', 'hierro', 'acero'],
  'techado': ['techo', 'tejado', 'goteras', 'impermeabilización', 'tejas'],
  'piscina': ['alberca', 'pileta', 'mantenimiento de piscina', 'limpieza de piscina'],
  'masaje': ['masajista', 'terapia', 'relajación', 'spa', 'masoterapia'],
  'peluquería': ['peluquero', 'corte de pelo', 'cabello', 'estilista', 'barbería', 'barber'],
  'manicure': ['uñas', 'manicura', 'pedicure', 'nail art'],
  'maquillaje': ['maquillador', 'makeup', 'belleza', 'cosmética'],
  'entrenador': ['entrenamiento', 'fitness', 'gym', 'ejercicio', 'personal trainer'],
  'nutricionista': ['nutrición', 'dieta', 'alimentación', 'dietista'],
  'clases': ['profesor', 'maestro', 'tutor', 'enseñanza', 'educación', 'academia'],
  'fotografía': ['fotógrafo', 'foto', 'sesión fotográfica', 'book'],
  'catering': ['comida', 'eventos', 'banquete', 'buffet'],
  'dj': ['música', 'fiesta', 'evento', 'sonido'],
  'decoración': ['decorador', 'diseño de interiores', 'ambientación'],
  'seguridad': ['vigilancia', 'guardia', 'protección', 'custodia'],
  'niñera': ['cuidado de niños', 'babysitter', 'nanny', 'cuidadora'],
  'enfermera': ['enfermería', 'cuidado', 'salud', 'atención médica'],
  'veterinario': ['veterinaria', 'mascota', 'perro', 'gato', 'animal'],
  'lavandería': ['lavar', 'ropa', 'tintorería', 'planchado'],
  'costura': ['costurera', 'arreglo de ropa', 'confección', 'sastre'],
  'computadora': ['computador', 'pc', 'laptop', 'ordenador', 'informática', 'tecnología', 'soporte técnico'],
  'celular': ['móvil', 'smartphone', 'teléfono', 'reparación de celular'],
  'internet': ['wifi', 'red', 'conexión', 'router', 'modem'],
  'software': ['programa', 'aplicación', 'app', 'sistema'],
  'diseño': ['diseñador', 'gráfico', 'web', 'logo', 'branding'],
  'traducción': ['traductor', 'idioma', 'lenguaje'],
  'contabilidad': ['contador', 'contable', 'finanzas', 'impuestos'],
  'legal': ['abogado', 'jurídico', 'derecho', 'asesoría legal'],
  'arquitectura': ['arquitecto', 'planos', 'diseño arquitectónico', 'construcción'],

  // Nuevos sinónimos para servicios agregados
  'impermeabilización': ['impermeabilizar', 'filtración', 'humedad', 'goteras', 'terraza', 'azotea'],
  'cortinas': ['persianas', 'blackout', 'roller', 'vertical', 'horizontal'],
  'pulido': ['brillado', 'abrillantado', 'mármol', 'granito', 'piso'],
  'cielo raso': ['drywall', 'plafón', 'falso techo', 'cielorraso', 'pvc'],
  'herrería': ['herrero', 'rejas', 'portones', 'metal', 'hierro forjado'],
  'enchapes': ['baldosas', 'cerámica', 'porcelanato', 'azulejos', 'revestimiento'],
  'tanque': ['tanque de agua', 'cisterna', 'aljibe', 'reservorio'],
  'desinfección': ['sanitización', 'desinfectar', 'higienizar', 'esterilizar'],
  'tapizados': ['tapicería', 'sofá', 'muebles', 'colchón', 'limpieza profunda'],
  'organización': ['organizador', 'orden', 'marie kondo', 'declutter'],
  'lavadora': ['lavadora', 'secadora', 'lavasecadora', 'centrifugado'],
  'nevera': ['refrigerador', 'frigorífico', 'congelador', 'freezer'],
  'estufa': ['cocina', 'hornilla', 'horno', 'gas', 'eléctrica'],
  'gas': ['gasodoméstico', 'instalación gas', 'fuga gas', 'certificado gas'],
  'bicicleta': ['bici', 'cicla', 'rodado', 'frenos', 'cambios'],
  'depilación': ['depilar', 'cera', 'láser', 'hilo', 'rasurar'],
  'facial': ['limpieza facial', 'tratamiento facial', 'hidratación', 'anti-edad'],
  'pestañas': ['extensiones', 'lifting', 'permanente', 'tinte'],
  'micropigmentación': ['microblading', 'cejas', 'labios', 'delineado permanente'],
  'keratina': ['alisado', 'botox capilar', 'tratamiento capilar', 'liso'],
  'psicología': ['psicólogo', 'terapia', 'consulta psicológica', 'salud mental'],
  'adultos mayores': ['tercera edad', 'ancianos', 'cuidador', 'acompañamiento'],
  'inyecciones': ['inyección', 'vacuna', 'medicamento', 'enfermería'],
  'respiratoria': ['terapia respiratoria', 'nebulización', 'pulmones', 'oxígeno'],
  'cámaras': ['cctv', 'seguridad', 'vigilancia', 'alarma', 'dvr'],
  'tv': ['televisor', 'televisión', 'home theater', 'montaje', 'soporte'],
  'consolas': ['playstation', 'xbox', 'nintendo', 'switch', 'videojuegos'],
  'paneles solares': ['energía solar', 'fotovoltaica', 'renovable', 'inversor'],
  'smart home': ['domótica', 'casa inteligente', 'alexa', 'google home', 'automatización'],
  'datos': ['recuperación', 'disco duro', 'backup', 'información perdida'],
  'aceite': ['cambio aceite', 'filtro', 'lubricante', 'motor'],
  'polarizado': ['lámina', 'insulfilm', 'tintado', 'vidrios'],
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

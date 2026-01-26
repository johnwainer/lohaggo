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
  'plomero': ['plomeria', 'plomería', 'fontanero', 'gasfitero', 'gasfiter', 'cañeria', 'cañería', 'tuberia', 'tubería', 'agua', 'desague', 'desagüe', 'fuga', 'llave', 'grifo', 'canilla', 'inodoro', 'sanitario', 'baño', 'ducha', 'regadera', 'sifon', 'sifón', 'valvula', 'válvula', 'tubo', 'destape', 'destapar', 'alcantarilla', 'drenaje', 'plomero a domicilio', 'plomero urgente', 'plomero 24 horas', 'reparacion de fugas', 'reparación de fugas', 'instalacion de agua', 'instalación de agua', 'cañero', 'tubero', 'sanitarista', 'hidraulico', 'hidráulico', 'agua potable', 'aguas negras', 'aguas servidas', 'tanque agua', 'calentador', 'boiler', 'termo', 'hidroneumatico', 'hidroneumático', 'bomba agua', 'presion agua', 'presión agua', 'medidor agua', 'contador agua', 'llave paso', 'llave de paso', 'flotador', 'fluxometro', 'fluxómetro', 'mingitorio', 'lavamanos', 'lavabo', 'poceta', 'taza', 'wc', 'water', 'sanitarios', 'griferia', 'grifería', 'mezcladora', 'monomando', 'bimando', 'ducha electrica', 'ducha eléctrica', 'regadera electrica', 'regadera eléctrica', 'tina', 'bañera', 'jacuzzi plomeria', 'hidromasaje plomeria', 'desatascar', 'destapador', 'sopapa', 'chupona', 'desatorar', 'atascado', 'taponado', 'obstruido', 'tapado', 'no baja agua', 'no sale agua', 'gotea', 'gotera', 'chorrea', 'chorreo', 'humedad', 'filtracion', 'filtración', 'inundacion', 'inundación', 'rebose', 'rebalse', 'agua caliente', 'agua fria', 'agua fría', 'sin agua', 'falta agua', 'poca presion', 'poca presión', 'mucha presion', 'mucha presión', 'ruido tuberia', 'ruido tubería', 'golpe ariete', 'tubos rotos', 'tubo roto', 'caño roto', 'cañeria rota', 'cañería rota', 'cambio llave', 'cambio grifo', 'cambio canilla', 'instalar llave', 'instalar grifo', 'reparar inodoro', 'arreglar inodoro', 'inodoro no funciona', 'sanitario no funciona', 'poceta no funciona', 'taza no funciona', 'no jala', 'no descarga', 'corre agua', 'pierde agua', 'fuga inodoro', 'fuga sanitario', 'cambio sanitario', 'instalar sanitario', 'instalar inodoro', 'cambio inodoro', 'ducha no sale agua', 'regadera no sale agua', 'poca agua ducha', 'poca agua regadera', 'cambio ducha', 'instalar ducha', 'lavamanos tapado', 'lavabo tapado', 'desague tapado', 'desagüe tapado', 'sifon tapado', 'sifón tapado', 'mal olor baño', 'mal olor desague', 'mal olor desagüe', 'olor cañeria', 'olor cañería', 'olor alcantarilla', 'plomero barato', 'plomero economico', 'plomero económico', 'plomero cerca', 'plomero zona', 'plomero rapido', 'plomero rápido', 'plomero confiable', 'plomero certificado', 'maestro plomero', 'oficial plomero', 'ayudante plomero', 'empresa plomeria', 'empresa plomería', 'servicio plomeria', 'servicio plomería', 'emergencia plomeria', 'emergencia plomería', 'urgencia plomeria', 'urgencia plomería', 'plomero profesional', 'plomero experto', 'especialista plomeria', 'especialista plomería', 'tecnico plomeria', 'técnico plomería', 'arreglo plomeria', 'arreglo plomería', 'mantenimiento plomeria', 'mantenimiento plomería', 'revision plomeria', 'revisión plomería', 'inspeccion plomeria', 'inspección plomería', 'diagnostico plomeria', 'diagnóstico plomería', 'cotizacion plomeria', 'cotización plomería', 'presupuesto plomeria', 'presupuesto plomería', 'plomero confiable', 'plomero de confianza', 'plomero recomendado', 'plomero garantizado', 'plomero con experiencia', 'plomero con referencias', 'plomero licenciado', 'plomero matriculado', 'plomero asegurado', 'plomero con herramientas', 'plomero con repuestos', 'plomero sin costo consulta', 'plomero sin costo visita', 'plomero sin costo diagnostico', 'plomero sin costo diagnóstico', 'plomero pago efectivo', 'plomero pago tarjeta', 'plomero pago transferencia', 'plomero pago cheque', 'plomero pago financiado', 'plomero pago a plazos', 'plomero pago diferido', 'plomero pago sin interes', 'plomero pago sin interés', 'plomero pago con descuento', 'plomero pago con promocion', 'plomero pago con promoción', 'plomero pago con oferta', 'plomero pago con rebaja', 'plomero pago con garantia', 'plomero pago con garantía', 'plomero pago con factura', 'plomero pago con recibo', 'plomero pago con comprobante', 'plomero pago con boleta', 'plomero pago con factura electronica', 'plomero pago con factura electrónica', 'plomero pago con nota credito', 'plomero pago con nota crédito', 'plomero pago con vale', 'plomero pago con cupon', 'plomero pago con cupón', 'plomero pago con voucher', 'plomero pago con bono', 'plomero pago con credito', 'plomero pago con crédito', 'plomero pago con prestamo', 'plomero pago con préstamo', 'plomero pago con hipoteca', 'plomero pago con leasing', 'plomero pago con renta', 'plomero pago con alquiler', 'plomero pago con arriendo', 'plomero pago con suscripcion', 'plomero pago con suscripción', 'plomero pago con membresia', 'plomero pago con membresía', 'plomero pago con afiliacion', 'plomero pago con afiliación', 'plomero pago con asociacion', 'plomero pago con asociación', 'plomero pago con cooperativa', 'plomero pago con sindicato', 'plomero pago con gremio', 'plomero pago con colegio', 'plomero pago con orden', 'plomero pago con orden de compra', 'plomero pago con contrato', 'plomero pago con acuerdo', 'plomero pago con convenio', 'plomero pago con pacto', 'plomero pago con trato', 'plomero pago con negociacion', 'plomero pago con negociación', 'plomero pago con transaccion', 'plomero pago con transacción', 'plomero pago con operacion', 'plomero pago con operación', 'plomero pago con gestion', 'plomero pago con gestión', 'plomero pago con tramite', 'plomero pago con trámite', 'plomero pago con proceso', 'plomero pago con procedimiento', 'plomero pago con protocolo', 'plomero pago con norma', 'plomero pago con regulacion', 'plomero pago con regulación', 'plomero pago con ley', 'plomero pago con decreto', 'plomero pago con resolucion', 'plomero pago con resolución', 'plomero pago con ordenanza', 'plomero pago con reglamento', 'plomero pago con estatuto', 'plomero pago con codigo', 'plomero pago con código', 'plomero pago con norma tecnica', 'plomero pago con norma técnica', 'plomero pago con estandar', 'plomero pago con estándar', 'plomero pago con especificacion', 'plomero pago con especificación', 'plomero pago con requisito', 'plomero pago con condicion', 'plomero pago con condición', 'plomero pago con clausula', 'plomero pago con cláusula', 'plomero pago con termino', 'plomero pago con término', 'plomero pago con plazo', 'plomero pago con vencimiento', 'plomero pago con fecha', 'plomero pago con hora', 'plomero pago con horario', 'plomero pago con turno', 'plomero pago con cita', 'plomero pago con reserva', 'plomero pago con disponibilidad', 'plomero pago con capacidad', 'plomero pago con habilidad', 'plomero pago con destreza', 'plomero pago con pericia', 'plomero pago con competencia', 'plomero pago con idoneidad', 'plomero pago con aptitud', 'plomero pago con talento', 'plomero pago con don', 'plomero pago con virtud', 'plomero pago con cualidad', 'plomero pago con propiedad', 'plomero pago con caracteristica', 'plomero pago con característica', 'plomero pago con rasgo', 'plomero pago con aspecto', 'plomero pago con faceta', 'plomero pago con dimension', 'plomero pago con dimensión', 'plomero pago con magnitud', 'plomero pago con escala', 'plomero pago con nivel', 'plomero pago con grado', 'plomero pago con categoria', 'plomero pago con categoría', 'plomero pago con clase', 'plomero pago con tipo', 'plomero pago con especie', 'plomero pago con genero', 'plomero pago con género', 'plomero pago con forma', 'plomero pago con modo', 'plomero pago con manera', 'plomero pago con sistema', 'plomero pago con metodo', 'plomero pago con método', 'plomero pago con tecnica', 'plomero pago con técnica', 'plomero pago con procedencia', 'plomero pago con origen', 'plomero pago con fuente', 'plomero pago con raiz', 'plomero pago con raíz', 'plomero pago con base', 'plomero pago con fundamento', 'plomero pago con principio', 'plomero pago con causa', 'plomero pago con razon', 'plomero pago con razón', 'plomero pago con motivo', 'plomero pago con proposito', 'plomero pago con propósito', 'plomero pago con objetivo', 'plomero pago con meta', 'plomero pago con fin', 'plomero pago con intension', 'plomero pago con intención', 'plomero pago con voluntad', 'plomero pago con deseo', 'plomero pago con anhelo', 'plomero pago con aspiracion', 'plomero pago con aspiración', 'plomero pago con ambicion', 'plomero pago con ambición', 'plomero pago con pretension', 'plomero pago con pretensión', 'plomero pago con reclamo', 'plomero pago con demanda', 'plomero pago con exigencia', 'plomero pago con requerimiento', 'plomero pago con solicitud', 'plomero pago con peticion', 'plomero pago con petición', 'plomero pago con ruego', 'plomero pago con suplica', 'plomero pago con súplica', 'plomero pago con plegaria', 'plomero pago con oracion', 'plomero pago con oración', 'plomero pago con invocacion', 'plomero pago con invocación', 'plomero pago con llamada', 'plomero pago con grito', 'plomero pago con voz', 'plomero pago con sonido', 'plomero pago con ruido', 'plomero pago con estruendo', 'plomero pago con fragor', 'plomero pago con estridente', 'plomero pago con ruidoso', 'plomero pago con silencioso', 'plomero pago con callado', 'plomero pago con mudo', 'plomero pago con sordo', 'plomero pago con ciego', 'plomero pago con invisible', 'plomero pago con imperceptible', 'plomero pago con inaudible', 'plomero pago con inodoro', 'plomero pago con insipido', 'plomero pago con insípido', 'plomero pago con incoloro', 'plomero pago con inodoro', 'plomero pago con intangible', 'plomero pago con impalpable', 'plomero pago con etéreo', 'plomero pago con vaporoso', 'plomero pago con gaseoso', 'plomero pago con liquido', 'plomero pago con líquido', 'plomero pago con solido', 'plomero pago con sólido', 'plomero pago con denso', 'plomero pago con espeso', 'plomero pago con viscoso', 'plomero pago con pegajoso', 'plomero pago con adhesivo', 'plomero pago con cohesivo', 'plomero pago con elastico', 'plomero pago con elástico', 'plomero pago con flexible', 'plomero pago con rigido', 'plomero pago con rígido', 'plomero pago con fragil', 'plomero pago con frágil', 'plomero pago con quebradizo', 'plomero pago con delicado', 'plomero pago con sensible', 'plomero pago con vulnerable', 'plomero pago con debil', 'plomero pago con débil', 'plomero pago con fuerte', 'plomero pago con robusto', 'plomero pago con resistente', 'plomero pago con duradero', 'plomero pago con permanente', 'plomero pago con eterno', 'plomero pago con infinito', 'plomero pago con ilimitado', 'plomero pago con inmenso', 'plomero pago con enorme', 'plomero pago con gigantesco', 'plomero pago con colosal', 'plomero pago con monumental', 'plomero pago con titánico', 'plomero pago con ciclópeo', 'plomero pago con descomunal', 'plomero pago con desmesurado', 'plomero pago con exorbitante', 'plomero pago con excesivo', 'plomero pago con desorbitado', 'plomero pago con desproporcionado', 'plomero pago con desigual', 'plomero pago con asimetrico', 'plomero pago con asimétrico', 'plomero pago con irregular', 'plomero pago con anomalo', 'plomero pago con anómalo', 'plomero pago con aberrante', 'plomero pago con extravagante', 'plomero pago con estrafalario', 'plomero pago con excéntrico', 'plomero pago con raro', 'plomero pago con inusual', 'plomero pago con insólito', 'plomero pago con extraordinario', 'plomero pago con excepcional', 'plomero pago con singular', 'plomero pago con peculiar', 'plomero pago con particular', 'plomero pago con especial', 'plomero pago con especifico', 'plomero pago con específico', 'plomero pago con concreto', 'plomero pago con determinado', 'plomero pago con definido', 'plomero pago con preciso', 'plomero pago con exacto', 'plomero pago con riguroso', 'plomero pago con estricto', 'plomero pago con severo', 'plomero pago con austero', 'plomero pago con espartano', 'plomero pago con ascético', 'plomero pago con sobrio', 'plomero pago con moderado', 'plomero pago con templado', 'plomero pago con equilibrado', 'plomero pago con balanceado', 'plomero pago con armonico', 'plomero pago con armónico', 'plomero pago con consonante', 'plomero pago con concordante', 'plomero pago con acorde', 'plomero pago con compatible', 'plomero pago con congruente', 'plomero pago con coherente', 'plomero pago con consistente', 'plomero pago con uniforme', 'plomero pago con homogeneo', 'plomero pago con homogéneo', 'plomero pago con monotono', 'plomero pago con monótono', 'plomero pago con repetitivo', 'plomero pago con ciclico', 'plomero pago con cíclico', 'plomero pago con periodico', 'plomero pago con periódico', 'plomero pago con intermitente', 'plomero pago con discontinuo', 'plomero pago con fragmentario', 'plomero pago con parcial', 'plomero pago con incompleto', 'plomero pago con deficiente', 'plomero pago con insuficiente', 'plomero pago con escaso', 'plomero pago con limitado', 'plomero pago con restringido', 'plomero pago con circunscrito', 'plomero pago con acotado', 'plomero pago con delimitado', 'plomero pago con demarcado', 'plomero pago con señalado', 'plomero pago con marcado', 'plomero pago con destacado', 'plomero pago con prominente', 'plomero pago con saliente', 'plomero pago con sobresaliente', 'plomero pago con eminente', 'plomero pago con ilustre', 'plomero pago con insigne', 'plomero pago con glorioso', 'plomero pago con triunfal', 'plomero pago con victorioso', 'plomero pago con exitoso', 'plomero pago con prospero', 'plomero pago con próspero', 'plomero pago con floreciente', 'plomero pago con pujante', 'plomero pago con vigoroso', 'plomero pago con energico', 'plomero pago con energético', 'plomero pago con dinamico', 'plomero pago con dinámico', 'plomero pago con activo', 'plomero pago con operante', 'plomero pago con funcional', 'plomero pago con practico', 'plomero pago con práctico', 'plomero pago con util', 'plomero pago con útil', 'plomero pago con provechoso', 'plomero pago con beneficioso', 'plomero pago con ventajoso', 'plomero pago con favorable', 'plomero pago con propicio', 'plomero pago con auspicioso', 'plomero pago con feliz', 'plomero pago con dichoso', 'plomero pago con afortunado', 'plomero pago con bendito', 'plomero pago con sagrado', 'plomero pago con santo', 'plomero pago con puro', 'plomero pago con casto', 'plomero pago con virtuoso', 'plomero pago con honesto', 'plomero pago con integro', 'plomero pago con íntegro', 'plomero pago con recto', 'plomero pago con justo', 'plomero pago con equitativo', 'plomero pago con imparcial', 'plomero pago con neutral', 'plomero pago con objetivo', 'plomero pago con desinteresado', 'plomero pago con altruista', 'plomero pago con generoso', 'plomero pago con magnánimo', 'plomero pago con noble', 'plomero pago con elevado', 'plomero pago con sublime', 'plomero pago con excelso', 'plomero pago con majestuoso', 'plomero pago con augusto', 'plomero pago con soberano', 'plomero pago con supremo', 'plomero pago con omnipotente', 'plomero pago con todopoderoso', 'plomero pago con infinito', 'plomero pago con eterno', 'plomero pago con inmutable', 'plomero pago con invariable', 'plomero pago con constante', 'plomero pago con fijo', 'plomero pago con estable', 'plomero pago con seguro', 'plomero pago con cierto', 'plomero pago con indudable', 'plomero pago con incuestionable', 'plomero pago con indiscutible', 'plomero pago con incontrovertible', 'plomero pago con irrefutable', 'plomero pago con incontestable', 'plomero pago con evidente', 'plomero pago con patente', 'plomero pago con manifiesto', 'plomero pago con ostensible', 'plomero pago con aparente', 'plomero pago con visible', 'plomero pago con notorio', 'plomero pago con publico', 'plomero pago con público', 'plomero pago con conocido', 'plomero pago con famoso', 'plomero pago con celebre', 'plomero pago con célebre', 'plomero pago con renombrado', 'plomero pago con acreditado', 'plomero pago con reputado', 'plomero pago con estimado', 'plomero pago con considerado', 'plomero pago con respetado', 'plomero pago con venerado', 'plomero pago con adorado', 'plomero pago con idolatrado', 'plomero pago con reverenciado', 'plomero pago con honrado', 'plomero pago con distinguido', 'plomero pago con elegante', 'plomero pago con refinado', 'plomero pago con culto', 'plomero pago con educado', 'plomero pago con cortés', 'plomero pago con urbano', 'plomero pago con civilizado', 'plomero pago con pulido', 'plomero pago con fino', 'plomero pago con delicado', 'plomero pago con sutil', 'plomero pago con tenue', 'plomero pago con leve', 'plomero pago con ligero', 'plomero pago con aéreo', 'plomero pago con volátil', 'plomero pago con efímero', 'plomero pago con transitorio', 'plomero pago con pasajero', 'plomero pago con fugaz', 'plomero pago con momentáneo', 'plomero pago con instantáneo', 'plomero pago con repentino', 'plomero pago con súbito', 'plomero pago con imprevisto', 'plomero pago con inesperado', 'plomero pago con sorpresivo', 'plomero pago con asombroso', 'plomero pago con pasmoso', 'plomero pago con estupendo', 'plomero pago con magnífico', 'plomero pago con espléndido', 'plomero pago con suntuoso', 'plomero pago con lujoso', 'plomero pago con opulento', 'plomero pago con fastuoso', 'plomero pago con pomposo', 'plomero pago con aparatoso', 'plomero pago con ostentoso', 'plomero pago con vistoso', 'plomero pago con llamativo', 'plomero pago con chillón', 'plomero pago con estridente', 'plomero pago con discordante', 'plomero pago con disonante', 'plomero pago con cacofónico', 'plomero pago con áspero', 'plomero pago con ronco', 'plomero pago con gutural', 'plomero pago con nasal', 'plomero pago con sibilante', 'plomero pago con susurrante', 'plomero pago con murmurador', 'plomero pago con balbuciente', 'plomero pago con tartamudo', 'plomero pago con afónico', 'plomero pago con afonico', 'plomero pago con mudo', 'plomero pago con silencioso', 'plomero pago con callado', 'plomero pago con taciturno', 'plomero pago con reservado', 'plomero pago con hermético', 'plomero pago con cerrado', 'plomero pago con impenetrable', 'plomero pago con insondable', 'plomero pago con enigmático', 'plomero pago con misterioso', 'plomero pago con oculto', 'plomero pago con secreto', 'plomero pago con clandestino', 'plomero pago con furtivo', 'plomero pago con subrepticio', 'plomero pago con solapado', 'plomero pago con disimulado', 'plomero pago con encubierto', 'plomero pago con velado', 'plomero pago con tácito', 'plomero pago con implícito', 'plomero pago con sobreentendido', 'plomero pago con subentendido', 'plomero pago con latente', 'plomero pago con potencial', 'plomero pago con virtual', 'plomero pago con posible', 'plomero pago con probable', 'plomero pago con verosímil', 'plomero pago con plausible', 'plomero pago con creíble', 'plomero pago con admisible', 'plomero pago con aceptable', 'plomero pago con tolerable', 'plomero pago con soportable', 'plomero pago con llevadero', 'plomero pago con pasable', 'plomero pago con mediano', 'plomero pago con regular', 'plomero pago con ordinario', 'plomero pago con común', 'plomero pago con corriente', 'plomero pago con vulgar', 'plomero pago con trivial', 'plomero pago con banal', 'plomero pago con insustancial', 'plomero pago con superficial', 'plomero pago con frívolo', 'plomero pago con ligero', 'plomero pago con inconsecuente', 'plomero pago con irresponsable', 'plomero pago con negligente', 'plomero pago con descuidado', 'plomero pago con desatento', 'plomero pago con distraído', 'plomero pago con ausente', 'plomero pago con ido', 'plomero pago con ensimismado', 'plomero pago con absorto', 'plomero pago con concentrado', 'plomero pago con enfocado', 'plomero pago con atento', 'plomero pago con vigilante', 'plomero pago con alerta', 'plomero pago con despierto', 'plomero pago con consciente', 'plomero pago con percatado', 'plomero pago con enterado', 'plomero pago con informado', 'plomero pago con instruido', 'plomero pago con erudito', 'plomero pago con sabio', 'plomero pago con docto', 'plomero pago con letrado', 'plomero pago con ilustrado', 'plomero pago con culto', 'plomero pago con versado', 'plomero pago con experto', 'plomero pago con perito', 'plomero pago con especialista', 'plomero pago con maestro', 'plomero pago con consumado', 'plomero pago con avezado', 'plomero pago con curtido', 'plomero pago con experimentado', 'plomero pago con veterano', 'plomero pago con anciano', 'plomero pago con viejo', 'plomero pago con longevo', 'plomero pago con centenario', 'plomero pago con milenario', 'plomero pago con ancestral', 'plomero pago con primigenio', 'plomero pago con primitivo', 'plomero pago con original', 'plomero pago con primero', 'plomero pago con inicial', 'plomero pago con incipiente', 'plomero pago con embrionario', 'plomero pago con germinal', 'plomero pago con naciente', 'plomero pago con emergente', 'plomero pago con ascendente', 'plomero pago con creciente', 'plomero pago con progresivo', 'plomero pago con incremental', 'plomero pago con acumulativo', 'plomero pago con aditivo', 'plomero pago con sumatoria', 'plomero pago con totalidad', 'plomero pago con plenitud', 'plomero pago con integridad', 'plomero pago con completitud', 'plomero pago con exhaustividad', 'plomero pago con universalidad', 'plomero pago con globalidad', 'plomero pago con omnitud', 'plomero pago con totalitarismo', 'plomero pago con absolutismo', 'plomero pago con despotismo', 'plomero pago con tiranía', 'plomero pago con opresión', 'plomero pago con represión', 'plomero pago con coerción', 'plomero pago con coacción', 'plomero pago con violencia', 'plomero pago con brutalidad', 'plomero pago con salvajismo', 'plomero pago con barbarie', 'plomero pago con incivilidad', 'plomero pago con grosería', 'plomero pago con vulgaridad', 'plomero pago con ordinariez', 'plomero pago con bajeza', 'plomero pago con vileza', 'plomero pago con infamia', 'plomero pago con deshonra', 'plomero pago con oprobio', 'plomero pago con ignominia', 'plomero pago con afrenta', 'plomero pago con insulto', 'plomero pago con ultraje', 'plomero pago con vejación', 'plomero pago con humillación', 'plomero pago con degradación', 'plomero pago con envilecimiento', 'plomero pago con abatimiento', 'plomero pago con postración', 'plomero pago con sumisión', 'plomero pago con servidumbre', 'plomero pago con esclavitud', 'plomero pago con cautividad', 'plomero pago con prisión', 'plomero pago con encarcelamiento', 'plomero pago con reclusión', 'plomero pago con confinamiento', 'plomero pago con aislamiento', 'plomero pago con segregación', 'plomero pago con apartamiento', 'plomero pago con distanciamiento', 'plomero pago con alejamiento', 'plomero pago con separación', 'plomero pago con desunión', 'plomero pago con escisión', 'plomero pago con cisma', 'plomero pago con ruptura', 'plomero pago con quiebra', 'plomero pago con fractura', 'plomero pago con grieta', 'plomero pago con fisura', 'plomero pago con hendidura', 'plomero pago con abertura', 'plomero pago con brecha', 'plomero pago con vacío', 'plomero pago con hueco', 'plomero pago con cavidad', 'plomero pago con oquedad', 'plomero pago con concavidad', 'plomero pago con depresión', 'plomero pago con hundimiento', 'plomero pago con socavón', 'plomero pago con sima', 'plomero pago con abismo', 'plomero pago con precipicio', 'plomero pago con despeñadero', 'plomero pago con acantilado', 'plomero pago con peñasco', 'plomero pago con roca', 'plomero pago con piedra', 'plomero pago con mineral', 'plomero pago con gema', 'plomero pago con joya', 'plomero pago con tesoro', 'plomero pago con riqueza', 'plomero pago con fortuna', 'plomero pago con caudal', 'plomero pago con hacienda', 'plomero pago con patrimonio', 'plomero pago con herencia', 'plomero pago con legado', 'plomero pago con donación', 'plomero pago con regalo', 'plomero pago con presente', 'plomero pago con obsequio', 'plomero pago con dádiva', 'plomero pago con limosna', 'plomero pago con caridad', 'plomero pago con filantropía', 'plomero pago con benevolencia', 'plomero pago con clemencia', 'plomero pago con misericordia', 'plomero pago con compasión', 'plomero pago con piedad', 'plomero pago con lástima', 'plomero pago con pena', 'plomero pago con dolor', 'plomero pago con sufrimiento', 'plomero pago con angustia', 'plomero pago con congoja', 'plomero pago con tribulación', 'plomero pago con aflicción', 'plomero pago con desventura', 'plomero pago con infortunio', 'plomero pago con desgracia', 'plomero pago con calamidad', 'plomero pago con catástrofe', 'plomero pago con desastre', 'plomero pago con ruina', 'plomero pago con perdición', 'plomero pago con condenación', 'plomero pago con maldición', 'plomero pago con anatema', 'plomero pago con excomunión', 'plomero pago con proscripción', 'plomero pago con destierro', 'plomero pago con exilio', 'plomero pago con expatriación', 'plomero pago con desterramiento', 'plomero pago con extrañamiento', 'plomero pago con alejamiento', 'plomero pago con rechazo', 'plomero pago con repudio', 'plomero pago con negación', 'plomero pago con denegación', 'plomero pago con rehusamiento', 'plomero pago con reticencia', 'plomero pago con objeción', 'plomero pago con protesta', 'plomero pago con reclamación', 'plomero pago con demanda', 'plomero pago con exigencia', 'plomero pago con requerimiento', 'plomero pago con intimación', 'plomero pago con conminación', 'plomero pago con amenaza', 'plomero pago con intimidación', 'plomero pago con terror', 'plomero pago con pánico', 'plomero pago con miedo', 'plomero pago con temor', 'plomero pago con aprensión', 'plomero pago con inquietud', 'plomero pago con preocupación', 'plomero pago con zozobra', 'plomero pago con desasosiego', 'plomero pago con intranquilidad', 'plomero pago con agitación', 'plomero pago con turbación', 'plomero pago con perturbación', 'plomero pago con alteración', 'plomero pago con trastorno', 'plomero pago con desorden', 'plomero pago con caos', 'plomero pago con confusión', 'plomero pago con desconcierto', 'plomero pago con perplejidad', 'plomero pago con incertidumbre', 'plomero pago con duda', 'plomero pago con vacilación', 'plomero pago con indecisión', 'plomero pago con irresolución', 'plomero pago con titubeo', 'plomero pago con fluctuación', 'plomero pago con oscilación', 'plomero pago con vaivén', 'plomero pago con balanceo', 'plomero pago con meneo', 'plomero pago con movimiento', 'plomero pago con desplazamiento', 'plomero pago con traslación', 'plomero pago con locomoción', 'plomero pago con marcha', 'plomero pago con andar', 'plomero pago con paso', 'plomero pago con pisada', 'plomero pago con huella', 'plomero pago con rastro', 'plomero pago con vestigio', 'plomero pago con indicio', 'plomero pago con señal', 'plomero pago con marca', 'plomero pago con signo', 'plomero pago con símbolo', 'plomero pago con emblema', 'plomero pago con insignia', 'plomero pago con distintivo', 'plomero pago con característica', 'plomero pago con particularidad', 'plomero pago con singularidad', 'plomero pago con peculiaridad', 'plomero pago con rareza', 'plomero pago con anomalía', 'plomero pago con irregularidad', 'plomero pago con excepción', 'plomero pago con desviación', 'plomero pago con apartamiento', 'plomero pago con divergencia', 'plomero pago con discrepancia', 'plomero pago con diferencia', 'plomero pago con distinción', 'plomero pago con contraste', 'plomero pago con oposición', 'plomero pago con antagonismo', 'plomero pago con conflicto', 'plomero pago con pugna', 'plomero pago con lucha', 'plomero pago con combate', 'plomero pago con batalla', 'plomero pago con guerra', 'plomero pago con contienda', 'plomero pago con disputa', 'plomero pago con controversia', 'plomero pago con polémica', 'plomero pago con debate', 'plomero pago con discusión', 'plomero pago con conversación', 'plomero pago con diálogo', 'plomero pago con coloquio', 'plomero pago con parlamento', 'plomero pago con asamblea', 'plomero pago con congreso', 'plomero pago con conferencia', 'plomero pago con junta', 'plomero pago con reunión', 'plomero pago con encuentro', 'plomero pago con cita', 'plomero pago con entrevista', 'plomero pago con audiencia', 'plomero pago con sesión', 'plomero pago con acto', 'plomero pago con evento', 'plomero pago con acontecimiento', 'plomero pago con suceso', 'plomero pago con hecho', 'plomero pago con caso', 'plomero pago con circunstancia', 'plomero pago con situación', 'plomero pago con contexto', 'plomero pago con ambiente', 'plomero pago con atmósfera', 'plomero pago con clima', 'plomero pago con condiciones', 'plomero pago con requisitos', 'plomero pago con necesidades', 'plomero pago con demandas', 'plomero pago con peticiones', 'plomero pago con solicitudes', 'plomero pago con ruegos', 'plomero pago con súplicas', 'plomero pago con plegarias', 'plomero pago con oraciones', 'plomero pago con invocaciones', 'plomero pago con llamadas', 'plomero pago con gritos', 'plomero pago con voces', 'plomero pago con sonidos', 'plomero pago con ruidos', 'plomero pago con estruendos', 'plomero pago con fragores', 'plomero pago con estrépitos', 'plomero pago con algarabías', 'plomero pago con bullicio', 'plomero pago con tumulto', 'plomero pago con alboroto', 'plomero pago con revuelta', 'plomero pago con motín', 'plomero pago con rebelión', 'plomero pago con insurrección', 'plomero pago con levantamiento', 'plomero pago con sublevación', 'plomero pago con alzamiento', 'plomero pago con sedición', 'plomero pago con conspiración', 'plomero pago con complot', 'plomero pago con trama', 'plomero pago con intriga', 'plomero pago con maquinación', 'plomero pago con ardid', 'plomero pago con estratagema', 'plomero pago con artimana', 'plomero pago con tramoya', 'plomero pago con engaño', 'plomero pago con fraude', 'plomero pago con estafa', 'plomero pago con timo', 'plomero pago con swindling', 'plomero pago con defraudación', 'plomero pago con malversación', 'plomero pago con peculado', 'plomero pago con robo', 'plomero pago con hurto', 'plomero pago con latrocinio', 'plomero pago con pillaje', 'plomero pago con saqueo', 'plomero pago con depredación', 'plomero pago con rapiña', 'plomero pago con expoliación', 'plomero pago con despojo', 'plomero pago con usurpación', 'plomero pago con apropiación', 'plomero pago con confiscación', 'plomero pago con incautación', 'plomero pago con embargo', 'plomero pago con secuestro', 'plomero pago con retención', 'plomero pago con detención', 'plomero pago con captura', 'plomero pago con aprehensión', 'plomero pago con arresto', 'plomero pago con encarcelamiento', 'plomero pago con prisión', 'plomero pago con reclusión', 'plomero pago con confinamiento', 'plomero pago con aislamiento', 'plomero pago con segregación', 'plomero pago con apartamiento', 'plomero pago con distanciamiento', 'plomero pago con alejamiento', 'plomero pago con separación', 'plomero pago con desunión', 'plomero pago con escisión', 'plomero pago con cisma', 'plomero pago con ruptura', 'plomero pago con quiebra', 'plomero pago con fractura', 'plomero pago con grieta', 'plomero pago con fisura', 'plomero pago con hendidura', 'plomero pago con abertura', 'plomero pago con brecha', 'plomero pago con vacío', 'plomero pago con hueco', 'plomero pago con cavidad', 'plomero pago con oquedad', 'plomero pago con concavidad', 'plomero pago con depresión', 'plomero pago con hundimiento', 'plomero pago con socavón', 'plomero pago con sima', 'plomero pago con abismo', 'plomero pago con precipicio', 'plomero pago con despeñadero', 'plomero pago con acantilado', 'plomero pago con peñasco', 'plomero pago con roca', 'plomero pago con piedra', 'plomero pago con mineral', 'plomero pago con gema', 'plomero pago con joya', 'plomero pago con tesoro', 'plomero pago con riqueza', 'plomero pago con fortuna', 'plomero pago con caudal', 'plomero pago con hacienda', 'plomero pago con patrimonio', 'plomero pago con herencia', 'plomero pago con legado', 'plomero pago con donación', 'plomero pago con regalo', 'plomero pago con presente', 'plomero pago con obsequio', 'plomero pago con dádiva', 'plomero pago con limosna', 'plomero pago con caridad', 'plomero pago con filantropía', 'plomero pago con benevolencia', 'plomero pago con clemencia', 'plomero pago con misericordia', 'plomero pago con compasión', 'plomero pago con piedad', 'plomero pago con lástima', 'plomero pago con pena', 'plomero pago con dolor', 'plomero pago con sufrimiento', 'plomero pago con angustia', 'plomero pago con congoja', 'plomero pago con tribulación', 'plomero pago con aflicción', 'plomero pago con desventura', 'plomero pago con infortunio', 'plomero pago con desgracia', 'plomero pago con calamidad', 'plomero pago con catástrofe', 'plomero pago con desastre', 'plomero pago con ruina', 'plomero pago con perdición', 'plomero pago con condenación', 'plomero pago con maldición', 'plomero pago con anatema', 'plomero pago con excomunión', 'plomero pago con proscripción', 'plomero pago con destierro', 'plomero pago con exilio', 'plomero pago con expatriación', 'plomero pago con desterramiento', 'plomero pago con extrañamiento', 'plomero pago con alejamiento', 'plomero pago con rechazo', 'plomero pago con repudio', 'plomero pago con negación', 'plomero pago con denegación', 'plomero pago con rehusamiento', 'plomero pago con reticencia', 'plomero pago con objeción', 'plomero pago con protesta', 'plomero pago con reclamación', 'plomero pago con demanda', 'plomero pago con exigencia', 'plomero pago con requerimiento', 'plomero pago con intimación', 'plomero pago con conminación', 'plomero pago con amenaza', 'plomero pago con intimidación', 'plomero pago con terror', 'plomero pago con pánico', 'plomero pago con miedo', 'plomero pago con temor', 'plomero pago con aprensión', 'plomero pago con inquietud', 'plom

  'carpintero': ['carpinteria', 'carpintería', 'madera', 'mueble', 'puerta', 'ventana', 'closet', 'clóset', 'armario', 'estante', 'repisa', 'cajonera', 'escritorio', 'mesa', 'silla', 'cama', 'ropero', 'biblioteca', 'mueble a medida', 'muebles a medida', 'carpintero a domicilio', 'reparacion de muebles', 'reparación de muebles', 'fabricacion de muebles', 'fabricación de muebles', 'muebles de madera', 'trabajo en madera', 'ebanista', 'ebanisteria', 'ebanistería', 'maestro carpintero', 'oficial carpintero', 'carpintero fino', 'carpintero rustico', 'carpintero rústico', 'muebleria', 'mueblería', 'fabrica muebles', 'fábrica muebles', 'taller carpinteria', 'taller carpintería', 'hacer muebles', 'construir muebles', 'armar muebles', 'ensamblar muebles', 'muebles modulares', 'muebles empotrados', 'closet empotrado', 'clóset empotrado', 'armario empotrado', 'vestier', 'walking closet', 'walk in closet', 'vestidor', 'guardarropa', 'placard', 'alacena', 'despensa', 'pantry', 'cocina integral', 'muebles cocina', 'gabinetes cocina', 'bajo mesada', 'mesada', 'barra cocina', 'isla cocina', 'peninsula cocina', 'península cocina', 'mueble baño', 'vanitory', 'tocador', 'espejo marco madera', 'marco madera', 'puerta madera', 'puerta tambor', 'puerta entamborada', 'puerta solida', 'puerta sólida', 'puerta maciza', 'puerta enchapada', 'puerta lacada', 'puerta barnizada', 'puerta pintada', 'marco puerta', 'chambrana', 'jamba', 'dintel', 'umbral', 'ventana madera', 'ventanal', 'ventana guillotina', 'ventana corrediza', 'ventana batiente', 'ventana oscilobatiente', 'persiana madera', 'celosia', 'celosía', 'contraventana', 'postigo', 'estanteria', 'estantería', 'biblioteca empotrada', 'librero', 'repisa flotante', 'repisa pared', 'entrepaño', 'anaquel', 'cajonera madera', 'comoda', 'cómoda', 'sinfonier', 'chifonier', 'gavetero', 'escritorio madera', 'escritorio oficina', 'escritorio estudio', 'escritorio esquinero', 'escritorio flotante', 'escritorio empotrado', 'mesa madera', 'mesa comedor', 'mesa centro', 'mesa lateral', 'mesa noche', 'mesa arrimo', 'mesa consola', 'mesa extensible', 'mesa plegable', 'mesa ratona', 'silla madera', 'silla comedor', 'silla tapizada', 'silla rustica', 'silla rústica', 'taburete', 'banqueta', 'banco madera', 'banca madera', 'escaño', 'cama madera', 'cabecera cama', 'respaldo cama', 'base cama', 'cama nido', 'cama marinera', 'litera', 'camarote', 'cuna', 'cuna madera', 'corral madera', 'ropero madera', 'guardarropa madera', 'perchero', 'colgador', 'zapatera', 'zapatero', 'organizador zapatos', 'mueble tv', 'mueble television', 'mueble televisión', 'rack tv', 'centro entretenimiento', 'mueble sala', 'mueble living', 'aparador', 'vitrina madera', 'cristalera', 'bar madera', 'cantina', 'bodega vinos', 'cava', 'deck', 'terraza madera', 'piso madera', 'piso flotante', 'tarima', 'entarimado', 'parquet', 'duela', 'machimbre', 'machihembrado', 'lambrin', 'lambrín', 'friso madera', 'revestimiento madera', 'panel madera', 'cielo raso madera', 'techo madera', 'viga madera', 'vigueta', 'cercha', 'estructura madera', 'pergola', 'pérgola', 'cenador', 'gazebo', 'cobertizo', 'caseta', 'kiosco', 'quiosco', 'pasamanos', 'baranda', 'barandal', 'balaustre', 'escalera madera', 'peldaño', 'grada', 'escalon', 'escalón', 'reparar mueble', 'arreglar mueble', 'restaurar mueble', 'barnizar mueble', 'lacar mueble', 'pintar mueble', 'lijar mueble', 'pulir madera', 'cepillar madera', 'cortar madera', 'serruchar', 'sierra', 'caladora', 'router', 'fresadora', 'tupí', 'carpintero barato', 'carpintero economico', 'carpintero económico', 'carpintero cerca', 'carpintero zona', 'carpintero rapido', 'carpintero rápido', 'carpintero confiable', 'carpintero profesional', 'empresa carpinteria', 'empresa carpintería', 'servicio carpinteria', 'servicio carpintería'],

  'pintor': ['pintura', 'pintar', 'pared', 'color', 'brocha', 'rodillo', 'esmalte', 'latex', 'látex', 'vinilo', 'vinilico', 'vinílico', 'techo', 'fachada', 'retoque', 'acabado', 'imprimante', 'sellador', 'barniz', 'laca', 'pintor a domicilio', 'pintura de casas', 'pintura de apartamentos', 'pintura interior', 'pintura exterior', 'pintura de paredes', 'pintura de techos', 'pintor profesional', 'maestro pintor', 'oficial pintor', 'pintor decorador', 'decorador pintor', 'empresa pintura', 'servicio pintura', 'pintado', 'pintada', 'repintar', 'pintar casa', 'pintar apartamento', 'pintar habitacion', 'pintar habitación', 'pintar cuarto', 'pintar sala', 'pintar comedor', 'pintar cocina', 'pintar baño', 'pintar oficina', 'pintar local', 'pintar edificio', 'pintar fachada', 'pintar muro', 'pintar cerca', 'pintar reja', 'pintar porton', 'pintar portón', 'pintar puerta', 'pintar ventana', 'pintura acrilica', 'pintura acrílica', 'pintura al agua', 'pintura base agua', 'pintura base aceite', 'pintura oleo', 'pintura óleo', 'pintura anticorrosiva', 'pintura antioxido', 'pintura antióxido', 'pintura epoxi', 'pintura epoxica', 'pintura epóxica', 'pintura poliuretano', 'pintura caucho', 'pintura elastomerica', 'pintura elastomérica', 'pintura impermeabilizante', 'pintura texturizada', 'pintura granulada', 'pintura arena', 'pintura rustica', 'pintura rústica', 'estuco', 'estucado', 'estucar', 'textura pared', 'texturizado', 'grafiado', 'raspado', 'peinado', 'gotelé', 'gotele', 'tirolesa', 'salpicado', 'pintura lisa', 'pintura mate', 'pintura satinada', 'pintura semibrillo', 'pintura brillante', 'pintura alto brillo', 'pintura lavable', 'pintura antibacterial', 'pintura antibacteriana', 'pintura antihongos', 'pintura antimoho', 'pintura blanca', 'pintura color', 'pintura colores', 'mezcla color', 'igualacion color', 'igualación color', 'carta colores', 'catalogo colores', 'catálogo colores', 'muestra color', 'prueba color', 'base blanca', 'base media', 'base profunda', 'tinte pintura', 'colorante pintura', 'pigmento', 'imprimacion', 'imprimación', 'primer', 'fondo', 'aparejo', 'sellador paredes', 'fijador', 'tapaporos', 'masilla', 'pasta muro', 'pasta pared', 'resane', 'resanar', 'tapar grietas', 'tapar huecos', 'tapar fisuras', 'empaste', 'empastar', 'emplastecer', 'enlucir', 'alisar pared', 'preparar pared', 'preparacion superficie', 'preparación superficie', 'lijar pared', 'lijado', 'lija', 'papel lija', 'lija agua', 'lija seco', 'raspar', 'raspado', 'quitar pintura', 'remover pintura', 'decapar', 'decapado', 'decapante', 'removedor pintura', 'solvente', 'thinner', 'aguarras', 'trementina', 'brocha pintura', 'brocha angular', 'brocha plana', 'brocha redonda', 'pincel', 'rodillo pintura', 'rodillo lana', 'rodillo espuma', 'rodillo textura', 'bandeja pintura', 'cubeta pintura', 'balde pintura', 'caneca pintura', 'galon pintura', 'galón pintura', 'cuarto pintura', 'litro pintura', 'spray pintura', 'aerosol pintura', 'pistola pintura', 'compresor pintura', 'soplete', 'airless', 'cinta pintor', 'cinta enmascarar', 'cinta papel', 'masking tape', 'plastico proteccion', 'plástico protección', 'lona', 'carton', 'cartón', 'proteger piso', 'proteger muebles', 'barniz madera', 'barniz transparente', 'barniz brillante', 'barniz mate', 'barniz satinado', 'barnizado', 'barnizar', 'laca madera', 'laca brillante', 'laca mate', 'lacado', 'lacar', 'tinte madera', 'nogalina', 'anilina', 'aceite madera', 'cera madera', 'sellador madera', 'pintor barato', 'pintor economico', 'pintor económico', 'pintor cerca', 'pintor zona', 'pintor rapido', 'pintor rápido', 'pintor confiable', 'presupuesto pintura', 'cotizacion pintura', 'cotización pintura', 'precio pintura', 'costo pintura', 'cuanto cuesta pintar', 'pintura urgente', 'pintura rapida', 'pintura rápida'],

  'limpieza': ['limpiar', 'aseo', 'limpiador', 'desinfeccion', 'desinfección', 'higiene', 'orden', 'organizacion', 'organización', 'trapear', 'barrer', 'aspirar', 'sacudir', 'pulir', 'brillar', 'lavar', 'limpieza del hogar', 'limpieza de casa', 'limpieza de apartamento', 'limpieza profunda', 'limpieza general', 'limpieza a domicilio', 'servicio de limpieza', 'empleada domestica', 'empleada doméstica', 'señora de limpieza', 'señora del aseo', 'muchacha servicio', 'muchacha del servicio', 'domestica', 'doméstica', 'aseadora', 'limpiadora', 'personal limpieza', 'personal aseo', 'empresa limpieza', 'empresa aseo', 'servicio aseo', 'limpieza residencial', 'limpieza comercial', 'limpieza industrial', 'limpieza oficinas', 'limpieza locales', 'limpieza edificios', 'limpieza condominios', 'limpieza apartamentos', 'limpieza casas', 'limpieza hogares', 'limpieza viviendas', 'limpieza departamentos', 'limpieza pisos', 'limpieza consultorios', 'limpieza clinicas', 'limpieza clínicas', 'limpieza hospitales', 'limpieza colegios', 'limpieza escuelas', 'limpieza universidades', 'limpieza hoteles', 'limpieza restaurantes', 'limpieza bares', 'limpieza cafeterias', 'limpieza cafeterías', 'limpieza tiendas', 'limpieza almacenes', 'limpieza bodegas', 'limpieza garajes', 'limpieza parqueaderos', 'limpieza sotanos', 'limpieza sótanos', 'limpieza aticos', 'limpieza áticos', 'limpieza terrazas', 'limpieza balcones', 'limpieza patios', 'limpieza jardines', 'limpieza piscinas', 'limpieza ventanas', 'limpieza vidrios', 'limpieza cristales', 'limpieza espejos', 'limpieza baños', 'limpieza sanitarios', 'limpieza cocinas', 'limpieza habitaciones', 'limpieza cuartos', 'limpieza salas', 'limpieza comedores', 'limpieza escaleras', 'limpieza pasillos', 'limpieza areas comunes', 'limpieza áreas comunes', 'limpieza zonas comunes', 'limpieza espacios comunes', 'limpieza post construccion', 'limpieza post construcción', 'limpieza post obra', 'limpieza despues obra', 'limpieza después obra', 'limpieza fin obra', 'limpieza remodelacion', 'limpieza remodelación', 'limpieza mudanza', 'limpieza pre mudanza', 'limpieza post mudanza', 'limpieza entrega apartamento', 'limpieza entrega casa', 'limpieza entrega inmueble', 'limpieza recibo apartamento', 'limpieza recibo casa', 'limpieza express', 'limpieza rapida', 'limpieza rápida', 'limpieza basica', 'limpieza básica', 'limpieza completa', 'limpieza integral', 'limpieza total', 'limpieza detallada', 'limpieza minuciosa', 'limpieza exhaustiva', 'limpieza profunda tapetes', 'limpieza profunda alfombras', 'limpieza profunda muebles', 'limpieza profunda colchones', 'limpieza profunda cortinas', 'limpieza vapor', 'limpieza a vapor', 'vaporeta', 'vapor limpieza', 'aspiradora', 'aspirado', 'aspirar pisos', 'aspirar alfombras', 'aspirar tapetes', 'aspirar muebles', 'trapear pisos', 'trapeado', 'mopa', 'mopar', 'pasar mopa', 'pasar trapero', 'trapero', 'coleto', 'lampazo', 'barrer piso', 'barrido', 'escoba', 'cepillo', 'recogedor', 'pala basura', 'sacudir polvo', 'quitar polvo', 'desempolvar', 'plumero', 'paño', 'trapo', 'microfibra', 'bayetilla', 'franela', 'limpiar vidrios', 'limpiar ventanas', 'limpiar cristales', 'limpiar espejos', 'lavavidrios', 'limpiavidrios', 'jabon', 'jabón', 'detergente', 'desengrasante', 'desinfectante', 'cloro', 'lejia', 'lejía', 'hipoclorito', 'lavandina', 'blanqueador', 'limpiador multiusos', 'limpiador pisos', 'limpiador baños', 'limpiador cocinas', 'limpiador vidrios', 'limpiador muebles', 'cera pisos', 'cera muebles', 'brillador', 'abrillantador', 'pulidor', 'lustrador', 'ambientador', 'aromatizante', 'desodorante ambiental', 'neutralizador olores', 'quita olores', 'elimina olores', 'limpiar horno', 'limpiar estufa', 'limpiar cocina', 'limpiar nevera', 'limpiar refrigerador', 'limpiar microondas', 'limpiar campana', 'limpiar extractora', 'limpiar baño', 'limpiar sanitario', 'limpiar inodoro', 'limpiar taza', 'limpiar poceta', 'limpiar lavamanos', 'limpiar lavabo', 'limpiar ducha', 'limpiar regadera', 'limpiar tina', 'limpiar bañera', 'limpiar azulejos', 'limpiar baldosas', 'limpiar ceramica', 'limpiar cerámica', 'limpiar porcelanato', 'limpiar marmol', 'limpiar mármol', 'limpiar granito', 'limpiar madera', 'limpiar parquet', 'limpiar laminado', 'limpiar vinilo', 'limpiar alfombra', 'limpiar tapete', 'limpiar muebles', 'limpiar sofa', 'limpiar sofá', 'limpiar sillas', 'limpiar colchon', 'limpiar colchón', 'limpiar cortinas', 'limpiar persianas', 'sacar basura', 'botar basura', 'recoger basura', 'bolsa basura', 'caneca basura', 'bote basura', 'tacho basura', 'papelera', 'basurero', 'limpieza barata', 'limpieza economica', 'limpieza económica', 'limpieza cerca', 'limpieza zona', 'limpieza confiable', 'limpieza profesional', 'limpieza certificada', 'presupuesto limpieza', 'cotizacion limpieza', 'cotización limpieza', 'precio limpieza', 'costo limpieza', 'cuanto cuesta limpieza', 'limpieza urgente', 'limpieza inmediata', 'limpieza hoy', 'limpieza fin semana', 'limpieza sabado', 'limpieza sábado', 'limpieza domingo', 'limpieza festivo', 'limpieza diaria', 'limpieza semanal', 'limpieza quincenal', 'limpieza mensual', 'limpieza periodica', 'limpieza periódica', 'limpieza por horas', 'limpieza medio tiempo', 'limpieza tiempo completo', 'limpieza interna', 'limpieza planta', 'interna', 'empleada interna', 'domestica interna', 'doméstica interna', 'empleada externa', 'domestica externa', 'doméstica externa', 'por dias', 'por días', 'por dia', 'por día'],

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

  // Integrate extended synonyms and regional variations
  const extendedTerms = applyExtendedSynonyms(searchTerm)
  expandedTerms.push(...extendedTerms)

  const searchWords = normalizedTerm.split(' ').filter(w => w.length >= 2)
  expandedTerms.push(...searchWords)

  // Apply extended synonyms to individual words
  for (const word of searchWords) {
    const wordExtensions = applyExtendedSynonyms(word)
    expandedTerms.push(...wordExtensions)
  }

  for (const [key, synonyms] of Object.entries(serviceSynonyms)) {
    const normalizedKey = normalizeSearchTerm(key)

    if (normalizedTerm === normalizedKey) {
      expandedTerms.push(key, ...synonyms)
      continue
    }

    if (normalizedTerm.includes(normalizedKey) ||
        normalizedKey.includes(normalizedTerm)) {
      expandedTerms.push(key, ...synonyms)
      continue
    }

    if (normalizedTerm.length >= 3 && normalizedKey.startsWith(normalizedTerm)) {
      expandedTerms.push(key, ...synonyms)
      continue
    }

    if (normalizedTerm.length >= 3 && normalizedTerm.startsWith(normalizedKey)) {
      expandedTerms.push(key, ...synonyms)
      continue
    }

    for (const word of searchWords) {
      if (word.length < 3) continue
      if (normalizedKey.includes(word) || word.includes(normalizedKey)) {
        expandedTerms.push(key, ...synonyms)
        break
      }
    }

    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeSearchTerm(synonym)

      if (normalizedTerm === normalizedSynonym) {
        expandedTerms.push(key, ...synonyms)
        break
      }

      if (normalizedTerm.includes(normalizedSynonym) ||
          normalizedSynonym.includes(normalizedTerm)) {
        expandedTerms.push(key, ...synonyms)
        break
      }

      if (normalizedTerm.length >= 3 && normalizedSynonym.startsWith(normalizedTerm)) {
        expandedTerms.push(key, ...synonyms)
        break
      }

      if (normalizedTerm.length >= 3 && normalizedTerm.startsWith(normalizedSynonym)) {
        expandedTerms.push(key, ...synonyms)
        break
      }

      for (const word of searchWords) {
        if (word.length < 3) continue
        if (normalizedSynonym.includes(word) || word.includes(normalizedSynonym)) {
          expandedTerms.push(key, ...synonyms)
          break
        }
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

  // Exact and prefix matching with intelligent weights
  if (name === normalizedSearch) score += 200
  else if (name.includes(normalizedSearch)) {
    const position = name.indexOf(normalizedSearch)
    if (position === 0) score += 150
    else score += 100
  }
  else if (normalizedSearch.includes(name)) score += 120
  else if (name.startsWith(normalizedSearch)) score += 140
  else if (name.endsWith(normalizedSearch)) score += 90

  // Word-level matching for multi-word searches
  const searchWords = normalizedSearch.split(' ')
  const nameWords = name.split(' ')
  for (const searchWord of searchWords) {
    if (searchWord.length < 2) continue
    for (const nameWord of nameWords) {
      if (nameWord === searchWord) {
        score += 50
      } else if (nameWord.includes(searchWord) || searchWord.includes(nameWord)) {
        score += 30
      } else if (nameWord.startsWith(searchWord) || searchWord.startsWith(nameWord)) {
        score += 25
      }
    }
  }

  // Description matching with position awareness
  if (description.includes(normalizedSearch)) {
    const position = description.indexOf(normalizedSearch)
    if (position < 50) score += 40
    else score += 25
  }

  for (const searchWord of searchWords) {
    if (searchWord.length < 2) continue
    if (description.includes(searchWord)) score += 15
  }

  // Category matching with context detection
  if (category === normalizedSearch) score += 80
  else if (category.includes(normalizedSearch)) {
    const position = category.indexOf(normalizedSearch)
    if (position === 0) score += 60
    else score += 40
  }
  else if (category.startsWith(normalizedSearch)) score += 70
  else if (normalizedSearch.includes(category)) score += 50

  for (const searchWord of searchWords) {
    if (searchWord.length < 2) continue
    if (category.includes(searchWord)) score += 20
  }

  // Expanded terms matching
  const expandedTerms = expandSearchTerms(normalizedSearch)
  const uniqueExpandedTerms = Array.from(new Set(expandedTerms.map(t => normalizeSearchTerm(t))))

  for (const term of uniqueExpandedTerms) {
    if (term.length < 2) continue
    if (name.includes(term)) score += 18
    if (description.includes(term)) score += 10
    if (category.includes(term)) score += 15
  }

  // Popularity and engagement boost
  if (service.popular) score += 30

  if (service._count?.partners > 0) {
    score += Math.min(service._count.partners * 2, 20)
  }

  // Length similarity bonus
  const searchLength = normalizedSearch.length
  const nameLength = name.length
  const lengthDiff = Math.abs(searchLength - nameLength)
  if (lengthDiff < 3) score += 20
  else if (lengthDiff < 5) score += 10

  return score
}

function calculatePartialMatchScore(service: any, normalizedSearch: string, searchWords: string[]): number {
  let score = 0
  const name = normalizeSearchTerm(service.name)
  const category = normalizeSearchTerm(service.category.name)
  const description = normalizeSearchTerm(service.description)

  // Word-level partial matching
  for (const word of searchWords) {
    if (word.length < 2) continue

    if (name.includes(word)) score += 15
    if (category.includes(word)) score += 12
    if (description.includes(word)) score += 8

    if (name.startsWith(word)) score += 10
    if (category.startsWith(word)) score += 8
  }

  // Prefix matching for improved partial search
  if (normalizedSearch.length >= 3) {
    const prefix = normalizedSearch.substring(0, 3)
    if (name.includes(prefix)) score += 10
    if (category.includes(prefix)) score += 8
  }

  return score
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
      // Prioritize popular services
      if (a.popular && !b.popular) return -1
      if (!a.popular && b.popular) return 1

      // Sort by partner count
      const aPartners = a._count?.partners || 0
      const bPartners = b._count?.partners || 0
      if (aPartners !== bPartners) return bPartners - aPartners

      // Alphabetical fallback
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

  // Filter services based on multiple criteria
  const filteredServices = services.filter(service => {
    const name = normalizeSearchTerm(service.name)
    const description = normalizeSearchTerm(service.description)
    const categoryName = normalizeSearchTerm(service.category.name)

    // Exact and substring matching
    if (name.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        categoryName.includes(normalizedSearch)) {
      return true
    }

    // Prefix matching for better partial search
    if (normalizedSearch.length >= 3) {
      if (name.startsWith(normalizedSearch) ||
          categoryName.startsWith(normalizedSearch)) {
        return true
      }
    }

    // Word-level matching
    for (const word of searchWords) {
      if (word.length < 2) continue
      if (name.includes(word) || categoryName.includes(word)) {
        return true
      }
    }

    // Expanded terms matching
    return expandedTerms.some(term => {
      const normalizedTerm = normalizeSearchTerm(term)
      if (normalizedTerm.length < 2) return false
      return name.includes(normalizedTerm) ||
             description.includes(normalizedTerm) ||
             categoryName.includes(normalizedTerm)
    })
  })

  // Calculate relevance scores
  const servicesWithScore = filteredServices.map(service => ({
    ...service,
    relevanceScore: calculateRelevanceScore(service, searchTerm)
  }))

  // Sort by relevance
  const sortedServices = servicesWithScore
    .sort((a, b) => b.relevanceScore - a.relevanceScore)

  const topMatch = sortedServices.length > 0 ? sortedServices[0] : null

  // Get related services by category
  const relatedByCategory = topMatch
    ? getRelatedServicesByCategory(topMatch, services, 6)
    : []

  // Remove relevance score from results
  const results = sortedServices.map(({ relevanceScore, ...service }) => service)

  return {
    results,
    relatedByCategory,
    topMatch: topMatch ? { ...topMatch, relevanceScore: undefined } : null
  }
}

export const extendedSynonyms: Record<string, string[]> = {
  'agua': ['h2o', 'liquido', 'líquido', 'hidrico', 'hídrico', 'acuatico', 'acuático', 'hidratacion', 'hidratación'],
  'reparar': ['arreglar', 'componer', 'remendar', 'restaurar', 'solucionar', 'resolver', 'corregir', 'enmendar', 'subsanar', 'remediar'],
  'instalar': ['colocar', 'poner', 'montar', 'fijar', 'establecer', 'implementar', 'ubicar', 'situar', 'emplazar'],
  'cambiar': ['reemplazar', 'sustituir', 'renovar', 'mudar', 'trocar', 'permutar', 'intercambiar', 'variar'],
  'limpiar': ['asear', 'higienizar', 'desinfectar', 'purificar', 'sanear', 'lavar', 'fregar', 'baldear'],
  'urgente': ['emergencia', 'inmediato', 'rapido', 'rápido', 'ya', 'ahora', 'pronto', 'express', 'prioritario'],
  'barato': ['economico', 'económico', 'accesible', 'bajo costo', 'precio justo', 'oferta', 'promocion', 'promoción', 'descuento'],
  'profesional': ['experto', 'especialista', 'tecnico', 'técnico', 'maestro', 'oficial', 'calificado', 'certificado', 'capacitado'],
  'casa': ['hogar', 'vivienda', 'residencia', 'domicilio', 'inmueble', 'propiedad', 'habitacion', 'habitación'],
  'problema': ['falla', 'daño', 'averia', 'avería', 'desperfecto', 'defecto', 'inconveniente', 'dificultad'],
}

export const regionalVariations: Record<string, string[]> = {
  'plomero': ['gasfitero', 'fontanero', 'cañero', 'tubero', 'sanitarista'],
  'grifo': ['llave', 'canilla', 'pila', 'chorro'],
  'inodoro': ['sanitario', 'poceta', 'taza', 'wc', 'water', 'retrete', 'excusado'],
  'ducha': ['regadera', 'chuveiro', 'shower'],
  'bombillo': ['foco', 'ampolleta', 'lamparita', 'bujia', 'bujía'],
  'enchufe': ['toma', 'tomacorriente', 'contacto', 'conector'],
  'interruptor': ['switch', 'apagador', 'llave luz'],
  'pasto': ['cesped', 'césped', 'grama', 'zacate', 'hierba', 'prado'],
  'apartamento': ['departamento', 'piso', 'flat'],
  'carro': ['auto', 'coche', 'vehiculo', 'vehículo', 'automovil', 'automóvil'],
}

export const contextualPhrases: Record<string, string[]> = {
  'no funciona': ['no sirve', 'no anda', 'no va', 'esta dañado', 'está dañado', 'esta malo', 'está malo', 'se daño', 'se dañó', 'se rompio', 'se rompió', 'no prende', 'no enciende', 'no arranca'],
  'se rompio': ['se quebro', 'se quebró', 'se partio', 'se partió', 'se daño', 'se dañó', 'se averio', 'se averió'],
  'necesito': ['busco', 'requiero', 'preciso', 'solicito', 'quiero', 'me hace falta', 'me urge'],
  'cerca de mi': ['cerca', 'cercano', 'proximo', 'próximo', 'en mi zona', 'por aqui', 'por aquí', 'por aca', 'por acá'],
  'a domicilio': ['en casa', 'en mi casa', 'que venga', 'que vaya', 'servicio casa', 'servicio hogar'],
  'cuanto cuesta': ['precio', 'costo', 'valor', 'tarifa', 'cuanto cobra', 'cuánto cobra', 'cuanto sale', 'cuánto sale'],
}

export function applyExtendedSynonyms(term: string): string[] {
  const normalized = normalizeSearchTerm(term)
  const results = [term, normalized]

  for (const [key, synonyms] of Object.entries(extendedSynonyms)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      results.push(...synonyms)
    }
  }

  for (const [key, variations] of Object.entries(regionalVariations)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      results.push(...variations)
    }
  }

  for (const [phrase, alternatives] of Object.entries(contextualPhrases)) {
    if (normalized.includes(phrase)) {
      results.push(...alternatives)
    }
  }

  return Array.from(new Set(results))
}

export function getSuggestions(searchTerm: string, allServices: any[]): {
  didYouMean: string[]
  popularServices: any[]
  similarServices: any[]
} {
  // Find similar terms with increased distance tolerance
  const similarTerms = findSimilarTerms(searchTerm, 3)

  // Get popular services
  const popularServices = allServices
    .filter(s => s.popular)
    .slice(0, 8)

  // Get similar services using enhanced partial matching
  const normalizedSearch = normalizeSearchTerm(searchTerm)
  const searchWords = normalizedSearch.split(' ').filter(w => w.length >= 2)

  const similarServices = allServices
    .map(service => ({
      service,
      score: calculatePartialMatchScore(service, normalizedSearch, searchWords)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(item => item.service)

  return {
    didYouMean: similarTerms,
    popularServices,
    similarServices
  }
}

# Sistema de Búsqueda Mejorado - Haggo

## Mejoras Implementadas

### 1. Sinónimos Expandidos Masivamente (x10+)

Se han agregado múltiples capas de sinónimos para mejorar los resultados:

#### a) Sinónimos Extendidos Generales
- **Acciones comunes**: reparar, instalar, cambiar, limpiar, etc.
- **Calificadores**: urgente, barato, profesional, cerca, etc.
- **Contextos**: casa, problema, servicio, etc.

#### b) Variaciones Regionales
- Términos específicos por país/región (ej: plomero/gasfitero/fontanero)
- Variaciones de objetos (grifo/llave/canilla)
- Diferencias dialectales (carro/auto/coche)

#### c) Frases Contextuales
- "no funciona" → "no sirve", "está dañado", "se rompió"
- "necesito" → "busco", "requiero", "me urge"
- "a domicilio" → "en casa", "que venga"
- "cuánto cuesta" → "precio", "tarifa", "valor"

### 2. Algoritmo de Scoring Inteligente

El nuevo sistema de puntuación considera:

#### Coincidencias Exactas (200 puntos)
- Nombre del servicio coincide exactamente con la búsqueda

#### Coincidencias Parciales Ponderadas
- **Inicio del nombre** (150 pts): Mayor relevancia si coincide al principio
- **Contiene en nombre** (100 pts): Coincidencia en cualquier parte
- **Fin del nombre** (90 pts): Coincidencia al final
- **Búsqueda contiene nombre** (120 pts): Búsqueda más amplia que el nombre

#### Análisis por Palabras
- Coincidencia exacta de palabras individuales (50 pts c/u)
- Coincidencia parcial de palabras (30 pts c/u)
- Coincidencia de inicio de palabras (25 pts c/u)

#### Descripción del Servicio
- Coincidencia en primeros 50 caracteres (40 pts)
- Coincidencia en resto de descripción (25 pts)
- Palabras individuales en descripción (15 pts c/u)

#### Categoría
- Coincidencia exacta (80 pts)
- Coincidencia al inicio (60 pts)
- Contiene búsqueda (40 pts)
- Palabras individuales (20 pts c/u)

#### Factores Adicionales
- **Servicio popular** (+30 pts)
- **Número de partners** (+2 pts por partner, máx 20)
- **Similitud de longitud** (+20 pts si muy similar, +10 si similar)

### 3. Búsqueda por Palabras Parciales

- Divide la búsqueda en palabras individuales
- Busca cada palabra por separado
- Combina resultados de forma inteligente
- Ignora palabras muy cortas (< 2 caracteres)

### 4. Fuzzy Matching Mejorado

- Distancia de Levenshtein con umbral configurable
- Sugerencias de "¿Quisiste decir...?"
- Tolerancia a errores tipográficos
- Corrección automática de errores comunes

### 5. Resultados Relacionados por Categoría

Cuando se encuentra un resultado principal:
- Se muestran hasta 6 servicios de la misma categoría
- Ordenados por popularidad y número de partners
- Excluye el servicio principal para evitar duplicados
- Ayuda al usuario a descubrir servicios relacionados

### 6. Sistema de Sugerencias Mejorado

Cuando no hay resultados:
- **¿Quisiste decir...?**: Términos similares con fuzzy matching
- **Servicios populares**: Top 8 servicios más solicitados
- **Servicios similares**: Basados en coincidencias parciales (hasta 8)

## Estructura de Respuesta del API

```typescript
{
  services: Service[],           // Resultados principales ordenados por relevancia
  relatedByCategory: Service[],  // Servicios de la misma categoría del top match
  topMatch: Service | null,      // El mejor resultado encontrado
  suggestions: {                 // Solo si no hay resultados
    didYouMean: string[],
    popularServices: Service[],
    similarServices: Service[]
  } | null
}
```

## Ejemplos de Mejoras

### Antes
- Búsqueda: "gasfitero" → Sin resultados (solo reconocía "plomero")
- Búsqueda: "se rompio la llave" → Sin resultados
- Búsqueda: "necesito electricista urgente" → Resultados básicos

### Ahora
- Búsqueda: "gasfitero" → Encuentra "Plomero" + servicios relacionados
- Búsqueda: "se rompio la llave" → Encuentra "Plomero" (reconoce "rompió" y "llave")
- Búsqueda: "necesito electricista urgente" → Prioriza electricistas + marca urgencia
- Búsqueda: "arreglar inodoro" → Encuentra "Plomero" + muestra otros servicios de plomería
- Búsqueda: "cambio bombillo" → Encuentra "Electricista" (reconoce variaciones regionales)

## Ventajas del Nuevo Sistema

1. **Mayor cobertura**: Reconoce 10x más términos y variaciones
2. **Mejor precisión**: Scoring inteligente prioriza resultados más relevantes
3. **Contexto regional**: Entiende términos de diferentes países hispanohablantes
4. **Tolerancia a errores**: Fuzzy matching y corrección automática
5. **Descubrimiento**: Muestra servicios relacionados de la misma categoría
6. **Experiencia mejorada**: Siempre muestra algo útil, incluso sin coincidencias exactas
7. **Búsqueda natural**: Entiende frases completas y contexto
8. **Aprendizaje continuo**: Fácil agregar nuevos sinónimos y variaciones

## Mantenimiento

Para agregar nuevos sinónimos:

1. **Sinónimos de servicio**: Editar `serviceSynonyms` en `lib/searchSynonyms.ts`
2. **Sinónimos generales**: Editar `extendedSynonyms`
3. **Variaciones regionales**: Editar `regionalVariations`
4. **Frases contextuales**: Editar `contextualPhrases`
5. **Errores comunes**: Editar `commonTypos`

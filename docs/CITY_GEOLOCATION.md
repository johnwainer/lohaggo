# Sistema de Geolocalización y Selección de Ciudad

## Funcionalidades Implementadas

### 1. **Geolocalización Automática**
- Al cargar la aplicación por primera vez, el sistema intenta detectar automáticamente la ciudad del usuario basándose en su ubicación GPS
- Utiliza la API de Geolocation del navegador
- Calcula la distancia entre la ubicación del usuario y las ciudades disponibles
- Selecciona automáticamente la ciudad más cercana (dentro de un radio de 100km)
- Si la geolocalización falla o es denegada, muestra un modal para selección manual

### 2. **Modal de Selección de Ciudad**
- Se muestra automáticamente cuando:
  - La geolocalización falla o es denegada
  - No hay ciudad guardada en localStorage
  - El usuario no está cerca de ninguna ciudad activa
- Permite seleccionar entre ciudades activas
- Muestra ciudades "próximamente" sin permitir seleccionarlas
- No muestra ciudades inactivas
- Incluye botón para intentar geolocalización nuevamente

### 3. **Selector de Ciudad en Navbar**
- Dropdown mejorado con:
  - Ciudades activas (seleccionables)
  - Ciudades próximamente (no seleccionables, con etiqueta "Pronto")
  - Botón para abrir modal completo
- Muestra estado de "Detectando..." durante geolocalización
- Persiste la selección en localStorage

### 4. **Persistencia de Selección**
- La ciudad seleccionada se guarda en localStorage
- Se restaura automáticamente en visitas posteriores
- Solo se intenta geolocalización si no hay ciudad guardada

### 5. **Validación de Socios por Ciudad**
- Los socios se filtran automáticamente según la ciudad seleccionada
- Solo se muestran servicios disponibles en la ciudad activa
- Las direcciones se validan contra la ciudad seleccionada

## Estructura de Datos

### CityConfig Model
```prisma
model CityConfig {
  id        String     @id @default(cuid())
  name      String     @unique
  slug      String     @unique
  status    CityStatus @default(ACTIVE)
  order     Int        @default(0)
  latitude  Float?     // Coordenadas para geolocalización
  longitude Float?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum CityStatus {
  ACTIVE       // Ciudad operativa
  INACTIVE     // Ciudad no disponible (no se muestra)
  COMING_SOON  // Ciudad próximamente (se muestra pero no seleccionable)
}
```

## Coordenadas de Ciudades

| Ciudad | Latitud | Longitud |
|--------|---------|----------|
| Medellín | 6.2442 | -75.5812 |
| Bogotá | 4.7110 | -74.0721 |
| Cali | 3.4516 | -76.5320 |
| Barranquilla | 10.9685 | -74.7813 |

## Componentes

### 1. `CityContext` (`lib/city-context.tsx`)
- Maneja el estado global de ciudades
- Implementa lógica de geolocalización
- Proporciona funciones helper:
  - `getActiveCities()`: Retorna solo ciudades activas
  - `getCityBySlug(slug)`: Busca ciudad por slug
  - `geolocateCity()`: Intenta geolocalización manual
  - `setSelectedCity(slug)`: Cambia ciudad seleccionada

### 2. `CityModal` (`components/CityModal.tsx`)
- Modal de selección de ciudad
- Botón de geolocalización
- Lista de ciudades activas y próximamente
- Diseño responsive y accesible

### 3. `CitySelector` (en `components/Navbar.tsx`)
- Dropdown en navbar
- Muestra ciudad actual
- Permite cambio rápido de ciudad
- Enlace a modal completo

## API Endpoints

### GET `/api/cities`
Retorna todas las ciudades con sus coordenadas:
```json
[
  {
    "id": "...",
    "name": "Medellín",
    "slug": "medellin",
    "status": "ACTIVE",
    "order": 1,
    "latitude": 6.2442,
    "longitude": -75.5812
  }
]
```

## Scripts de Mantenimiento

### Actualizar Coordenadas
```bash
npx tsx scripts/update-city-coordinates.ts
```

Este script:
- Crea o actualiza ciudades en la base de datos
- Asigna coordenadas geográficas
- Configura el estado y orden de cada ciudad

## Flujo de Usuario

1. **Primera Visita**
   - Sistema intenta geolocalización automática
   - Si tiene éxito y está cerca de una ciudad activa → selecciona automáticamente
   - Si falla o no está cerca → muestra modal de selección

2. **Visitas Posteriores**
   - Restaura ciudad desde localStorage
   - No intenta geolocalización nuevamente
   - Usuario puede cambiar manualmente desde navbar

3. **Cambio Manual**
   - Click en selector de navbar → dropdown rápido
   - Click en "Ver todas las opciones" → modal completo
   - Click en botón de geolocalización → intenta detectar ubicación

## Consideraciones de Seguridad

- La geolocalización requiere permiso explícito del usuario
- Solo funciona en contextos seguros (HTTPS)
- Timeout de 5 segundos para evitar bloqueos
- Fallback a selección manual si falla

## Mejoras Futuras

- [ ] Agregar más ciudades con sus coordenadas
- [ ] Implementar caché de geolocalización
- [ ] Agregar animaciones de transición
- [ ] Soporte para múltiples idiomas
- [ ] Analytics de ciudades más seleccionadas
- [ ] Sugerencias basadas en IP como fallback

import {
  Home, Sparkles, Wrench, Star, Heart, Cpu, Truck, GraduationCap,
  PartyPopper, PawPrint, Car, Briefcase,
  Droplets, Zap, Building2, Hammer, Paintbrush, Leaf, Bug, Layers, Wind,
  Plug, KeyRound, Flame, LayoutGrid, Scissors, Activity, Dumbbell,
  Laptop, Smartphone, Settings, Monitor, Wifi, Package, Send,
  Globe, Music, UtensilsCrossed, Camera, Music2, Scale, CloudRain,
  DoorOpen, Waves, WashingMachine, SlidersHorizontal, PersonStanding,
  Stethoscope, Apple, Salad, Shirt, MapPin, Plus, Grid3X3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type IconTheme = 'emoji' | 'moderno' | 'minimal' | 'vivo'

export type IconConfig = {
  icon: LucideIcon
  color: string   // tailwind color name e.g. 'blue', 'green'
  emoji: string
}

const I = (icon: LucideIcon, color: string, emoji: string): IconConfig => ({ icon, color, emoji })

export const SERVICE_ICONS: Record<string, IconConfig> = {
  // Hogar
  'plomeria':                   I(Droplets,       'blue',   '🚰'),
  'electricidad':               I(Zap,            'yellow', '⚡'),
  'carpinteria':                I(Hammer,         'orange', '🪚'),
  'pintura':                    I(Paintbrush,     'violet', '🎨'),
  'jardineria':                 I(Leaf,           'green',  '🌱'),
  'fumigacion':                 I(Bug,            'red',    '🦟'),
  'instalacion-muebles':        I(LayoutGrid,     'amber',  '🛋️'),
  'costura':                    I(Shirt,          'pink',   '🧵'),
  'impermeabilizacion':         I(CloudRain,      'sky',    '☔'),
  'instalacion-cortinas':       I(LayoutGrid,     'purple', '🪟'),
  'pulido-pisos':               I(Sparkles,       'amber',  '✨'),
  'reparacion-techos':          I(Home,           'slate',  '🏠'),
  'instalacion-cielo-raso':     I(Layers,         'gray',   '🔨'),
  'herreria':                   I(Wrench,         'slate',  '🔩'),
  'instalacion-enchapes':       I(Grid3X3,        'amber',  '🧱'),
  'reparacion-puertas':         I(DoorOpen,       'blue',   '🚪'),
  'instalacion-riego':          I(Droplets,       'green',  '💧'),
  'mantenimiento-piscinas':     I(Waves,          'cyan',   '🏊'),

  // Limpieza
  'limpieza-hogar':             I(Sparkles,       'sky',    '🧹'),
  'limpieza-oficinas':          I(Building2,      'slate',  '🏢'),
  'lavado-alfombras':           I(WashingMachine, 'teal',   '🧼'),
  'limpieza-ventanas':          I(Wind,           'sky',    '🪟'),

  // Reparaciones
  'reparacion-electrodomesticos': I(Plug,         'purple', '🔌'),
  'cerrajeria':                 I(KeyRound,       'amber',  '🔑'),
  'reparacion-aires':           I(Wind,           'blue',   '❄️'),
  'reparacion-calentadores':    I(Flame,          'orange', '🔥'),

  // Belleza
  'peluqueria':                 I(Scissors,       'pink',   '💇'),
  'manicure-pedicure':          I(Star,           'rose',   '💅'),
  'masajes':                    I(Heart,          'red',    '💆'),
  'maquillaje':                 I(Paintbrush,     'pink',   '💄'),
  'barberia':                   I(Scissors,       'slate',  '✂️'),

  // Salud
  'enfermeria':                 I(Plus,           'red',    '💉'),
  'fisioterapia':               I(Activity,       'blue',   '🏥'),
  'nutricion':                  I(Salad,          'green',  '🥗'),
  'entrenador-personal':        I(Dumbbell,       'orange', '💪'),
  'yoga':                       I(PersonStanding, 'teal',   '🧘'),

  // Tecnología
  'reparacion-computadoras':    I(Laptop,         'blue',   '💻'),
  'reparacion-celulares':       I(Smartphone,     'indigo', '📱'),
  'instalacion-software':       I(Settings,       'gray',   '⚙️'),
  'soporte-tecnico':            I(Monitor,        'blue',   '🖥️'),
  'instalacion-redes':          I(Wifi,           'purple', '📡'),

  // Transporte
  'mudanzas':                   I(Package,        'amber',  '📦'),
  'transporte-carga':           I(Truck,          'orange', '🚚'),
  'mensajeria':                 I(Send,           'blue',   '📮'),
  'lavado-autos':               I(Car,            'sky',    '🚗'),

  // Educación
  'clases-particulares':        I(GraduationCap,  'blue',   '👨‍🏫'),
  'clases-idiomas':             I(Globe,          'green',  '🗣️'),
  'clases-musica':              I(Music,          'purple', '🎸'),
  'clases-cocina':              I(UtensilsCrossed,'orange', '👨‍🍳'),

  // Eventos
  'catering':                   I(UtensilsCrossed,'red',    '🍽️'),
  'fotografia':                 I(Camera,         'indigo', '📷'),
  'dj':                         I(Music2,         'purple', '🎧'),
  'decoracion-eventos':         I(Sparkles,       'pink',   '🎈'),
  'animacion-infantil':         I(Star,           'yellow', '🤡'),

  // Mascotas
  'veterinaria':                I(Heart,          'red',    '🐾'),
  'peluqueria-canina':          I(Scissors,       'amber',  '🐕'),
  'paseo-perros':               I(MapPin,         'green',  '🦮'),
  'entrenamiento-canino':       I(Star,           'orange', '🎾'),
  'cuidado-mascotas':           I(Home,           'blue',   '🏠'),

  // Profesional
  'asesoria-legal':             I(Scale,          'slate',  '⚖️'),
}

export const CATEGORY_ICONS: Record<string, IconConfig> = {
  'hogar':        I(Home,           'blue',   '🏠'),
  'limpieza':     I(Sparkles,       'sky',    '🧹'),
  'reparaciones': I(Wrench,         'orange', '🔧'),
  'belleza':      I(Star,           'pink',   '💅'),
  'salud':        I(Heart,          'red',    '⚕️'),
  'tecnologia':   I(Cpu,            'indigo', '💻'),
  'transporte':   I(Truck,          'amber',  '🚗'),
  'educacion':    I(GraduationCap,  'blue',   '📚'),
  'eventos':      I(PartyPopper,    'purple', '🎉'),
  'mascotas':     I(PawPrint,       'orange', '🐕'),
  'automotriz':   I(Car,            'slate',  '🚙'),
  'profesional':  I(Briefcase,      'gray',   '💼'),
}

// Tailwind bg/text color pairs per color name
// gradient uses hex so it works as inline style (avoids Tailwind purge of dynamic classes)
export const COLOR_CLASSES: Record<string, { bg: string; text: string; bgLight: string; gradientFrom: string; gradientTo: string }> = {
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-600',   bgLight: 'bg-blue-50',   gradientFrom: '#60a5fa', gradientTo: '#1d4ed8' },
  sky:    { bg: 'bg-sky-500',    text: 'text-sky-600',    bgLight: 'bg-sky-50',    gradientFrom: '#38bdf8', gradientTo: '#0284c7' },
  green:  { bg: 'bg-green-500',  text: 'text-green-600',  bgLight: 'bg-green-50',  gradientFrom: '#4ade80', gradientTo: '#059669' },
  teal:   { bg: 'bg-teal-500',   text: 'text-teal-600',   bgLight: 'bg-teal-50',   gradientFrom: '#2dd4bf', gradientTo: '#0f766e' },
  cyan:   { bg: 'bg-cyan-500',   text: 'text-cyan-600',   bgLight: 'bg-cyan-50',   gradientFrom: '#22d3ee', gradientTo: '#0369a1' },
  yellow: { bg: 'bg-yellow-400', text: 'text-yellow-500', bgLight: 'bg-yellow-50', gradientFrom: '#fde047', gradientTo: '#d97706' },
  amber:  { bg: 'bg-amber-500',  text: 'text-amber-600',  bgLight: 'bg-amber-50',  gradientFrom: '#fbbf24', gradientTo: '#c2410c' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50', gradientFrom: '#fb923c', gradientTo: '#b91c1c' },
  red:    { bg: 'bg-red-500',    text: 'text-red-600',    bgLight: 'bg-red-50',    gradientFrom: '#f87171', gradientTo: '#be123c' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-600',   bgLight: 'bg-rose-50',   gradientFrom: '#fb7185', gradientTo: '#9d174d' },
  pink:   { bg: 'bg-pink-500',   text: 'text-pink-600',   bgLight: 'bg-pink-50',   gradientFrom: '#f472b6', gradientTo: '#be185d' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-600', bgLight: 'bg-violet-50', gradientFrom: '#a78bfa', gradientTo: '#6d28d9' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50', gradientFrom: '#c084fc', gradientTo: '#4338ca' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', bgLight: 'bg-indigo-50', gradientFrom: '#818cf8', gradientTo: '#1d4ed8' },
  slate:  { bg: 'bg-slate-500',  text: 'text-slate-600',  bgLight: 'bg-slate-50',  gradientFrom: '#94a3b8', gradientTo: '#334155' },
  gray:   { bg: 'bg-gray-500',   text: 'text-gray-600',   bgLight: 'bg-gray-50',   gradientFrom: '#9ca3af', gradientTo: '#374151' },
}

export const DEFAULT_ICON: IconConfig = I(Wrench, 'gray', '🔧')
export const DEFAULT_CATEGORY_ICON: IconConfig = I(LayoutGrid, 'gray', '🏷️')

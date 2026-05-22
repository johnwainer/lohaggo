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

export type IconTheme = 'emoji' | 'moderno' | 'minimal' | 'rappi'

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
export const COLOR_CLASSES: Record<string, { bg: string; text: string; bgLight: string; gradient: string }> = {
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-600',   bgLight: 'bg-blue-50',   gradient: 'from-blue-400 to-blue-600' },
  sky:    { bg: 'bg-sky-500',    text: 'text-sky-600',    bgLight: 'bg-sky-50',    gradient: 'from-sky-400 to-cyan-500' },
  green:  { bg: 'bg-green-500',  text: 'text-green-600',  bgLight: 'bg-green-50',  gradient: 'from-green-400 to-emerald-600' },
  teal:   { bg: 'bg-teal-500',   text: 'text-teal-600',   bgLight: 'bg-teal-50',   gradient: 'from-teal-400 to-teal-600' },
  cyan:   { bg: 'bg-cyan-500',   text: 'text-cyan-600',   bgLight: 'bg-cyan-50',   gradient: 'from-cyan-400 to-blue-500' },
  yellow: { bg: 'bg-yellow-400', text: 'text-yellow-500', bgLight: 'bg-yellow-50', gradient: 'from-yellow-300 to-amber-500' },
  amber:  { bg: 'bg-amber-500',  text: 'text-amber-600',  bgLight: 'bg-amber-50',  gradient: 'from-amber-400 to-orange-500' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50', gradient: 'from-orange-400 to-red-500' },
  red:    { bg: 'bg-red-500',    text: 'text-red-600',    bgLight: 'bg-red-50',    gradient: 'from-red-400 to-rose-600' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-600',   bgLight: 'bg-rose-50',   gradient: 'from-rose-400 to-pink-600' },
  pink:   { bg: 'bg-pink-500',   text: 'text-pink-600',   bgLight: 'bg-pink-50',   gradient: 'from-pink-400 to-rose-500' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-600', bgLight: 'bg-violet-50', gradient: 'from-violet-400 to-purple-600' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50', gradient: 'from-purple-400 to-indigo-600' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', bgLight: 'bg-indigo-50', gradient: 'from-indigo-400 to-blue-600' },
  slate:  { bg: 'bg-slate-500',  text: 'text-slate-600',  bgLight: 'bg-slate-50',  gradient: 'from-slate-400 to-gray-600' },
  gray:   { bg: 'bg-gray-500',   text: 'text-gray-600',   bgLight: 'bg-gray-50',   gradient: 'from-gray-400 to-slate-600' },
}

export const DEFAULT_ICON: IconConfig = I(Wrench, 'gray', '🔧')
export const DEFAULT_CATEGORY_ICON: IconConfig = I(LayoutGrid, 'gray', '🏷️')

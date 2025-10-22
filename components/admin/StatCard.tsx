import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'teal' | 'pink' | 'indigo'
}

const colorClasses = {
  blue: 'from-[#FF2D55] to-[#FF6900]',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  yellow: 'from-yellow-500 to-yellow-600',
  red: 'from-[#FF2D55] to-[#FF3D00]',
  teal: 'from-teal-500 to-teal-600',
  pink: 'from-pink-500 to-pink-600',
  indigo: 'from-[#FF3D00] to-[#FF6900]',
}

export default function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} text-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <p className="text-white/80 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="bg-white/20 p-3 rounded-lg">
          <Icon size={28} />
        </div>
      </div>

      {trend && (
        <div className="flex items-center text-sm">
          <span className={`font-semibold ${trend.isPositive ? 'text-green-200' : 'text-red-200'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-white/70 ml-2">vs mes anterior</span>
        </div>
      )}
    </div>
  )
}

'use client'

import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ChartCardProps {
  title: string
  type: 'line' | 'bar' | 'doughnut'
  data: any
  options?: any
}

export default function ChartCard({ title, type, data, options }: ChartCardProps) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
    },
    ...options
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <div className="h-[300px]">
        {type === 'line' && <Line data={data} options={defaultOptions} />}
        {type === 'bar' && <Bar data={data} options={defaultOptions} />}
        {type === 'doughnut' && <Doughnut data={data} options={defaultOptions} />}
      </div>
    </div>
  )
}

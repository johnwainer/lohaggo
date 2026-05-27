'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Award, Trophy, Star, Shield, CheckCircle, Clock, Target, Medal
} from 'lucide-react'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'

interface Achievement {
  id: string
  type: string
  name: string
  description: string
  icon: string
  unlocked?: boolean
  unlockedAt?: string | null
}

const ACHIEVEMENT_ICONS: Record<string, any> = {
  FIRST_DOCUMENT: Award,
  IDENTITY_VERIFIED: Shield,
  EDUCATION_VERIFIED: Trophy,
  BACKGROUND_CHECK: CheckCircle,
  PROFILE_COMPLETE: Star,
  FIRST_SERVICE: Target,
  VERIFIED_PARTNER: Medal
}

const ACHIEVEMENT_COLORS: Record<string, string> = {
  FIRST_DOCUMENT: 'bg-blue-100 text-blue-600',
  IDENTITY_VERIFIED: 'bg-green-100 text-green-600',
  EDUCATION_VERIFIED: 'bg-purple-100 text-purple-600',
  BACKGROUND_CHECK: 'bg-yellow-100 text-yellow-600',
  PROFILE_COMPLETE: 'bg-pink-100 text-pink-600',
  FIRST_SERVICE: 'bg-indigo-100 text-indigo-600',
  VERIFIED_PARTNER: 'bg-red-100 text-red-600'
}

export default function PartnerAchievementsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchAchievements()
  }, [])

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/partner/achievements')
      if (res.ok) {
        const data = await res.json()
        setAchievements(data)
      }
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando logros...</p>
        </div>
      </div>
    )
  }

  const unlockedAchievements = achievements.filter(a => a.unlocked && a.unlockedAt)

  return (
    <div className="account-shell">
      <AccountTopHeader
        role="PARTNER"
        title="Mis Logros"
        subtitle={`Has desbloqueado ${unlockedAchievements.length} logro${unlockedAchievements.length !== 1 ? 's' : ''}`}
      />

      <main className="account-main">

        {unlockedAchievements.length === 0 ? (
          <AccountPanel className="text-center py-8">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Aún no tienes logros
            </h2>
            <p className="text-gray-600">
              Completa tu perfil y verifica tus documentos para desbloquear logros
            </p>
          </AccountPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unlockedAchievements.map((achievement) => {
              const Icon = ACHIEVEMENT_ICONS[achievement.type] || Award
              const colorClass = ACHIEVEMENT_COLORS[achievement.type] || 'bg-gray-100 text-gray-600'

              return (
                <div
                  key={achievement.id}
                  className="surface-card p-6 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-shadow"
                >
                  <div className={`w-16 h-16 rounded-full ${colorClass} flex items-center justify-center mb-4`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {achievement.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {achievement.description}
                  </p>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    Desbloqueado el {new Date(achievement.unlockedAt!).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

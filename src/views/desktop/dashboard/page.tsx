'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History, GraduationCap, Calendar } from 'lucide-react'

interface Stats {
  totalDepts: number
  totalChanges: number
  currentYear: number
}

export function DesktopDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [yearsRes, deptsRes, logsRes] = await Promise.all([
          fetch('/api/years'),
          fetch('/api/departments?year=2026'),
          fetch('/api/change-logs?limit=1'),
        ])
        
        const years = await yearsRes.json()
        const depts = await deptsRes.json()
        const logs = await logsRes.json()
        
        const activeYear = years.years?.find((y: { is_active: boolean }) => y.is_active)
        
        setStats({
          currentYear: activeYear?.year_id || 2026,
          totalDepts: depts.count || 0,
          totalChanges: logs.pagination?.total || 0,
        })
      } catch {
        setStats({ currentYear: 2026, totalDepts: 0, totalChanges: 0 })
      } finally {
        setLoading(false)
      }
    }
    
    fetchStats()
  }, [])

  const cards = [
    { title: '현재 학년도', value: stats?.currentYear || '-', icon: Calendar, suffix: '학년도' },
    { title: '등록 학과', value: stats?.totalDepts || '-', icon: GraduationCap, suffix: '개' },
    { title: '변경 이력', value: stats?.totalChanges || '-', icon: History, suffix: '건' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드 (Desktop)</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : `${card.value}${card.suffix}`}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

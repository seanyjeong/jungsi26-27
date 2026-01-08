'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History, GraduationCap, Calendar, Tablet } from 'lucide-react'

interface Stats {
  totalDepts: number
  totalChanges: number
  currentYear: number
}

export function TabletDashboardPage() {
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
    { title: '현재 학년도', value: stats?.currentYear || '-', icon: Calendar, suffix: '학년도', color: 'text-blue-600' },
    { title: '등록 학과', value: stats?.totalDepts || '-', icon: GraduationCap, suffix: '개', color: 'text-green-600' },
    { title: '변경 이력', value: stats?.totalChanges || '-', icon: History, suffix: '건', color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-8 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Tablet className="h-4 w-4" />
            Tablet Mode (Optimized for 11")
          </p>
        </div>
      </div>
      
      <div className="grid gap-6 grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                <CardTitle className="text-lg font-semibold text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`h-8 w-8 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {loading ? (
                    <span className="text-muted-foreground animate-pulse">...</span>
                  ) : (
                    <>
                      {card.value}
                      <span className="text-xl font-normal text-muted-foreground ml-1">
                        {card.suffix}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>빠른 작업</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <button className="p-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors text-lg h-24 flex flex-col items-center justify-center gap-2">
            <Calendar className="h-6 w-6" />
            학년도 관리
          </button>
          <button className="p-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors text-lg h-24 flex flex-col items-center justify-center gap-2">
            <History className="h-6 w-6" />
            이력 조회
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export function MobileDashboardPage() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">모바일 대시보드</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Calendar className="h-5 w-5" />
             모바일 전용 뷰입니다
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>여기에 모바일 최적화 UI가 들어갑니다.</p>
        </CardContent>
      </Card>
    </div>
  )
}

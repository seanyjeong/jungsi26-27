'use client'

import { Header } from '@/components/layouts/header'

export function MobileDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-muted/30">
        {children}
      </main>
      <nav className="h-16 bg-white border-t flex items-center justify-around px-4">
        <span>홈</span>
        <span>이력</span>
        <span>설정</span>
      </nav>
    </div>
  )
}

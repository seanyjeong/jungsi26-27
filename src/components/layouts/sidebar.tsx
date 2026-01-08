'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FileSpreadsheet, History, Calculator, LayoutDashboard } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/excel', label: '엑셀 관리', icon: FileSpreadsheet, exact: false },
  { href: '/dashboard/history', label: '변경 이력', icon: History, exact: false },
  { href: '/dashboard/test', label: '점수 계산', icon: Calculator, exact: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-card border-r min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">정시엔진 v2</h1>
        <p className="text-sm text-muted-foreground">관리자</p>
      </div>
      
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname.startsWith(item.href)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

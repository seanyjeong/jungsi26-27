'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { useEffect, useState } from 'react'

interface UserInfo {
  name: string
  username: string
  role: string
}

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      setUser(JSON.parse(stored))
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      document.cookie = 'accessToken=; path=/; max-age=0'
      document.cookie = 'refreshToken=; path=/; max-age=0'
      router.push('/login')
    }
  }

  return (
    <header className="h-14 border-b bg-card px-6 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{user.name}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {user.role === 'director' ? '원장' : '강사'}
            </span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </header>
  )
}

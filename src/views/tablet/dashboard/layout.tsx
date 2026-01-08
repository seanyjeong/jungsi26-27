'use client'

import { DesktopDashboardLayout } from '@/views/desktop/dashboard/layout'

export function TabletDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DesktopDashboardLayout>{children}</DesktopDashboardLayout>
}

import { headers } from 'next/headers'
import { DeviceType } from '@/lib/device'
import { DesktopDashboardPage } from '@/views/desktop/dashboard/page'
import { MobileDashboardPage } from '@/views/mobile/dashboard/page'
import { TabletDashboardPage } from '@/views/tablet/dashboard/page'

export default async function DashboardPage() {
  const headersList = await headers()
  const deviceType = (headersList.get('x-device-type') as DeviceType) || 'desktop'

  if (deviceType === 'mobile') return <MobileDashboardPage />
  if (deviceType === 'tablet') return <TabletDashboardPage />
  return <DesktopDashboardPage />
}

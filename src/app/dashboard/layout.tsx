import { headers } from 'next/headers'
import { ResponsiveLayout } from '@/components/layouts/responsive-layout'
import { DesktopDashboardLayout } from '@/views/desktop/dashboard/layout'
import { MobileDashboardLayout } from '@/views/mobile/dashboard/layout'
import { TabletDashboardLayout } from '@/views/tablet/dashboard/layout'
import { DeviceType } from '@/lib/device'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const deviceType = (headersList.get('x-device-type') as DeviceType) || 'desktop'

  return (
    <ResponsiveLayout
      deviceType={deviceType}
      desktop={<DesktopDashboardLayout>{children}</DesktopDashboardLayout>}
      tablet={<TabletDashboardLayout>{children}</TabletDashboardLayout>}
      mobile={<MobileDashboardLayout>{children}</MobileDashboardLayout>}
    />
  )
}

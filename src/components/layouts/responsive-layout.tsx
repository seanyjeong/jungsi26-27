'use client'

import { ReactNode } from 'react'

interface ResponsiveLayoutProps {
  desktop: ReactNode
  tablet: ReactNode
  mobile: ReactNode
  deviceType: 'desktop' | 'tablet' | 'mobile'
}

export function ResponsiveLayout({
  desktop,
  tablet,
  mobile,
  deviceType,
}: ResponsiveLayoutProps) {
  if (deviceType === 'mobile') return <>{mobile}</>
  if (deviceType === 'tablet') return <>{tablet}</>
  return <>{desktop}</>
}

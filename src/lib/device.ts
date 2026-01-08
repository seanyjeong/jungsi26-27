export type DeviceType = 'desktop' | 'tablet' | 'mobile'

export function getDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase()
  
  // 태블릿 체크 (iPad, Android Tablet 등)
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)
  
  if (isTablet) return 'tablet'
  
  // 모바일 체크
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|windows phone|iemobile|wpdesktop/.test(ua)
  
  if (isMobile) return 'mobile'
  
  return 'desktop'
}

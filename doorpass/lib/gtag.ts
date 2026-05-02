export const GA_TRACKING_ID = 'G-4VT7N36ZS0'

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}

export function pageview(url: string) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('config', GA_TRACKING_ID, { page_path: url })
}

export function event({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  })
}

export const gaEvents = {
  search: (query: string) => event({ action: 'search', category: 'building', label: query }),
  buildingView: (name: string) => event({ action: 'view', category: 'building', label: name }),
  passwordInput: () => event({ action: 'password_input', category: 'point', value: 100 }),
  buildingRegister: () => event({ action: 'register', category: 'building', value: 200 }),
  deliveryRequest: () => event({ action: 'request', category: 'delivery' }),
  deliveryApply: () => event({ action: 'apply', category: 'delivery' }),
  pointExchange: () => event({ action: 'exchange', category: 'point', value: 10000 }),
}

const STATE_KEY = "doorpass-app-state"
const LOCATION_KEY = "doorpass-last-location"
const LOCATION_MAX_AGE = 10 * 60 * 1000 // 10분

export interface AppState {
  activeTab: string
  searchQuery: string
  lastVisited: number
}

interface CachedLocation {
  lat: number
  lng: number
  timestamp: number
}

const DEFAULT_STATE: AppState = { activeTab: "search", searchQuery: "", lastVisited: 0 }

export function saveAppState(state: Partial<AppState>) {
  if (typeof window === "undefined") return
  try {
    const existing = loadAppState()
    const next: AppState = { ...existing, ...state, lastVisited: Date.now() }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(next))
  } catch {}
}

export function loadAppState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return DEFAULT_STATE
    return JSON.parse(raw) as AppState
  } catch {
    return DEFAULT_STATE
  }
}

export function saveLocation(lat: number, lng: number) {
  if (typeof window === "undefined") return
  try {
    const data: CachedLocation = { lat, lng, timestamp: Date.now() }
    localStorage.setItem(LOCATION_KEY, JSON.stringify(data))
  } catch {}
}

export function loadCachedLocation(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedLocation
    if (Date.now() - data.timestamp > LOCATION_MAX_AGE) return null
    return { lat: data.lat, lng: data.lng }
  } catch {
    return null
  }
}

export function getLocationAge(): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedLocation
    return Math.floor((Date.now() - data.timestamp) / 60000)
  } catch {
    return null
  }
}

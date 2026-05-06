import type { Building, CurrentUser } from "@/types/building"

const STATE_KEY = "doorpass-app-state"
const LOCATION_KEY = "doorpass-last-location"
const BUILDINGS_KEY = "doorpass_buildings"
const USER_KEY = "doorpass_user"

const LOCATION_MAX_AGE = 10 * 60 * 1000 // 10분
const BUILDINGS_TTL = 10 * 60 * 1000    // 10분
const USER_TTL = 30 * 60 * 1000         // 30분

export interface AppState {
  activeTab: string
  searchQuery: string
  selectedRadius: number
  lastVisited: number
}

interface CachedLocation {
  lat: number
  lng: number
  timestamp: number
}

const DEFAULT_STATE: AppState = {
  activeTab: "search",
  searchQuery: "",
  selectedRadius: 50,
  lastVisited: 0,
}

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
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as AppState) }
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

// ─── 건물 데이터 캐시 (sessionStorage, 10분 TTL) ────────────────────────────
export interface BuildingsCache {
  allBuildings?: Building[]
  nearbyBuildings?: Building[]
  lat?: number
  lng?: number
  radius?: number
  timestamp: number
}

function readBuildingsRaw(): BuildingsCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(BUILDINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BuildingsCache
  } catch {
    return null
  }
}

export function saveBuildingsCache(partial: Partial<Omit<BuildingsCache, "timestamp">>) {
  if (typeof window === "undefined") return
  try {
    const existing = readBuildingsRaw() ?? { timestamp: 0 }
    const next: BuildingsCache = { ...existing, ...partial, timestamp: Date.now() }
    sessionStorage.setItem(BUILDINGS_KEY, JSON.stringify(next))
  } catch {}
}

export function loadBuildingsCache(maxAgeMs: number = BUILDINGS_TTL): BuildingsCache | null {
  const data = readBuildingsRaw()
  if (!data || !data.timestamp) return null
  if (Date.now() - data.timestamp > maxAgeMs) return null
  return data
}

export function getBuildingsCacheAge(): number | null {
  const data = readBuildingsRaw()
  if (!data || !data.timestamp) return null
  return Date.now() - data.timestamp
}

export function clearBuildingsCache() {
  if (typeof window === "undefined") return
  try { sessionStorage.removeItem(BUILDINGS_KEY) } catch {}
}

// ─── 인증/사용자 캐시 (sessionStorage, 30분 TTL) ────────────────────────────
export interface UserCache {
  userId: string
  userName: string
  email: string
  branchId?: string | null
  canRevealBuildingPassword?: boolean
  total_points?: number
  timestamp: number
}

export function saveUserCache(user: CurrentUser) {
  if (typeof window === "undefined") return
  try {
    const data: UserCache = {
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      branchId: user.branchId ?? null,
      canRevealBuildingPassword: user.canRevealBuildingPassword,
      total_points: user.total_points,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(USER_KEY, JSON.stringify(data))
  } catch {}
}

export function loadUserCache(maxAgeMs: number = USER_TTL): UserCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as UserCache
    if (!data.timestamp || Date.now() - data.timestamp > maxAgeMs) return null
    return data
  } catch {
    return null
  }
}

export function clearUserCache() {
  if (typeof window === "undefined") return
  try { sessionStorage.removeItem(USER_KEY) } catch {}
}

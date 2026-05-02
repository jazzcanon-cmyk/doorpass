"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import { calculateDistance } from "@/lib/geo-utils"
import { trackSearch } from "@/lib/analytics"
import type { Building, CurrentUser } from "@/types/building"

function trackUserActivity(
  actionType: "search" | "building_view",
  targetInfo: Record<string, unknown>,
  pageUrl: string
) {
  void fetch("/api/activity/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionType, targetInfo, pageUrl }),
    keepalive: true,
  }).catch(() => {})
}

export function useBuildings(currentUser: CurrentUser | null) {
  const [allBuildings, setAllBuildings] = useState<Building[]>([])
  const [viewportBuildings, setViewportBuildings] = useState<Building[]>([])
  const [nearbyBuildings, setNearbyBuildings] = useState<Building[]>([])
  const [nearbyRadius, setNearbyRadius] = useState<number>(50)
  const [searchResults, setSearchResults] = useState<Building[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const viewportFetchingRef = useRef(false)
  const currentUserRef = useRef(currentUser)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  const fetchBuildings = useCallback(async (lat?: number, lng?: number, radius: number = 50) => {
    setError(null)
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 10000)
    try {
      // lat/lng가 있으면 서버 측에서 반경 필터링 (가벼움, 비로그인 허용)
      const url =
        lat !== undefined && lng !== undefined
          ? `/api/buildings?lat=${lat}&lng=${lng}`
          : "/api/buildings"
      const response = await fetch(url, { signal: ctrl.signal })
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      const buildings: Building[] = data.buildings ?? []
      if (lat !== undefined && lng !== undefined) {
        const withinRadius = buildings
          .map((b) => ({
            ...b,
            distance: Math.round(calculateDistance(lat, lng, b.lat, b.lng)),
          }))
          .filter((b) => (b.distance ?? 0) <= radius)
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        setNearbyBuildings(withinRadius)
        setNearbyRadius(radius)
        setAllBuildings(buildings)
      } else {
        setAllBuildings(buildings)
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error:", err)
      if ((err as Error).name === "AbortError") {
        setError("주변 건물을 불러오지 못했습니다. 검색 탭에서 주소로 찾아보세요.")
      } else {
        setError("건물 데이터를 가져오는데 실패했습니다.")
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }, [])

  const fetchBuildingsByViewport = useCallback(
    async (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      if (viewportFetchingRef.current) return
      viewportFetchingRef.current = true
      try {
        const params = new URLSearchParams({
          minLat: String(bounds.minLat),
          maxLat: String(bounds.maxLat),
          minLng: String(bounds.minLng),
          maxLng: String(bounds.maxLng),
        })
        const response = await fetch(`/api/buildings?${params}`)
        if (!response.ok) return
        const data = await response.json()
        setViewportBuildings(data.buildings)
      } catch (err) {
        console.error("Viewport fetch error:", err)
      } finally {
        viewportFetchingRef.current = false
      }
    },
    []
  )

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed === "") {
      setSearchResults([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: trimmed })
        const response = await fetch(`/api/buildings?${params}`, { signal: ctrl.signal })
        if (!response.ok) {
          setSearchResults([])
          return
        }
        const data = await response.json()
        const buildings: Building[] = data.buildings ?? []
        setSearchResults(buildings)
        if (trimmed.length >= 2) {
          trackSearch(trimmed, buildings.length, currentUserRef.current?.email)
          trackUserActivity(
            "search",
            { keyword: trimmed, results_count: buildings.length },
            window.location.pathname
          )
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setSearchResults([])
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [searchQuery])

  const handleUpdate = useCallback((id: string, updated: Partial<Building>) => {
    const upd = (list: Building[]) =>
      list.map((b) => (b.id === id ? { ...b, ...updated } : b))
    setAllBuildings(upd)
    setNearbyBuildings(upd)
    setSearchResults(upd)
  }, [])

  return {
    allBuildings,
    viewportBuildings,
    nearbyBuildings,
    nearbyRadius,
    searchResults,
    searchQuery,
    lastUpdated,
    error,
    fetchBuildings,
    fetchBuildingsByViewport,
    handleSearch,
    handleUpdate,
  }
}

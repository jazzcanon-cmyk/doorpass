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
  const [searchResults, setSearchResults] = useState<Building[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const viewportFetchingRef = useRef(false)
  const currentUserRef = useRef(currentUser)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  const fetchBuildings = useCallback(async (lat?: number, lng?: number) => {
    try {
      const response = await fetch("/api/buildings")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setAllBuildings(data.buildings)
      if (lat !== undefined && lng !== undefined) {
        const withDist = data.buildings
          .map((b: Building) => ({
            ...b,
            distance: Math.round(calculateDistance(lat, lng, b.lat, b.lng)),
          }))
          .filter((b: Building) => (b.distance ?? 0) <= 50)
          .sort((a: Building, b: Building) => (a.distance ?? 0) - (b.distance ?? 0))
        setNearbyBuildings(withDist)
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error:", err)
      setError("건물 데이터를 가져오는데 실패했습니다.")
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
        console.log('검색어:', searchQuery)
        console.log('API 호출:', `/api/buildings?search=${searchQuery}`)
        const response = await fetch(`/api/buildings?${params}`, { signal: ctrl.signal })
        if (!response.ok) {
          setSearchResults([])
          return
        }
        const data = await response.json()
        console.log('API 응답:', data)
        console.log('buildings:', data.buildings?.length)
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

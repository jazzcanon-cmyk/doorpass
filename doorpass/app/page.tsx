"use client"
import { CalendarModal } from "@/components/calendar"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import dynamic from "next/dynamic"
import { MapPin, Loader2, AlertCircle, RefreshCw, Search, Navigation, MessageSquare, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BuildingCard } from "@/components/building-card"
import { LocationStatus } from "@/components/location-status"
import { SelectedBuildingInfo } from "@/components/selected-building-info"
import { Board } from "@/components/board"
import { trackSearch, trackBuildingView, trackPageView } from "@/lib/analytics"

const BuildingMap = dynamic(
  () => import("@/components/building-map").then((mod) => mod.BuildingMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    ),
  }
)

interface Building {
  id: string
  name: string
  address: string
  password: string
  memo?: string
  latitude: number
  longitude: number
  distance?: number
}

interface CurrentUser {
  userId: string
  userName: string
  email: string
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const rad = Math.PI / 180
  const a1 = lat1 * rad
  const a2 = lat2 * rad
  const da = (lat2 - lat1) * rad
  const db = (lng2 - lng1) * rad
  const a =
    Math.sin(da / 2) * Math.sin(da / 2) +
    Math.cos(a1) * Math.cos(a2) * Math.sin(db / 2) * Math.sin(db / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

type TabType = "nearby" | "search" | "board"

export default function Home() {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<"loading" | "ok">("loading")
  const [activeTab, setActiveTab] = useState<TabType>("nearby")
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [allBuildings, setAllBuildings] = useState<Building[]>([])
  const [nearbyBuildings, setNearbyBuildings] = useState<Building[]>([])
  const [searchResults, setSearchResults] = useState<Building[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const searchTrackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { trackPageView("/") }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const provider = user.app_metadata?.provider
      const userId = user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? user.id
      const email = user.email ?? ""
      const userName =
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        (email ? email.split("@")[0] : "익명")

      void provider
      setCurrentUser({ userId, userName, email })
      setAuthStatus("ok")
    })
  }, [router])

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
            distance: Math.round(calculateDistance(lat, lng, b.latitude, b.longitude)),
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

  const getLocation = useCallback(() => {
    setLoading(true)
    setError(null)
    if (!navigator.geolocation) {
      setError("위치 서비스를 지원하지 않는 브라우저입니다.")
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setLocation({ lat: latitude, lng: longitude })
        await fetchBuildings(latitude, longitude)
        setLoading(false)
      },
      () => {
        setError("위치를 가져오는데 실패했습니다.")
        setLoading(false)
        fetchBuildings()
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [fetchBuildings])

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (query.trim() === "") { setSearchResults([]); return }
      const q = query.toLowerCase().trim()
      const filtered = allBuildings.filter(
        (b) =>
          (b.name ?? "").toLowerCase().includes(q) ||
          (b.address ?? "").toLowerCase().includes(q)
      )
      setSearchResults(filtered)
      if (q.length >= 2) {
        if (searchTrackRef.current) clearTimeout(searchTrackRef.current)
        searchTrackRef.current = setTimeout(() => trackSearch(query.trim(), filtered.length), 1500)
      }
    },
    [allBuildings]
  )

  const handleBuildingSelect = useCallback((b: Building | null) => {
    setSelectedBuilding(b)
    if (b) trackBuildingView(b.id, b.name || b.address)
  }, [])

  const handleUpdate = useCallback((id: string, updated: Partial<Building>) => {
    const upd = (list: Building[]) =>
      list.map((b) => (b.id === id ? { ...b, ...updated } : b))
    setAllBuildings(upd)
    setNearbyBuildings(upd)
    setSearchResults(upd)
    if (selectedBuilding?.id === id)
      setSelectedBuilding((prev) => (prev ? { ...prev, ...updated } : null))
  }, [selectedBuilding])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  useEffect(() => {
    if (authStatus === "ok") getLocation()
  }, [authStatus, getLocation])

  const tabs = [
    { key: "nearby" as TabType, label: "내 주변", icon: <Navigation className="h-4 w-4" /> },
    { key: "search" as TabType, label: "검색", icon: <Search className="h-4 w-4" /> },
    { key: "board" as TabType, label: "게시판", icon: <MessageSquare className="h-4 w-4" /> },
  ]

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
              <svg
                className="h-8 w-8 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9v.01" />
                <path d="M9 12v.01" />
                <path d="M9 15v.01" />
                <path d="M9 18v.01" />
              </svg>
            </div>
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 blur-xl animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            <p className="text-blue-200/60 text-sm">로그인 확인 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-blue-400/40 to-indigo-500/40 blur opacity-60" />
                <svg
                  className="relative h-[18px] w-[18px] text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                  <path d="M9 9v.01" />
                  <path d="M9 12v.01" />
                  <path d="M9 15v.01" />
                  <path d="M9 18v.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">신정대리점</h1>
                <p className="text-[11px] text-white/40">
                  {currentUser ? currentUser.userName : "공동현관 비밀번호"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {activeTab !== "board" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={getLocation}
                  disabled={loading}
                  className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="container mx-auto px-4 pb-3">
          <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedBuilding(null) }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Calendar */}
      <div className="container mx-auto px-4 pt-4">
        <CalendarModal kakaoId={currentUser?.userId} userName={currentUser?.userName} />
      </div>

      {/* Nearby tab */}
      {activeTab === "nearby" && (
        <>
          <LocationStatus
            loading={loading}
            error={error}
            location={location}
            lastUpdated={lastUpdated}
            buildingCount={nearbyBuildings.length}
            onRetry={getLocation}
          />
          {!loading && !error && location && (
            <section className="container mx-auto px-4 pt-4">
              <BuildingMap
                userLocation={location}
                buildings={allBuildings}
                onBuildingSelect={handleBuildingSelect}
                selectedBuilding={selectedBuilding}
              />
              {selectedBuilding && (
                <SelectedBuildingInfo
                  building={selectedBuilding}
                  onClose={() => setSelectedBuilding(null)}
                  onPasswordUpdate={(id, pw) => handleUpdate(id, { password: pw })}
                />
              )}
            </section>
          )}
          <section className="container mx-auto px-4 py-6">
            <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
              반경 50m 내 건물
            </h2>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                  <div className="absolute inset-0 blur-xl bg-blue-500/20 rounded-full" />
                </div>
                <p className="text-white/40 text-sm">주변 건물 검색 중...</p>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center backdrop-blur-sm">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-300 text-sm mb-4">{error}</p>
                <button
                  onClick={getLocation}
                  className="bg-red-500 hover:bg-red-600 active:scale-95 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200"
                >
                  다시 시도
                </button>
              </div>
            ) : nearbyBuildings.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
                <MapPin className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">반경 50m 내에 등록된 건물이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {nearbyBuildings.map((b) => (
                  <BuildingCard key={b.id} building={b} showDistance onUpdate={handleUpdate} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Search tab */}
      {activeTab === "search" && (
        <>
          <section className="container mx-auto px-4 py-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type="text"
                placeholder="건물명 or 주소 넣어보세요"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-blue-500/50 transition-all duration-200"
                autoFocus
              />
            </div>
          </section>
          <section className="container mx-auto px-4 pb-6">
            {searchQuery.trim() === "" ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
                <Search className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm mb-1">건물명 또는 주소를 검색해주세요</p>
                <p className="text-white/20 text-xs">등록된 건물 {allBuildings.length.toLocaleString()}개</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
                <AlertCircle className="h-10 w-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">&apos;{searchQuery}&apos;에 대한 검색 결과가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
                  검색 결과 {searchResults.length}건
                </p>
                {searchResults.map((b) => (
                  <BuildingCard key={b.id} building={b} showDistance={false} onUpdate={handleUpdate} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Board tab */}
      {activeTab === "board" && (
        <section className="container mx-auto px-4 py-4">
          <Board currentUser={currentUser ?? undefined} />
        </section>
      )}

      {/* Footer */}
      <footer className="relative border-t border-white/[0.08] py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[11px] text-white/20">배달/택배 기사님들의 빠른 배송을 응원합니다 🚚</p>
        </div>
      </footer>
    </main>
  )
}

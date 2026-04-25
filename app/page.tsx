"use client"
import { CalendarModal } from "@/components/calendar"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import dynamic from "next/dynamic"
import { MapPin, Loader2, AlertCircle, RefreshCw, Search, Navigation, MessageSquare, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BuildingCard } from "@/components/building-card"
import { LocationStatus } from "@/components/location-status"
import { SelectedBuildingInfo } from "@/components/selected-building-info"
import { Board } from "@/components/board"

const BuildingMap = dynamic(
  () => import("@/components/building-map").then((mod) => mod.BuildingMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] rounded-xl bg-secondary flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

  // ── 인증 확인 ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login")
        return
      }
      const provider = user.app_metadata?.provider
      // provider_id를 공용 식별자로 사용 (카카오: kakao ID, 구글: Google sub)
      const userId = user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? user.id
      // 이름 우선순위: name(카카오) → full_name(구글) → 이메일 앞부분
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
    },
    [allBuildings]
  )

  const handleBuildingSelect = useCallback((b: Building | null) => setSelectedBuilding(b), [])

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

  // ── 인증 로딩 화면 ──
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">로그인 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
                <div className="absolute inset-0 rounded-xl bg-primary/20 blur-sm" />
                <svg
                  className="relative h-5 w-5 text-primary-foreground"
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
              <div>
                <h1 className="text-lg font-bold text-foreground">신정대리점</h1>
                <p className="text-xs text-muted-foreground">
                  {currentUser ? currentUser.userName : "공동현관 비밀번호"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTab !== "board" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={getLocation}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                title="로그아웃"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="container mx-auto px-4 pb-3">
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedBuilding(null) }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 캘린더 (모든 탭 상단에 표시) ── */}
      <div className="container mx-auto px-4 pt-4">
        <CalendarModal kakaoId={currentUser?.userId} userName={currentUser?.userName} />
      </div>

      {/* ── 내 주변 탭 ── */}
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
            <h2 className="text-sm font-medium text-muted-foreground mb-3">반경 50m 내 건물</h2>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">주변 건물 검색 중...</p>
              </div>
            ) : error ? (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardContent className="flex flex-col items-center py-10">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="mt-4 text-center text-destructive">{error}</p>
                  <Button onClick={getLocation} className="mt-6">다시 시도</Button>
                </CardContent>
              </Card>
            ) : nearbyBuildings.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="flex flex-col items-center py-10">
                  <MapPin className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-center text-muted-foreground">반경 50m 내에 등록된 건물이 없습니다.</p>
                </CardContent>
              </Card>
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

      {/* ── 검색 탭 ── */}
      {activeTab === "search" && (
        <>
          <section className="container mx-auto px-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="건물명 or 주소 넣어보세요"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 bg-secondary border-0 text-foreground placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>
          </section>
          <section className="container mx-auto px-4 pb-6">
            {searchQuery.trim() === "" ? (
              <Card className="bg-card">
                <CardContent className="flex flex-col items-center py-10">
                  <Search className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-center text-muted-foreground">건물명 또는 주소를 검색해주세요</p>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    등록된 건물 {allBuildings.length.toLocaleString()}개
                  </p>
                </CardContent>
              </Card>
            ) : searchResults.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="flex flex-col items-center py-10">
                  <AlertCircle className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-center text-muted-foreground">
                    &apos;{searchQuery}&apos;에 대한 검색 결과가 없습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-3">검색 결과 {searchResults.length}건</p>
                {searchResults.map((b) => (
                  <BuildingCard key={b.id} building={b} showDistance={false} onUpdate={handleUpdate} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── 게시판 탭 ── */}
      {activeTab === "board" && (
        <section className="container mx-auto px-4 py-4">
          <Board currentUser={currentUser ?? undefined} />
        </section>
      )}

      {/* ── 푸터 ── */}
      <footer className="border-t border-border bg-card/50 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">배달/택배 기사님들의 빠른 배송을 응원합니다</p>
        </div>
      </footer>
    </main>
  )
}

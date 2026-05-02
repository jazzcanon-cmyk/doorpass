"use client"
import { CalendarModal } from "@/components/calendar"
import { useState, useEffect, useCallback } from "react"
import { Board } from "@/components/board"
import { DeliveryBoard } from "@/components/delivery/DeliveryBoard"
import { WelcomeDialog } from "@/components/WelcomeDialog"
import { LoadingScreen } from "@/components/LoadingScreen"
import { AppHeader } from "@/components/AppHeader"
import { NearbyTab } from "@/components/NearbyTab"
import { SearchTab } from "@/components/SearchTab"
import { NewBuildingModal } from "@/components/NewBuildingModal"
import { TermsAgreementModal } from "@/components/TermsAgreementModal"
import PushNotificationBanner from "@/components/PushNotificationBanner"
import { trackBuildingView, trackPageView } from "@/lib/analytics"
import { useAuth } from "@/hooks/useAuth"
import { useLocation } from "@/hooks/useLocation"
import { useBuildings } from "@/hooks/useBuildings"
import type { Building, TabType } from "@/types/building"

export default function Home() {
  const { authStatus, currentUser, showWelcome, handleWelcomeClose, handleLogout } = useAuth()
  const { location, getLocation, loading, error: locationError } = useLocation()
  const {
    allBuildings,
    viewportBuildings,
    nearbyBuildings,
    nearbyRadius,
    searchResults,
    searchQuery,
    lastUpdated,
    error: buildingsError,
    fetchBuildings,
    fetchBuildingsByViewport,
    handleSearch,
    handleUpdate,
  } = useBuildings(currentUser)

  const [activeTab, setActiveTab] = useState<TabType>("search")
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [selectedRadius, setSelectedRadius] = useState<number>(50)

  const error = locationError ?? buildingsError

  useEffect(() => { trackPageView("/") }, [])

  const refreshLocation = useCallback(() => {
    getLocation(
      (lat, lng) => fetchBuildings(lat, lng, selectedRadius),
      () => fetchBuildings()
    )
  }, [getLocation, fetchBuildings, selectedRadius])

  const handleLocateMe = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        getLocation(
          async (lat, lng) => {
            await fetchBuildings(lat, lng, selectedRadius)
            resolve(true)
          },
          async () => {
            await fetchBuildings()
            resolve(false)
          }
        )
      }),
    [getLocation, fetchBuildings, selectedRadius]
  )

  // 초기 마운트 시 GPS 없이 건물 목록만 로드 (검색 탭에서 바로 사용)
  useEffect(() => {
    if (authStatus !== "ok") return
    void fetchBuildings()
  }, [authStatus, fetchBuildings])

  // 내주변 탭 진입 시에만 GPS 로딩 + 거리 재계산
  useEffect(() => {
    if (authStatus !== "ok") return
    if (activeTab !== "nearby") return
    refreshLocation()
  }, [authStatus, activeTab, refreshLocation])

  const handleBuildingSelect = useCallback((b: Building | null) => {
    setSelectedBuilding(b)
    if (b) {
      trackBuildingView(b.id, b.name || b.address, currentUser?.email)
      void fetch("/api/activity/log-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id: b.id,
          building_name: b.name || b.address,
          building_address: b.address,
        }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [currentUser])

  const handleBuildingUpdate = useCallback((id: string, updated: Partial<Building>) => {
    handleUpdate(id, updated)
    if (selectedBuilding?.id === id)
      setSelectedBuilding((prev) => (prev ? { ...prev, ...updated } : null))
  }, [handleUpdate, selectedBuilding])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setSelectedBuilding(null)
  }, [])

  // 기존 회원 약관 동의 확인
  useEffect(() => {
    if (authStatus !== "ok") return
    void fetch("/api/users/terms-check")
      .then((r) => r.json())
      .then((data: { agreed?: boolean }) => {
        if (data.agreed === false) setShowTermsModal(true)
      })
      .catch(() => {})
  }, [authStatus])

  useEffect(() => {
    if (authStatus !== "ok") return
    void fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "page_view", pageUrl: window.location.pathname }),
      keepalive: true,
    }).catch(() => {})
  }, [authStatus])

  if (authStatus === "loading") return <LoadingScreen />

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {authStatus === "ok" && <PushNotificationBanner />}

      {showTermsModal && (
        <TermsAgreementModal onAgreed={() => setShowTermsModal(false)} />
      )}

      <WelcomeDialog
        open={showWelcome}
        userName={currentUser?.userName ?? ""}
        onClose={handleWelcomeClose}
      />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <AppHeader
        currentUser={currentUser}
        activeTab={activeTab}
        loading={loading}
        onTabChange={handleTabChange}
        onRefresh={refreshLocation}
        onLogout={handleLogout}
      />

      <div className="container mx-auto px-4 pt-4">
        <CalendarModal kakaoId={currentUser?.userId} userName={currentUser?.userName} />
      </div>

      {activeTab === "nearby" && (
        <NearbyTab
          loading={loading}
          error={error}
          location={location}
          lastUpdated={lastUpdated}
          nearbyBuildings={nearbyBuildings}
          allBuildings={allBuildings}
          viewportBuildings={viewportBuildings}
          selectedBuilding={selectedBuilding}
          canRevealBuildingPassword={currentUser?.canRevealBuildingPassword === true}
          onRetry={refreshLocation}
          onBuildingSelect={handleBuildingSelect}
          onBuildingUpdate={handleBuildingUpdate}
          onBoundsChange={fetchBuildingsByViewport}
          onGoToSearch={() => handleTabChange("search")}
          onLocateMe={handleLocateMe}
          radius={selectedRadius}
          onRadiusChange={(r) => {
            setSelectedRadius(r)
            if (location) fetchBuildings(location.lat, location.lng, r)
          }}
        />
      )}

      {activeTab === "search" && (
        <SearchTab
          searchQuery={searchQuery}
          searchResults={searchResults}
          allBuildings={allBuildings}
          canRevealBuildingPassword={currentUser?.canRevealBuildingPassword === true}
          onSearch={handleSearch}
          onBuildingUpdate={handleBuildingUpdate}
          onAddBuilding={
            currentUser?.canRevealBuildingPassword === true
              ? () => setIsAddBuildingOpen(true)
              : undefined
          }
        />
      )}

      {currentUser && (
        <NewBuildingModal
          open={isAddBuildingOpen}
          onClose={() => setIsAddBuildingOpen(false)}
          branchId={currentUser.branchId}
          userEmail={currentUser.email}
          onSuccess={fetchBuildings}
        />
      )}

      {activeTab === "board" && (
        <section className="container mx-auto px-4 py-4">
          <Board currentUser={currentUser ?? undefined} />
        </section>
      )}

      {activeTab === "delivery" && (
        <section className="container mx-auto px-4 py-4">
          <DeliveryBoard
            currentEmail={currentUser?.email}
            branchId={currentUser?.branchId ?? null}
          />
        </section>
      )}

      <footer className="relative border-t border-white/[0.08] py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[11px] text-white/20">배달/택배 기사님들의 빠른 배송을 응원합니다 🚚</p>
        </div>
      </footer>
    </main>
  )
}

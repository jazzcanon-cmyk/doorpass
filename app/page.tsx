"use client"
import { CalendarModal } from "@/components/calendar"
import { useState, useEffect, useCallback, useRef } from "react"
import { Board } from "@/components/board"
import { WelcomeDialog } from "@/components/WelcomeDialog"
import { LoadingScreen } from "@/components/LoadingScreen"
import { AppHeader } from "@/components/AppHeader"
import { NearbyTab } from "@/components/NearbyTab"
import { SearchTab } from "@/components/SearchTab"
import { trackBuildingView, trackPageView } from "@/lib/analytics"
import { useAuth } from "@/hooks/useAuth"
import { useLocation } from "@/hooks/useLocation"
import { useBuildings } from "@/hooks/useBuildings"
import type { Building, PasswordAccess, TabType } from "@/types/building"

export default function Home() {
  const { authStatus, currentUser, showWelcome, handleWelcomeClose, handleLogout } = useAuth()
  const [passwordAccess, setPasswordAccess] = useState<PasswordAccess>("checking")
  const passwordAccessCheckedRef = useRef(false)
  const { location, getLocation, loading, error: locationError } = useLocation()
  const {
    allBuildings,
    viewportBuildings,
    nearbyBuildings,
    searchResults,
    searchQuery,
    lastUpdated,
    error: buildingsError,
    fetchBuildings,
    fetchBuildingsByViewport,
    handleSearch,
    handleUpdate,
  } = useBuildings(currentUser)

  const [activeTab, setActiveTab] = useState<TabType>("nearby")
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)

  const error = locationError ?? buildingsError

  useEffect(() => { trackPageView("/") }, [])

  useEffect(() => {
    if (authStatus !== "ok") return
    const email = currentUser?.email ?? ""
    if (!email) {
      setPasswordAccess("masked_guest")
      return
    }
    if (passwordAccessCheckedRef.current) return

    let cancelled = false
    passwordAccessCheckedRef.current = true
    setPasswordAccess("checking")
    void fetch("/api/users/me")
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setPasswordAccess("masked_guest")
          return
        }
        const data = (await res.json()) as {
          role?: string | null
          accountStatus?: "active" | "inactive" | null
        }
        if (cancelled) return
        console.log("[/api/users/me] role/accountStatus:", {
          role: data.role ?? null,
          accountStatus: data.accountStatus ?? null,
        })
        const approved = Boolean(data.role) && data.accountStatus === "active"
        setPasswordAccess(approved ? "full" : "masked_user")
      })
      .catch(() => {
        if (!cancelled) setPasswordAccess("masked_user")
      })

    return () => {
      cancelled = true
    }
  }, [authStatus, currentUser?.email])

  const refreshLocation = useCallback(() => {
    getLocation(
      (lat, lng) => fetchBuildings(lat, lng),
      () => fetchBuildings()
    )
  }, [getLocation, fetchBuildings])

  useEffect(() => {
    if (authStatus === "ok") refreshLocation()
  }, [authStatus, refreshLocation])

  const handleBuildingSelect = useCallback((b: Building | null) => {
    setSelectedBuilding(b)
    if (b) {
      trackBuildingView(b.id, b.name || b.address, currentUser?.email)
      void fetch("/api/activity/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "building_view",
          targetInfo: {
            building_id: b.id,
            building_name: b.name || b.address,
            building_address: b.address,
          },
          pageUrl: window.location.pathname,
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
          passwordAccess={passwordAccess}
          onRetry={refreshLocation}
          onBuildingSelect={handleBuildingSelect}
          onBuildingUpdate={handleBuildingUpdate}
          onBoundsChange={fetchBuildingsByViewport}
        />
      )}

      {activeTab === "search" && (
        <SearchTab
          searchQuery={searchQuery}
          searchResults={searchResults}
          allBuildings={allBuildings}
          passwordAccess={passwordAccess}
          onSearch={handleSearch}
          onBuildingUpdate={handleBuildingUpdate}
        />
      )}

      {activeTab === "board" && (
        <section className="container mx-auto px-4 py-4">
          <Board currentUser={currentUser ?? undefined} />
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

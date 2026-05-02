"use client"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { MapPin, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { BuildingCard } from "@/components/building-card"
import { LocationStatus } from "@/components/location-status"
import { SelectedBuildingInfo } from "@/components/selected-building-info"
import type { Building } from "@/types/building"

const NEARBY_TOP_LIMIT = 5

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

interface NearbyTabProps {
  loading: boolean
  error: string | null
  location: { lat: number; lng: number } | null
  lastUpdated: Date | null
  nearbyBuildings: Building[]
  allBuildings: Building[]
  viewportBuildings: Building[]
  selectedBuilding: Building | null
  canRevealBuildingPassword: boolean
  onRetry: () => void
  onBuildingSelect: (b: Building | null) => void
  onBuildingUpdate: (id: string, updated: Partial<Building>) => void
  onBoundsChange: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void
  onGoToSearch?: () => void
  onLocateMe?: () => Promise<boolean>
  radius: number
  onRadiusChange: (r: number) => void
}

export function NearbyTab({
  loading,
  error,
  location,
  lastUpdated,
  nearbyBuildings,
  allBuildings,
  viewportBuildings,
  selectedBuilding,
  canRevealBuildingPassword,
  onRetry,
  onBuildingSelect,
  onBuildingUpdate,
  onBoundsChange,
  onGoToSearch,
  onLocateMe,
  radius,
  onRadiusChange,
}: NearbyTabProps) {
  const [showAll, setShowAll] = useState(false)

  // 결과가 바뀌면(재검색·새 위치) 항상 상위 5개로 리셋
  useEffect(() => {
    setShowAll(false)
  }, [nearbyBuildings])

  const totalCount = nearbyBuildings.length
  const visibleBuildings = showAll ? nearbyBuildings : nearbyBuildings.slice(0, NEARBY_TOP_LIMIT)
  const hasMore = totalCount > NEARBY_TOP_LIMIT

  return (
    <>
      <LocationStatus
        loading={loading}
        error={error}
        location={location}
        lastUpdated={lastUpdated}
        buildingCount={nearbyBuildings.length}
        radius={radius}
        onRetry={onRetry}
      />
      <div className="container mx-auto px-4 pt-3 flex gap-2">
        {[50, 100].map((r) => (
          <button
            key={r}
            onClick={() => onRadiusChange(r)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              radius === r
                ? "bg-blue-500 border-blue-500 text-white"
                : "bg-white/5 border-white/20 text-white/60 hover:bg-white/10"
            }`}
          >
            {r}m
          </button>
        ))}
      </div>
      {!loading && !error && location && (
        <section className="container mx-auto px-4 pt-4">
          <BuildingMap
            userLocation={location}
            buildings={viewportBuildings.length > 0 ? viewportBuildings : allBuildings}
            onBuildingSelect={onBuildingSelect}
            selectedBuilding={selectedBuilding}
            onBoundsChange={onBoundsChange}
            onLocateMe={onLocateMe}
          />
          {selectedBuilding && (
            <SelectedBuildingInfo
              building={selectedBuilding}
              canRevealBuildingPassword={canRevealBuildingPassword}
              onClose={() => onBuildingSelect(null)}
              onPasswordUpdate={(id, pw) => onBuildingUpdate(id, { password: pw })}
            />
          )}
        </section>
      )}
      <section className="container mx-auto px-4 py-6">
        <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
          {totalCount === 0
            ? `반경 ${radius}m 내 건물`
            : showAll
              ? `반경 ${radius}m 내 전체 ${totalCount}개`
              : `가장 가까운 건물 ${Math.min(totalCount, NEARBY_TOP_LIMIT)}개`}
        </h2>
        {loading && totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
              <div className="absolute inset-0 blur-xl bg-blue-500/20 rounded-full" />
            </div>
            <p className="text-white/40 text-sm">주변 건물 검색 중...</p>
          </div>
        ) : error && totalCount === 0 ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center backdrop-blur-sm">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 text-sm mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onRetry}
                className="bg-red-500 hover:bg-red-600 active:scale-95 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200"
              >
                다시 시도
              </button>
              {onGoToSearch && (
                <button
                  onClick={onGoToSearch}
                  className="bg-white/10 hover:bg-white/20 active:scale-95 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200"
                >
                  검색 탭으로 이동
                </button>
              )}
            </div>
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
            <MapPin className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">{`반경 ${radius}m 내 등록된 건물이 없습니다`}</p>
            <p className="text-white/30 text-xs mb-4">검색 탭에서 주소로 찾아보세요</p>
            {onGoToSearch && (
              <button
                onClick={onGoToSearch}
                className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200"
              >
                검색 탭으로 이동
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleBuildings.map((b) => (
                <BuildingCard
                  key={b.id}
                  building={b}
                  showDistance
                  canRevealBuildingPassword={canRevealBuildingPassword}
                  onUpdate={onBuildingUpdate}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-medium text-white/70 transition-all duration-200"
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      {`더 보기 (반경 ${radius}m 내 전체 ${totalCount}개)`}
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

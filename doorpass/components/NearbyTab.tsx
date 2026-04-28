"use client"
import dynamic from "next/dynamic"
import { MapPin, Loader2, AlertCircle } from "lucide-react"
import { BuildingCard } from "@/components/building-card"
import { LocationStatus } from "@/components/location-status"
import { SelectedBuildingInfo } from "@/components/selected-building-info"
import type { Building } from "@/types/building"

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
  onRetry: () => void
  onBuildingSelect: (b: Building | null) => void
  onBuildingUpdate: (id: string, updated: Partial<Building>) => void
  onBoundsChange: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void
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
  onRetry,
  onBuildingSelect,
  onBuildingUpdate,
  onBoundsChange,
}: NearbyTabProps) {
  return (
    <>
      <LocationStatus
        loading={loading}
        error={error}
        location={location}
        lastUpdated={lastUpdated}
        buildingCount={nearbyBuildings.length}
        onRetry={onRetry}
      />
      {!loading && !error && location && (
        <section className="container mx-auto px-4 pt-4">
          <BuildingMap
            userLocation={location}
            buildings={viewportBuildings.length > 0 ? viewportBuildings : allBuildings}
            onBuildingSelect={onBuildingSelect}
            selectedBuilding={selectedBuilding}
            onBoundsChange={onBoundsChange}
          />
          {selectedBuilding && (
            <SelectedBuildingInfo
              building={selectedBuilding}
              onClose={() => onBuildingSelect(null)}
              onPasswordUpdate={(id, pw) => onBuildingUpdate(id, { password: pw })}
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
              onClick={onRetry}
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
              <BuildingCard key={b.id} building={b} showDistance onUpdate={onBuildingUpdate} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

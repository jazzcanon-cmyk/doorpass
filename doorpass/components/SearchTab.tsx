"use client"
import { Search, AlertCircle, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { BuildingCard } from "@/components/building-card"
import type { Building } from "@/types/building"

interface SearchTabProps {
  searchQuery: string
  searchResults: Building[]
  allBuildings: Building[]
  canRevealBuildingPassword: boolean
  onSearch: (query: string) => void
  onBuildingUpdate: (id: string, updated: Partial<Building>) => void
  onAddBuilding?: () => void
}

export function SearchTab({
  searchQuery,
  searchResults,
  allBuildings,
  canRevealBuildingPassword,
  onSearch,
  onBuildingUpdate,
  onAddBuilding,
}: SearchTabProps) {
  return (
    <>
      <section className="container mx-auto px-4 py-4">
        {onAddBuilding && (
          <div className="mb-3">
            <button
              type="button"
              onClick={onAddBuilding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-sm font-semibold transition-colors shadow-md shadow-green-900/30"
            >
              <Plus className="h-4 w-4" />
              새 건물 등록
            </button>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            type="text"
            placeholder="건물명 or 주소 넣어보세요"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
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
              <BuildingCard
                key={b.id}
                building={b}
                showDistance={false}
                canRevealBuildingPassword={canRevealBuildingPassword}
                onUpdate={onBuildingUpdate}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

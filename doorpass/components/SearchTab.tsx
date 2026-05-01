"use client"
import { useMemo, useState } from "react"
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

type AccessFilter = "all" | "free" | "password"

export function SearchTab({
  searchQuery,
  searchResults,
  allBuildings,
  canRevealBuildingPassword,
  onSearch,
  onBuildingUpdate,
  onAddBuilding,
}: SearchTabProps) {
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all")

  const filteredResults = useMemo(() => {
    if (accessFilter === "all") return searchResults
    return searchResults.filter((b) => {
      const t = b.access_type ?? "password"
      return t === accessFilter
    })
  }, [searchResults, accessFilter])

  const FILTERS: { value: AccessFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "free", label: "🚪 자유출입" },
    { value: "password", label: "🔐 비밀번호" },
  ]

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

        <div className="flex gap-1 mt-3 rounded-xl bg-white/5 border border-white/10 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setAccessFilter(f.value)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                accessFilter === f.value
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>
      <section className="container mx-auto px-4 pb-6">
        {searchQuery.trim() === "" ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
            <Search className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">건물명 또는 주소를 검색해주세요</p>
            <p className="text-white/20 text-xs">등록된 건물 {allBuildings.length.toLocaleString()}개</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
            <AlertCircle className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">
              {accessFilter === "all"
                ? `'${searchQuery}'에 대한 검색 결과가 없습니다.`
                : `해당 출입방식의 검색 결과가 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
              검색 결과 {filteredResults.length}건
              {accessFilter !== "all" && ` · ${FILTERS.find((f) => f.value === accessFilter)?.label}`}
            </p>
            {filteredResults.map((b) => (
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

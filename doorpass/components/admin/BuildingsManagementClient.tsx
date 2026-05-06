"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BuildingEditDialog } from "@/components/admin/BuildingEditDialog"

const PAGE_SIZE = 100

export interface BuildingListItem {
  id: number
  name: string
  address: string
  region: string | null
  created_at: string
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

export function BuildingsManagementClient({ editable = false }: { editable?: boolean }) {
  const [buildings, setBuildings] = useState<BuildingListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailBuildingId, setDetailBuildingId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const res = await fetch("/api/buildings/export")
      if (!res.ok) throw new Error("export failed")
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      const filename = match ? decodeURIComponent(match[1]) : "buildings.xlsx"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("다운로드에 실패했습니다.")
    } finally {
      setIsExporting(false)
    }
  }, [])

  const fetchPage = useCallback(async (p: number, search: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", String(p))
      if (search) params.set("search", search)
      const res = await fetch(`/api/buildings?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error || "건물 목록을 불러오지 못했습니다.")
        setBuildings([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setBuildings(Array.isArray(data.buildings) ? data.buildings : [])
      setTotal(typeof data.total === "number" ? data.total : 0)
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
      setBuildings([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    void fetchPage(page, debouncedSearch)
  }, [page, debouncedSearch, fetchPage])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showing = buildings.length
  const summary =
    total === 0
      ? "등록된 건물이 없습니다"
      : `전체 ${total.toLocaleString("ko-KR")}개 중 ${showing.toLocaleString("ko-KR")}개 표시`

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">건물 관리</h1>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">{summary}</p>
        {!isLoading && total > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            페이지 {page.toLocaleString("ko-KR")} / {totalPages.toLocaleString("ko-KR")} · 페이지당 {PAGE_SIZE}개
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="건물명 또는 주소로 검색 (서버 검색)…"
          className="w-full max-w-xl px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <div className="flex items-center gap-2">
          {editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={handleExport}
            >
              {isExporting ? "다운로드 중..." : "📥 Excel 다운로드"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums px-2">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-600 dark:text-gray-400">로딩 중…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buildings.map((building) => (
              <div
                key={building.id}
                role={editable ? "button" : undefined}
                tabIndex={editable ? 0 : undefined}
                className={cn(
                  "bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700",
                  editable &&
                    "cursor-pointer transition-colors hover:border-blue-400 dark:hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                )}
                onClick={editable ? () => setDetailBuildingId(building.id) : undefined}
                onKeyDown={
                  editable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setDetailBuildingId(building.id)
                        }
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <Building2 className="h-6 w-6 text-blue-500" />
                  <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200">
                    {building.region || "미분류"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{building.name}</h3>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {building.address}
                </p>
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    등록일: {new Date(building.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {buildings.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {debouncedSearch ? "검색 결과가 없습니다" : "등록된 건물이 없습니다"}
            </div>
          )}
        </>
      )}

      {editable && (
        <BuildingEditDialog
          buildingId={detailBuildingId}
          open={detailBuildingId !== null}
          onOpenChange={(o) => {
            if (!o) setDetailBuildingId(null)
          }}
          onSaved={({ id, name }) => {
            setBuildings((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
          }}
          onDeleted={(id) => {
            setBuildings((prev) => prev.filter((b) => b.id !== id))
            setTotal((t) => Math.max(0, t - 1))
          }}
        />
      )}
    </div>
  )
}

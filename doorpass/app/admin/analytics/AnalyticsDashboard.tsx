"use client"

import { useState, useEffect } from "react"
import { Loader2, Search, Building2, MousePointer2, FileText, BarChart2, Clock, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface PopularSearch { query: string; search_count: number }
interface PopularBuilding { building_name: string; building_id: string; view_count: number }
interface RecentActivity { id: number; activity_type: string; data: Record<string, unknown>; created_at: string }
interface HourlyPoint { hour: string; count: number }
interface TypeCount { type: string; count: number }

interface Stats {
  popularSearches: PopularSearch[]
  popularBuildings: PopularBuilding[]
  recentActivities: RecentActivity[]
  hourlyActivity: HourlyPoint[]
  activityByType: TypeCount[]
  totalToday: number
}

type Tab = "searches" | "buildings" | "recent" | "chart"

const TYPE_LABEL: Record<string, string> = {
  search: "검색",
  building_view: "건물 조회",
  post_view: "게시글 조회",
  button_click: "버튼 클릭",
  page_view: "페이지 뷰",
}

const TYPE_ICON: Record<string, React.ElementType> = {
  search: Search,
  building_view: Building2,
  post_view: FileText,
  button_click: MousePointer2,
  page_view: Activity,
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

function formatHour(iso: string) {
  const d = new Date(iso + ":00:00Z")
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("searches")

  useEffect(() => {
    fetch("/api/analytics/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setStats(d)
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (error || !stats) return (
    <div className="text-center py-12 text-destructive text-sm">{error ?? "오류 발생"}</div>
  )

  const maxHourly = Math.max(...stats.hourlyActivity.map((h) => h.count), 1)

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: "searches",  label: "인기 검색어",  Icon: Search },
    { key: "buildings", label: "인기 건물",    Icon: Building2 },
    { key: "recent",    label: "최근 활동",    Icon: Clock },
    { key: "chart",     label: "시간대별",     Icon: BarChart2 },
  ]

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">활동 분석</h1>
        <span className="text-xs text-muted-foreground">최근 24h: {stats.totalToday}건</span>
      </div>

      {/* 활동 유형 요약 */}
      <div className="grid grid-cols-3 gap-2">
        {stats.activityByType.slice(0, 3).map(({ type, count }) => {
          const Icon = TYPE_ICON[type] ?? Activity
          return (
            <Card key={type}>
              <CardContent className="p-3 flex flex-col items-center gap-1">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-base font-bold">{count}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{TYPE_LABEL[type] ?? type}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* 인기 검색어 */}
      {tab === "searches" && (
        <div className="space-y-2">
          {stats.popularSearches.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">검색 데이터 없음</p>
          ) : stats.popularSearches.map((s, i) => (
            <Card key={s.query}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.query}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.round((s.search_count / (stats.popularSearches[0]?.search_count ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{s.search_count}회</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 인기 건물 */}
      {tab === "buildings" && (
        <div className="space-y-2">
          {stats.popularBuildings.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">건물 조회 데이터 없음</p>
          ) : stats.popularBuildings.map((b, i) => (
            <Card key={b.building_id ?? i}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{b.building_name ?? b.building_id ?? "-"}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round((b.view_count / (stats.popularBuildings[0]?.view_count ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{b.view_count}회</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 최근 활동 */}
      {tab === "recent" && (
        <div className="space-y-2">
          {stats.recentActivities.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">활동 없음</p>
          ) : stats.recentActivities.map((a) => {
            const Icon = TYPE_ICON[a.activity_type] ?? Activity
            const detail =
              a.activity_type === "search" ? `"${a.data?.query ?? ""}"` :
              a.activity_type === "building_view" ? String(a.data?.buildingName ?? "") :
              a.activity_type === "post_view" ? String(a.data?.postTitle ?? "") :
              a.activity_type === "button_click" ? String(a.data?.buttonName ?? "") :
              String(a.data?.pagePath ?? "")
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{TYPE_LABEL[a.activity_type] ?? a.activity_type}</span>
                  {detail && <span className="text-xs text-muted-foreground ml-1.5 truncate">{detail}</span>}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{ago(a.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 시간대별 차트 */}
      {tab === "chart" && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">최근 24시간 활동</p>
          {stats.hourlyActivity.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
          ) : (
            <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
              {stats.hourlyActivity.map(({ hour, count }) => (
                <div key={hour} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="text-[9px] text-muted-foreground">{count}</span>
                  <div
                    className="bg-primary/70 hover:bg-primary rounded-sm w-7 transition-all"
                    style={{ height: `${Math.max(4, Math.round((count / maxHourly) * 96))}px` }}
                    title={`${formatHour(hour)}: ${count}건`}
                  />
                  <span className="text-[9px] text-muted-foreground">{formatHour(hour)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

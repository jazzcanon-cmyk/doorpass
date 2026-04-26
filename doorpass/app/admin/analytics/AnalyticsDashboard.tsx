"use client"

import { useState, useEffect } from "react"
import {
  Loader2, Search, Building2, MousePointer2, FileText,
  BarChart2, Clock, Activity, Users,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts"

interface PopularSearch  { query: string; search_count: number }
interface BuildingRank   { building_id: string; building_name: string; view_count: number; unique_users: number }
interface RecentActivity { id: number; action_type: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }
interface HourlyPoint    { hour: string; count: number }
interface DailyPoint     { date: string; search: number; view: number; click: number; total: number }
interface TypeCount      { type: string; count: number }
interface UserStat       { email: string; searches: number; clicks: number; views: number; total: number; lastActivity: string }

interface Stats {
  popularSearches:  PopularSearch[]
  popularBuildings: BuildingRank[]
  recentActivities: RecentActivity[]
  hourlyActivity:   HourlyPoint[]
  dailyActivity:    DailyPoint[]
  activityByType:   TypeCount[]
  userStats:        UserStat[]
  totalToday:       number
}

type Tab       = "searches" | "buildings" | "users" | "recent" | "chart"
type ChartView = "trend" | "hourly" | "heatmap"

const TYPE_LABEL: Record<string, string> = {
  search:        "검색",
  building_view: "건물 조회",
  post_view:     "게시글 조회",
  button_click:  "버튼 클릭",
  page_view:     "페이지 뷰",
}
const TYPE_ICON: Record<string, React.ElementType> = {
  search:        Search,
  building_view: Building2,
  post_view:     FileText,
  button_click:  MousePointer2,
  page_view:     Activity,
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60)    return "방금 전"
  if (s < 3600)  return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

function formatHour(iso: string) {
  const d = new Date(iso + ":00:00Z")
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
}

const CHART_COLORS = { search: "#818cf8", view: "#34d399", click: "#fb923c" }

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function SmallToggle({ options, value, onChange }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-0.5 text-[11px] w-fit">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2 py-0.5 rounded-md transition-all ${
            value === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function AnalyticsDashboard() {
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<Tab>("searches")
  const [chartView, setChartView] = useState<ChartView>("trend")

  useEffect(() => {
    fetch("/api/analytics/stats")
      .then(r => r.json())
      .then(d => {
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

  const maxHourly = Math.max(...stats.hourlyActivity.map(h => h.count), 1)

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: "searches",  label: "인기 검색어",  Icon: Search },
    { key: "buildings", label: "인기 건물",    Icon: Building2 },
    { key: "users",     label: "사용자",       Icon: Users },
    { key: "recent",    label: "최근 활동",    Icon: Clock },
    { key: "chart",     label: "차트",         Icon: BarChart2 },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
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
          <TabBtn key={key} active={tab === key} onClick={() => setTab(key)}>
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </TabBtn>
        ))}
      </div>

      {/* ── 인기 검색어 ── */}
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

      {/* ── 인기 건물 (고유 사용자 포함) ── */}
      {tab === "buildings" && (
        <div className="space-y-2">
          {stats.popularBuildings.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">건물 조회 데이터 없음</p>
          ) : stats.popularBuildings.map((b, i) => (
            <Card key={b.building_id ?? i}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.building_name || b.building_id || "-"}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round((b.view_count / (stats.popularBuildings[0]?.view_count ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{b.view_count}회</p>
                  {b.unique_users > 0 && (
                    <p className="text-[10px] text-muted-foreground/60">{b.unique_users}명</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── 사용자별 통계 ── */}
      {tab === "users" && (
        <div>
          {stats.userStats.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              사용자 데이터 없음
              <span className="block text-[11px] mt-1 text-muted-foreground/60">검색 시 이메일이 수집되면 표시됩니다</span>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">사용자</th>
                    <th className="text-center py-2 px-2 font-medium">검색</th>
                    <th className="text-center py-2 px-2 font-medium">조회</th>
                    <th className="text-center py-2 px-2 font-medium">클릭</th>
                    <th className="text-center py-2 px-2 font-medium">합계</th>
                    <th className="text-right py-2 px-3 font-medium">마지막 활동</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.userStats.map((u, i) => (
                    <tr key={u.email} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4 text-center">{i + 1}</span>
                          <span className="truncate max-w-[120px] font-medium" title={u.email}>
                            {u.email.split("@")[0]}
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2 tabular-nums">{u.searches}</td>
                      <td className="text-center py-2 px-2 tabular-nums">{u.views}</td>
                      <td className="text-center py-2 px-2 tabular-nums">{u.clicks}</td>
                      <td className="text-center py-2 px-2 font-bold tabular-nums">{u.total}</td>
                      <td className="text-right py-2 px-3 text-muted-foreground">{ago(u.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 최근 활동 ── */}
      {tab === "recent" && (
        <div className="space-y-0">
          {stats.recentActivities.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">활동 없음</p>
          ) : stats.recentActivities.map((a) => {
            const Icon = TYPE_ICON[a.action_type] ?? Activity
            const detail =
              a.action_type === "search"        ? `"${a.metadata?.query ?? ""}"` :
              a.action_type === "building_view" ? String(a.metadata?.buildingName ?? "") :
              a.action_type === "post_view"     ? String(a.metadata?.postTitle ?? "") :
              a.action_type === "button_click"  ? String(a.metadata?.buttonName ?? "") :
              String(a.metadata?.pagePath ?? "")
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{TYPE_LABEL[a.action_type] ?? a.action_type}</span>
                  {detail && <span className="text-xs text-muted-foreground ml-1.5 truncate">{detail}</span>}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{ago(a.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 차트 ── */}
      {tab === "chart" && (
        <div className="space-y-4">
          <SmallToggle
            options={[
              { key: "trend",   label: "7일 트렌드" },
              { key: "hourly",  label: "시간대별" },
              { key: "heatmap", label: "히트맵" },
            ]}
            value={chartView}
            onChange={v => setChartView(v as ChartView)}
          />

          {/* 7일 라인 차트 */}
          {chartView === "trend" && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-3">최근 7일 활동 유형별</p>
              {stats.dailyActivity.every(d => d.total === 0) ? (
                <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats.dailyActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="search" stroke={CHART_COLORS.search} name="검색"   strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="view"   stroke={CHART_COLORS.view}   name="조회"   strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="click"  stroke={CHART_COLORS.click}  name="클릭"   strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* 24시간 바 차트 */}
          {chartView === "hourly" && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-3">최근 24시간 활동</p>
              {stats.hourlyActivity.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.hourlyActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} interval={3} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={formatHour}
                    />
                    <Bar dataKey="count" name="활동" fill={CHART_COLORS.search} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* 히트맵 */}
          {chartView === "heatmap" && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-3">시간대별 활동 히트맵 (최근 24h)</p>
              {stats.hourlyActivity.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
              ) : (
                <div className="grid grid-cols-12 gap-1">
                  {Array.from({ length: 24 }, (_, h) => {
                    const iso = stats.hourlyActivity.find(a => {
                      const hour = new Date(a.hour + ":00:00Z").getUTCHours()
                      return hour === h
                    })
                    const count = iso?.count ?? 0
                    const intensity = Math.min(count / maxHourly, 1)
                    return (
                      <div key={h} className="flex flex-col items-center gap-0.5">
                        <div
                          className="w-full aspect-square rounded-sm transition-colors"
                          style={{ background: `rgba(129, 140, 248, ${0.1 + intensity * 0.9})` }}
                          title={`${h}시: ${count}건`}
                        />
                        {h % 4 === 0 && (
                          <span className="text-[8px] text-muted-foreground">{h}시</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

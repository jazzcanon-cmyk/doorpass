"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Building2, Users, Activity, Search,
  BarChart2, Upload, MessageSquare, Settings,
  ArrowRight, Loader2, TrendingUp, Eye, MapPin, RefreshCw, X, Trophy, Link2, Gift,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  buildings: number
  users: number
  todayActivities: number
  todaySearches: number
  todayPageViews: number
  todayBuildingViews: number
}

interface RecentActivity {
  id: number
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

interface ActivityLog {
  id: number
  action_type?: string
  metadata: Record<string, unknown>
  created_at: string
}

interface BuildingRow {
  id: number
  name: string
  address: string | null
  branch_id: string | null
  created_at: string
}

interface UserRow {
  id: number
  email: string | null
  name: string | null
  role: string | null
  managed_region: string | null
  created_at: string
}

interface PointRanking {
  rank: number
  email: string
  points: number
}

type PanelType = "pageview" | "search" | "building_view" | "activity" | "buildings" | "users" | null

interface PanelData {
  list?: ActivityLog[] | BuildingRow[] | UserRow[]
  topItems?: Array<Record<string, unknown>>
  hourlyData?: Array<{ hour: number; count: number }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  search: "검색",
  building_view: "건물 조회",
  post_view: "게시글 조회",
  button_click: "버튼 클릭",
  page_view: "페이지 뷰",
  slack_test: "Slack 테스트",
}

const TYPE_COLOR: Record<string, string> = {
  search: "bg-blue-500/20 text-blue-400",
  building_view: "bg-green-500/20 text-green-400",
  post_view: "bg-purple-500/20 text-purple-400",
  button_click: "bg-orange-500/20 text-orange-400",
  page_view: "bg-slate-500/20 text-slate-400",
  slack_test: "bg-pink-500/20 text-pink-400",
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"]

const PANEL_TITLES: Record<string, string> = {
  pageview: "방문 상세",
  search: "검색 상세",
  building_view: "건물 조회 상세",
  activity: "전체 활동",
  buildings: "등록 건물 상세",
  users: "등록 기사님 상세",
}

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  sub_admin: "부관리자",
  editor: "편집자",
  driver: "기사",
}

const QUICK_LINKS = [
  { href: "/admin/analytics", icon: BarChart2, label: "분석 대시보드", desc: "활동 통계 확인" },
  { href: "/admin/exchanges", icon: Gift, label: "상품권 교환 관리", desc: "신청 처리·반려" },
  { href: "/admin/buildings/import", icon: Upload, label: "건물 일괄 등록", desc: "Excel 파일 업로드" },
  { href: "/admin/users", icon: Users, label: "사용자 관리", desc: "제한·권한 관리" },
  { href: "/admin/slack", icon: MessageSquare, label: "Slack 메시지", desc: "알림 테스트" },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

function getEmailFromMeta(metadata: Record<string, unknown>): string | null {
  return typeof metadata?.userEmail === "string" ? metadata.userEmail : null
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
  onClick?: () => void
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value
  return (
    <div
      onClick={onClick}
      className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 transition-all duration-200 ${
        onClick
          ? "cursor-pointer hover:bg-white/[0.06] hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5"
          : "hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {onClick ? (
          <ArrowRight className="h-3.5 w-3.5 text-white/20" />
        ) : (
          <TrendingUp className="h-3.5 w-3.5 text-white/20" />
        )}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{display}</p>
      <p className="text-sm text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-white/30 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Panel Content Components ──────────────────────────────────────────────────

function PageViewPanelContent({ data }: { data: PanelData }) {
  const list = (data.list ?? []) as ActivityLog[]
  const hourlyData = data.hourlyData ?? []

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">시간대별 방문 현황</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="hour"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                tickFormatter={(v: number) => `${v}시`}
                interval={3}
              />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                formatter={(v: number) => [v, "방문"]}
                labelFormatter={(h: number) => `${h}시`}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">최근 방문 목록</h3>
        <div className="space-y-0">
          {list.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {list.map((row) => (
            <div key={row.id} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
              <span className="flex-1 text-xs text-white/60 truncate">
                {String(row.metadata?.pagePath ?? "—")}
              </span>
              <span className="text-[10px] text-white/30 truncate max-w-[110px]">
                {getEmailFromMeta(row.metadata) ?? "비회원"}
              </span>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(row.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SearchPanelContent({ data }: { data: PanelData }) {
  const list = (data.list ?? []) as ActivityLog[]
  const topItems = (data.topItems ?? []) as Array<{ term: string; count: number }>
  const maxCount = topItems[0]?.count ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">인기 검색어 TOP 10</h3>
        <div className="space-y-2.5">
          {topItems.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {topItems.map((item, i) => (
            <div key={item.term} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-white/30 w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70 truncate">{item.term}</span>
                  <span className="text-[10px] text-white/40 ml-2 flex-shrink-0">{item.count}회</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">최근 검색</h3>
        <div className="space-y-0">
          {list.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {list.map((row) => (
            <div key={row.id} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
              <span className="text-xs text-blue-400 truncate flex-1">
                &ldquo;{String(row.metadata?.query ?? "—")}&rdquo;
              </span>
              <span className="text-[10px] text-white/30 truncate max-w-[110px]">
                {getEmailFromMeta(row.metadata) ?? "비회원"}
              </span>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(row.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BuildingViewPanelContent({ data }: { data: PanelData }) {
  const list = (data.list ?? []) as ActivityLog[]
  const topItems = (data.topItems ?? []) as Array<{ name: string; count: number }>
  const maxCount = topItems[0]?.count ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">가장 많이 조회된 건물 TOP 10</h3>
        <div className="space-y-2.5">
          {topItems.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {topItems.map((item, i) => (
            <div key={item.name} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-white/30 w-5 text-right flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70 truncate">{item.name}</span>
                  <span className="text-[10px] text-white/40 ml-2 flex-shrink-0">{item.count}회</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">최근 조회</h3>
        <div className="space-y-0">
          {list.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {list.map((row) => (
            <div key={row.id} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
              <MapPin className="h-3 w-3 text-green-400 flex-shrink-0" />
              <span className="text-xs text-white/60 truncate flex-1">
                {String(row.metadata?.buildingName ?? "—")}
              </span>
              <span className="text-[10px] text-white/30 truncate max-w-[110px]">
                {getEmailFromMeta(row.metadata) ?? "비회원"}
              </span>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(row.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityPanelContent({ data }: { data: PanelData }) {
  const [filter, setFilter] = useState<string>("all")
  const list = (data.list ?? []) as ActivityLog[]

  const types = [...new Set(list.map((r) => r.action_type ?? "unknown"))]
  const filtered = filter === "all" ? list : list.filter((r) => r.action_type === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("all")}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            filter === "all" ? "bg-blue-500 text-white" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1]"
          }`}
        >
          전체
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              filter === t ? "bg-blue-500 text-white" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1]"
            }`}
          >
            {TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <div className="space-y-0">
        {filtered.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
        {filtered.map((row) => {
          const detail =
            row.action_type === "search"
              ? `"${row.metadata?.query ?? ""}"`
              : row.action_type === "building_view"
                ? String(row.metadata?.buildingName ?? "")
                : String(row.metadata?.pagePath ?? row.metadata?.buttonName ?? "")
          return (
            <div key={row.id} className="flex items-center gap-2 py-2 border-b border-white/[0.05] last:border-0">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${
                  TYPE_COLOR[row.action_type ?? ""] ?? "bg-white/10 text-white/50"
                }`}
              >
                {TYPE_LABEL[row.action_type ?? ""] ?? row.action_type ?? "—"}
              </span>
              <span className="flex-1 text-xs text-white/60 truncate">{detail || "—"}</span>
              <span className="text-[10px] text-white/30 truncate max-w-[80px]">
                {getEmailFromMeta(row.metadata) ?? "—"}
              </span>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(row.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BuildingsPanelContent({ data }: { data: PanelData }) {
  const list = (data.list ?? []) as BuildingRow[]
  const topItems = (data.topItems ?? []) as Array<{ branch_id: string; count: number }>

  return (
    <div className="space-y-6">
      {topItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">대리점별 건물 수</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topItems}
                  dataKey="count"
                  nameKey="branch_id"
                  cx="50%"
                  cy="45%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={2}
                >
                  {topItems.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v + "개", ""]}
                />
                <Legend
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{value || "미분류"}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">최근 등록 건물</h3>
        <div className="space-y-0">
          {list.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {list.map((b) => (
            <div key={b.id} className="flex items-start gap-2 py-2.5 border-b border-white/[0.05] last:border-0">
              <Building2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{b.name}</p>
                <p className="text-[10px] text-white/30 truncate">{b.address ?? "주소 없음"}</p>
              </div>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(b.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UsersPanelContent({ data }: { data: PanelData }) {
  const list = (data.list ?? []) as UserRow[]
  const topItems = (data.topItems ?? []) as unknown as PointRanking[]

  return (
    <div className="space-y-6">
      {topItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            포인트 랭킹 TOP 10
          </h3>
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={item.email} className="flex items-center gap-3 py-1">
                <span
                  className={`text-xs font-bold w-5 text-right flex-shrink-0 ${
                    item.rank === 1
                      ? "text-amber-400"
                      : item.rank === 2
                        ? "text-slate-300"
                        : item.rank === 3
                          ? "text-orange-400"
                          : "text-white/30"
                  }`}
                >
                  {item.rank}
                </span>
                <span className="flex-1 text-xs text-white/70 truncate">{item.email}</span>
                <span className="text-xs font-bold text-amber-400">{item.points.toLocaleString()}P</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">전체 기사 목록 ({list.length}명)</h3>
        <div className="space-y-0">
          {list.length === 0 && <p className="text-xs text-white/30 text-center py-4">데이터 없음</p>}
          {list.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-2.5 border-b border-white/[0.05] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{u.name ?? "(이름 없음)"}</p>
                <p className="text-[10px] text-white/30 truncate">{u.email ?? "—"}</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50 flex-shrink-0">
                {ROLE_LABEL[u.role ?? ""] ?? u.role ?? "—"}
              </span>
              <span className="text-[10px] text-white/25 flex-shrink-0">{ago(u.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Detail Slide Panel ───────────────────────────────────────────────────────

function DetailPanel({
  type,
  data,
  loading,
  onClose,
}: {
  type: PanelType
  data: PanelData
  loading: boolean
  onClose: () => void
}) {
  const isOpen = type !== null

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Slide panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-slate-900 border-l border-white/[0.08] shadow-2xl flex flex-col translate-x-0 transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {type ? PANEL_TITLES[type] : ""}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <>
              {type === "pageview" && <PageViewPanelContent data={data} />}
              {type === "search" && <SearchPanelContent data={data} />}
              {type === "building_view" && <BuildingViewPanelContent data={data} />}
              {type === "activity" && <ActivityPanelContent data={data} />}
              {type === "buildings" && <BuildingsPanelContent data={data} />}
              {type === "users" && <UsersPanelContent data={data} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Dashboard Data Loader ────────────────────────────────────────────────────

async function loadDashboardData() {
  const [ovRes, stRes] = await Promise.all([
    fetch("/api/admin/overview"),
    fetch("/api/analytics/stats"),
  ])
  const ov = ovRes.ok ? ((await ovRes.json()) as Overview) : null
  const stats = stRes.ok ? await stRes.json() : {}
  return {
    overview: ov,
    activities: ((stats.recentActivities ?? []) as RecentActivity[]).slice(0, 12),
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liveHint, setLiveHint] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState<number | null>(null)

  const [openPanel, setOpenPanel] = useState<PanelType>(null)
  const [panelData, setPanelData] = useState<PanelData>({})
  const [panelLoading, setPanelLoading] = useState(false)

  const refresh = useCallback(async (silent?: boolean) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const { overview: ov, activities: act } = await loadDashboardData()
      setOverview(ov)
      setActivities(act)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const openDetail = useCallback(async (type: PanelType) => {
    if (!type) return
    setOpenPanel(type)
    setPanelData({})
    setPanelLoading(true)
    try {
      const res = await fetch(`/api/admin/dashboard/detail?type=${type}`)
      if (res.ok) {
        const d = (await res.json()) as PanelData
        setPanelData(d)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPanelLoading(false)
    }
  }, [])

  const closePanel = useCallback(() => {
    setOpenPanel(null)
    setPanelData({})
  }, [])

  useEffect(() => {
    void fetch("/api/admin/users?filter=referral")
      .then((r) => r.json())
      .then((d: { users?: unknown[] }) => setReferralCount(d.users?.length ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(true), 45_000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-activities")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_activities" },
        (payload) => {
          const row = payload.new as RecentActivity
          if (!row?.id) return
          setActivities((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev
            return [row, ...prev].slice(0, 20)
          })
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveHint("실시간 연결됨")
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setLiveHint("실시간 미지원 — 자동 새로고침(45초)")
      })

    return () => { void supabase.removeChannel(channel) }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">대시보드</h1>
            <p className="text-sm text-white/40 mt-1">DoorPass 관리자 현황</p>
          </div>
          <div className="flex items-center gap-3">
            {liveHint && (
              <span className="text-[11px] text-emerald-400/80 hidden sm:inline">{liveHint}</span>
            )}
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.06] border border-white/[0.1] text-white/70 hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              새로고침
            </button>
          </div>
        </div>

        {/* Stats — Today */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={Eye}
            label="방문(페이지뷰)"
            value={overview?.todayPageViews ?? "—"}
            sub="최근 24시간"
            color="bg-slate-500/20 text-slate-300"
            onClick={() => void openDetail("pageview")}
          />
          <StatCard
            icon={Search}
            label="검색"
            value={overview?.todaySearches ?? "—"}
            sub="최근 24시간"
            color="bg-orange-500/20 text-orange-400"
            onClick={() => void openDetail("search")}
          />
          <StatCard
            icon={MapPin}
            label="건물 조회"
            value={overview?.todayBuildingViews ?? "—"}
            sub="최근 24시간"
            color="bg-green-500/20 text-green-400"
            onClick={() => void openDetail("building_view")}
          />
          <StatCard
            icon={Activity}
            label="전체 활동"
            value={overview?.todayActivities ?? "—"}
            sub="최근 24시간"
            color="bg-purple-500/20 text-purple-400"
            onClick={() => void openDetail("activity")}
          />
        </div>

        {/* Stats — Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={Building2}
            label="등록 건물"
            value={overview?.buildings ?? "—"}
            sub="전체 누적"
            color="bg-blue-500/20 text-blue-400"
            onClick={() => void openDetail("buildings")}
          />
          <StatCard
            icon={Users}
            label="등록 기사님"
            value={overview?.users ?? "—"}
            sub="등록·이용 가능"
            color="bg-indigo-500/20 text-indigo-400"
            onClick={() => void openDetail("users")}
          />
          <StatCard
            icon={Link2}
            label="🔗 자동승인 회원"
            value={referralCount ?? "—"}
            sub="추천 링크 가입"
            color="bg-emerald-500/20 text-emerald-400"
          />
        </div>

        {/* Recent activity + Quick links */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">최근 활동</h2>
              <Link
                href="/admin/analytics"
                className="text-xs text-white/40 hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                전체 보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {activities.length === 0 ? (
              <p className="text-center py-8 text-sm text-white/30">활동 데이터 없음</p>
            ) : (
              <div className="space-y-0 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                {activities.map((a) => {
                  const detail =
                    a.action_type === "search"
                      ? `"${a.metadata?.query ?? ""}"`
                      : a.action_type === "building_view"
                        ? String(a.metadata?.buildingName ?? "")
                        : a.action_type === "post_view"
                          ? String(a.metadata?.postTitle ?? "")
                          : a.action_type === "slack_test"
                            ? String((a.metadata as { scenario?: string })?.scenario ?? "test")
                            : String(a.metadata?.pagePath ?? a.metadata?.buttonName ?? "")
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${
                          TYPE_COLOR[a.action_type] ?? "bg-white/10 text-white/50"
                        }`}
                      >
                        {TYPE_LABEL[a.action_type] ?? a.action_type}
                      </span>
                      <span className="flex-1 text-xs text-white/60 truncate">{detail || "—"}</span>
                      <span className="text-[10px] text-white/25 flex-shrink-0">{ago(a.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">빠른 메뉴</h2>
            {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-[11px] text-white/40">{desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-blue-400 transition-colors" />
              </Link>
            ))}

            <Link
              href="/admin/settings"
              className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-all group"
            >
              <Settings className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">⚙️ 설정</span>
              <ArrowRight className="h-3 w-3 text-white/20 ml-auto group-hover:text-white/40 transition-colors" />
            </Link>

            <Link
              href="/"
              className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-all group"
            >
              <MapPin className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
              <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">메인 앱으로</span>
              <ArrowRight className="h-3 w-3 text-white/20 ml-auto group-hover:text-white/40 transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      <DetailPanel
        type={openPanel}
        data={panelData}
        loading={panelLoading}
        onClose={closePanel}
      />
    </>
  )
}

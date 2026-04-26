"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Building2, Users, Activity, Search,
  BarChart2, Upload, MessageSquare, Settings,
  ArrowRight, Loader2, TrendingUp, Eye, MapPin, RefreshCw,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"

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

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  const display = typeof value === "number" ? value.toLocaleString() : value
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-white/20" />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{display}</p>
      <p className="text-sm text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-white/30 mt-1">{sub}</p>}
    </div>
  )
}

const QUICK_LINKS = [
  { href: "/admin/analytics", icon: BarChart2, label: "분석 대시보드", desc: "활동 통계 확인" },
  { href: "/admin/buildings/import", icon: Upload, label: "건물 일괄 등록", desc: "Excel 파일 업로드" },
  { href: "/admin/users", icon: Users, label: "사용자 관리", desc: "제한·권한 관리" },
  { href: "/admin/slack", icon: MessageSquare, label: "Slack 메시지", desc: "알림 테스트" },
] as const

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

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liveHint, setLiveHint] = useState<string | null>(null)

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

  useEffect(() => {
    void refresh()
  }, [refresh])

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

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">대시보드</h1>
          <p className="text-sm text-white/40 mt-1">신정대리점 관리자 현황</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Eye}
          label="방문(페이지뷰)"
          value={overview?.todayPageViews ?? "—"}
          sub="최근 24시간"
          color="bg-slate-500/20 text-slate-300"
        />
        <StatCard
          icon={Search}
          label="검색"
          value={overview?.todaySearches ?? "—"}
          sub="최근 24시간"
          color="bg-orange-500/20 text-orange-400"
        />
        <StatCard
          icon={MapPin}
          label="건물 조회"
          value={overview?.todayBuildingViews ?? "—"}
          sub="최근 24시간"
          color="bg-green-500/20 text-green-400"
        />
        <StatCard
          icon={Activity}
          label="전체 활동"
          value={overview?.todayActivities ?? "—"}
          sub="최근 24시간"
          color="bg-purple-500/20 text-purple-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={Building2}
          label="등록 건물"
          value={overview?.buildings ?? "—"}
          sub="전체 누적"
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          icon={Users}
          label="등록 기사님"
          value={overview?.users ?? "—"}
          sub="등록·이용 가능"
          color="bg-indigo-500/20 text-indigo-400"
        />
      </div>

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
            <div className="space-y-1 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
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
  )
}

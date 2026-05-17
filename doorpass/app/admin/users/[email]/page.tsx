"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, User, Ban, ShieldCheck,
  Filter, Calendar, RefreshCw,
} from "lucide-react"

interface AuthUser {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  provider: string
  created_at: string
  last_sign_in_at: string | null
  role: string | null
  is_active: boolean | null
  is_registered: boolean
  approved_id: number | null
  is_blocked: boolean
  blocked_reason: string | null
}

interface ActivityLog {
  id: string
  user_email: string
  activity_type: string
  activity_data: Record<string, unknown>
  page_url: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

const ACTIVITY_META: Record<string, { icon: string; label: string; color: string }> = {
  login:           { icon: "🔑", label: "로그인",       color: "text-blue-400" },
  building_view:   { icon: "🏢", label: "건물 조회",    color: "text-green-400" },
  post_create:     { icon: "✍️", label: "게시글 작성",  color: "text-purple-400" },
  comment_create:  { icon: "💬", label: "댓글 작성",    color: "text-yellow-400" },
  like:            { icon: "❤️", label: "좋아요",       color: "text-rose-400" },
  calendar_memo:   { icon: "📅", label: "캘린더 메모",  color: "text-cyan-400" },
  notice_view:     { icon: "📣", label: "공지 조회",    color: "text-orange-400" },
  resource_view:   { icon: "📁", label: "자료 조회",    color: "text-indigo-400" },
  search:          { icon: "🔎", label: "검색",         color: "text-sky-400" },
  page_view:       { icon: "📄", label: "페이지 방문",  color: "text-zinc-400" },
  password_decrypt:{ icon: "🔓", label: "비밀번호 확인", color: "text-emerald-400" },
  logout:          { icon: "👋", label: "로그아웃",      color: "text-amber-400" },
}

const ACTIVITY_TYPES = Object.entries(ACTIVITY_META).map(([k, v]) => ({ key: k, label: v.label }))

function activityDetail(log: ActivityLog): string {
  const d = log.activity_data
  switch (log.activity_type) {
    case "login":          return `방식: ${String(d.provider ?? "unknown")}`
    case "building_view": {
      const name = String(d.building_name ?? d.building_name ?? "")
      const addr = String(d.building_address ?? "")
      if (name) return addr ? `${name} · ${addr}` : name
      return d.count ? `${String(d.count)}개 건물` : "건물 조회"
    }
    case "post_create":    return `"${String(d.title ?? "").slice(0, 40)}"`
    case "comment_create": return `"${String(d.content ?? "").slice(0, 40)}"`
    case "like":           return `댓글 #${String(d.comment_id ?? "")} ${d.liked ? "좋아요" : "취소"}`
    case "calendar_memo":  return `"${String(d.content ?? "").slice(0, 40)}"`
    case "notice_view":    return `${String(d.count ?? "")}개 조회`
    case "resource_view":  return `${String(d.count ?? "")}개 조회`
    case "search":         return `"${String(d.keyword ?? "")}" · ${String(d.results_count ?? 0)}건`
    case "page_view":      return String(log.page_url ?? d.page_url ?? "")
    case "password_decrypt": return `${String(d.building_name ?? d.building_id ?? "")}`
    case "logout":         return "세션 종료"
    default:               return ""
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function UserDetailPage() {
  const params = useParams()
  const email = decodeURIComponent(String(params.email))

  const [user, setUser] = useState<AuthUser | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [offset, setOffset] = useState(0)
  const [filterType, setFilterType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [blocking, setBlocking] = useState(false)
  const LIMIT = 30

  const loadUser = useCallback(async () => {
    setLoadingUser(true)
    try {
      const res = await fetch("/api/admin/auth-users")
      const { users } = (await res.json()) as { users: AuthUser[] }
      setUser(users?.find((u) => u.email === email) ?? null)
    } catch {
      toast.error("사용자 정보를 불러오지 못했습니다.")
    } finally {
      setLoadingUser(false)
    }
  }, [email])

  const loadLogs = useCallback(async (off: number = 0) => {
    setLoadingLogs(true)
    try {
      const q = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
      if (filterType) q.set("activity_type", filterType)
      if (startDate)  q.set("start_date", startDate)
      if (endDate)    q.set("end_date", endDate)
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}/activity?${q}`)
      const data = (await res.json()) as { logs: ActivityLog[]; total: number }
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setOffset(off)
    } catch {
      toast.error("활동 로그를 불러오지 못했습니다.")
    } finally {
      setLoadingLogs(false)
    }
  }, [email, filterType, startDate, endDate])

  useEffect(() => { void loadUser() }, [loadUser])
  useEffect(() => { void loadLogs(0) }, [loadLogs])

  const toggleBlock = async () => {
    if (!user?.approved_id) return
    setBlocking(true)
    try {
      await fetch(`/api/admin/users/${user.approved_id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: !user.is_blocked }),
      })
      toast.success(user.is_blocked ? "차단이 해제되었습니다." : "사용자가 차단되었습니다.")
      void loadUser()
    } catch {
      toast.error("처리에 실패했습니다.")
    } finally {
      setBlocking(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> 사용자 목록
        </Link>
      </div>

      {/* 사용자 정보 */}
      {loadingUser ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
      ) : user ? (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/10 flex-shrink-0">
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt="" width={48} height={48} className="rounded-xl object-cover" unoptimized />
              ) : (
                <User className="h-5 w-5 text-white/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-base font-bold ${user.is_blocked ? "text-white/40 line-through" : "text-white"}`}>
                  {user.name ?? email}
                </span>
                {user.is_blocked && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">🚫 차단됨</span>
                )}
                {user.role && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === "admin" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                  }`}>
                    {user.role === "admin" ? "관리자" : "일반"}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/50 mt-0.5">{email}</p>
              <div className="flex gap-4 mt-2 text-xs text-white/30">
                <span>가입: {formatDate(user.created_at)}</span>
                <span>최근 로그인: {formatDate(user.last_sign_in_at)}</span>
              </div>
            </div>
            {user.approved_id && user.role !== "admin" && (
              <button
                type="button"
                onClick={() => void toggleBlock()}
                disabled={blocking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 ${
                  user.is_blocked
                    ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                }`}
              >
                {blocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : user.is_blocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                {user.is_blocked ? "차단 해제" : "차단"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-white/40">사용자를 찾을 수 없습니다.</div>
      )}

      {/* 필터 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">필터</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-blue-500/50"
          >
            <option value="">전체 활동</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="시작일"
            className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="종료일"
            className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* 활동 로그 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            활동 로그 <span className="text-white/40 font-normal">({total}건)</span>
          </h2>
          <button
            type="button"
            onClick={() => void loadLogs(0)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {loadingLogs ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-8">활동 기록이 없습니다.</p>
        ) : (
          <>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-white/[0.06]" />
              <ul className="space-y-1">
                {logs.map((log) => {
                  const meta = ACTIVITY_META[log.activity_type] ?? { icon: "•", label: log.activity_type, color: "text-white/50" }
                  const detail = activityDetail(log)
                  return (
                    <li key={log.id} className="flex items-start gap-4 pl-2 py-2.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                      <span className="w-6 h-6 flex items-center justify-center text-sm flex-shrink-0 relative z-10">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                          {detail && <span className="text-xs text-white/50 truncate max-w-[260px]">{detail}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/25">
                          <span>{formatDate(log.created_at)}</span>
                          {log.ip_address && <span>· {log.ip_address}</span>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* 페이지네이션 */}
            {total > LIMIT && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => void loadLogs(offset - LIMIT)}
                  className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 hover:bg-white/5 transition-all"
                >
                  이전
                </button>
                <span className="text-xs text-white/30">
                  {offset + 1} – {Math.min(offset + LIMIT, total)} / {total}
                </span>
                <button
                  type="button"
                  disabled={offset + LIMIT >= total}
                  onClick={() => void loadLogs(offset + LIMIT)}
                  className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 hover:bg-white/5 transition-all"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

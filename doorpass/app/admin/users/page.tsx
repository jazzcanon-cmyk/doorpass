"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-client"
import {
  UserPlus,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Crown,
  User,
  Loader2,
  Clock,
  CheckCircle2,
  Ban,
  Users,
  Settings2,
} from "lucide-react"

interface ApprovedUser {
  id: number
  kakao_id: string | null
  name: string
  phone: string | null
  email: string | null
  role: "admin" | "driver"
  is_active: boolean
  created_at: string
}

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
  return data as T
}

function formatDate(iso: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function providerLabel(provider: string) {
  if (provider === "kakao") return { label: "카카오", cls: "bg-yellow-500/20 text-yellow-300" }
  if (provider === "google") return { label: "구글", cls: "bg-blue-500/20 text-blue-300" }
  return { label: provider, cls: "bg-white/10 text-white/50" }
}

export default function UsersPage() {
  const [tab, setTab] = useState<"all" | "manage">("all")

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "all"
              ? "bg-blue-600 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <Users className="h-4 w-4" />
          전체 로그인 회원
        </button>
        <button
          type="button"
          onClick={() => setTab("manage")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "manage"
              ? "bg-blue-600 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          등록 관리
        </button>
      </div>

      {tab === "all" ? <AllUsersTab /> : <ManageTab />}
    </div>
  )
}

function AllUsersTab() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [blockModal, setBlockModal] = useState<{ user: AuthUser } | null>(null)
  const [blockReason, setBlockReason] = useState("")
  const [blocking, setBlocking] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: list } = await api<{ users: AuthUser[] }>("/api/admin/auth-users")
      setUsers(list ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email ?? "")
    })
  }, [])

  const openBlock = (u: AuthUser) => { setBlockModal({ user: u }); setBlockReason("") }
  const closeBlock = () => { setBlockModal(null); setBlockReason("") }

  const submitBlock = async () => {
    if (!blockModal) return
    const { user: target } = blockModal
    if (!target.approved_id) return
    if (!blockReason.trim()) { toast.error("차단 사유를 입력해주세요."); return }
    setBlocking(true)
    try {
      await api(`/api/admin/users/${target.approved_id}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked: true, reason: blockReason.trim() }),
      })
      toast.success(`${target.name ?? target.email ?? "사용자"}님이 차단되었습니다.`)
      closeBlock()
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "차단 실패")
    } finally {
      setBlocking(false)
    }
  }

  const unblock = async (u: AuthUser) => {
    if (!u.approved_id) return
    try {
      await api(`/api/admin/users/${u.approved_id}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked: false }),
      })
      toast.success(`${u.name ?? u.email ?? "사용자"}님 차단이 해제되었습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "차단 해제 실패")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    )
  }

  const registered = users.filter((u) => u.is_registered)
  const unregistered = users.filter((u) => !u.is_registered)

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm text-white/40">
          전체 {users.length}명 · 등록됨 {registered.length}명 · 미등록 {unregistered.length}명
        </p>
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="text-sm text-white/30 text-center py-10 rounded-xl border border-dashed border-white/10">
              로그인한 회원이 없습니다.
            </p>
          )}
          {users.map((u) => (
            <AuthUserRow
              key={u.id}
              u={u}
              currentUserEmail={currentUserEmail}
              onBlock={() => openBlock(u)}
              onUnblock={() => void unblock(u)}
            />
          ))}
        </div>
      </div>

      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/[0.1] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">사용자 차단</h3>
            <p className="text-sm text-white/50">
              <span className="text-white font-medium">
                {blockModal.user.name ?? blockModal.user.email ?? "이 사용자"}
              </span>
              님을 차단합니다. 차단 후 로그인 시 차단 페이지로 이동합니다.
            </p>
            <div>
              <label className="text-xs text-white/40 mb-1 block">차단 사유 (필수)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="예: 악성 댓글, 부적절한 게시물 등"
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-white/30 resize-none focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeBlock}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submitBlock()}
                disabled={blocking || !blockReason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
              >
                {blocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                차단
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function renderBlockAction(
  u: AuthUser,
  currentUserEmail: string,
  onBlock: () => void,
  onUnblock: () => void
) {
  if (u.role === "admin") {
    return (
      <span className="text-[10px] px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        관리자
      </span>
    )
  }
  if (currentUserEmail && u.email === currentUserEmail) {
    return (
      <span className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
        본인
      </span>
    )
  }
  if (u.is_blocked) {
    return (
      <button
        type="button"
        onClick={onUnblock}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-green-500/10 hover:text-green-400 border border-white/10"
      >
        <ShieldCheck className="h-3 w-3" /> 해제
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onBlock}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
    >
      <Ban className="h-3 w-3" /> 차단
    </button>
  )
}

function AuthUserRow({
  u,
  currentUserEmail,
  onBlock,
  onUnblock,
}: {
  u: AuthUser
  currentUserEmail: string
  onBlock: () => void
  onUnblock: () => void
}) {
  const prov = providerLabel(u.provider)

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${
        u.is_blocked
          ? "bg-red-500/5 border-red-500/20 opacity-70"
          : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
      }`}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.06] border border-white/10">
        {u.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <User className="h-4 w-4 text-white/40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${u.is_blocked ? "text-white/40 line-through" : "text-white"}`}>
            {u.name ?? u.email ?? u.id}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prov.cls}`}>
            {prov.label}
          </span>
          {u.is_blocked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400 flex items-center gap-1">
              🚫 차단됨
            </span>
          )}
          {u.is_registered && !u.is_blocked ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400">
              등록됨
            </span>
          ) : !u.is_registered ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/5 text-white/30">
              미등록
            </span>
          ) : null}
          {u.is_registered && u.role && !u.is_blocked && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                u.role === "admin" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {u.role === "admin" ? "관리자" : "일반"}
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-0.5 flex-wrap">
          {u.email && <span className="text-xs text-white/40 truncate max-w-[220px]">{u.email}</span>}
          {u.is_blocked && u.blocked_reason && (
            <span className="text-xs text-red-400/70 truncate max-w-[200px]">사유: {u.blocked_reason}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[11px] text-white/25">마지막 로그인</span>
          <span className="text-[11px] text-white/50">{formatDate(u.last_sign_in_at)}</span>
          <span className="text-[10px] text-white/20 mt-0.5">가입 {formatDate(u.created_at)}</span>
        </div>
        {renderBlockAction(u, currentUserEmail, onBlock, onUnblock)}
      </div>
    </div>
  )
}

function ManageTab() {
  const [users, setUsers] = useState<ApprovedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: list } = await api<{ users: ApprovedUser[] }>("/api/admin/users")
      setUsers(list ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!name.trim()) {
      toast.error("이름을 입력해주세요.")
      return
    }
    setAdding(true)
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      })
      toast.success(`${name.trim()}님이 추가되었습니다.`)
      setName("")
      setPhone("")
      setEmail("")
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "추가 실패")
    } finally {
      setAdding(false)
    }
  }

  const approve = async (id: number, n: string) => {
    try {
      await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, action: "approve" }) })
      toast.success(`${n}님을 승인했습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류")
    }
  }

  const reject = async (id: number, n: string) => {
    try {
      await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, action: "reject" }) })
      toast.success(`${n}님을 거부(비활성)했습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류")
    }
  }

  const toggleRole = async (id: number, role: string, n: string) => {
    const nextRole = role === "admin" ? "user" : "admin"
    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "set_role", role: nextRole }),
      })
      toast.success(`${n}님 권한: ${nextRole === "admin" ? "관리자" : "일반"}`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "권한 변경 실패")
    }
  }

  const del = async (id: number, n: string) => {
    if (!confirm(`${n}님을 삭제하시겠습니까?`)) return
    try {
      await api(`/api/admin/users?id=${id}`, { method: "DELETE" })
      toast.success(`${n}님이 삭제되었습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    }
  }

  const pending = users.filter((u) => !u.is_active)
  const approved = users.filter((u) => u.is_active)

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/40 -mt-4">
        사용 제한(승인 대기) {pending.length}명 · 이용 가능 {approved.length}명 · 전체 {users.length}명
      </p>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-blue-400" /> 새 기사님 추가
        </h2>
        <div className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              placeholder="이름 (필수)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void add()}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-500/50"
            />
            <input
              placeholder="전화번호 (선택)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-500/50"
            />
            <input
              placeholder="이메일 (선택, 구글 연동)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <button
            type="button"
            onClick={() => void add()}
            disabled={adding}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium w-full sm:w-auto"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            추가
          </button>
        </div>
        <p className="text-xs text-white/30 mt-3">
          기본은 누구나 로그인 후 이용할 수 있습니다. 여기서 추가하면「사용 제한」목록에 들어가며, 승인하기 전까지는 로그인해도 이용할 수 없습니다. 이메일·이름은 카카오/구글 계정과 맞춰 주세요.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" /> 사용 제한 · 승인 대기 ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  mode="pending"
                  onApprove={() => void approve(u.id, u.name)}
                  onReject={() => void reject(u.id, u.name)}
                  onRole={() => void toggleRole(u.id, u.role, u.name)}
                  onDelete={() => void del(u.id, u.name)}
                />
              ))}
              {pending.length === 0 && (
                <p className="text-sm text-white/30 text-center py-6 rounded-xl border border-dashed border-white/10">
                  사용 제한 중인 계정이 없습니다. 문제가 있는 경우에만「추가」로 넣고 승인하면 다시 이용할 수 있습니다.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> 등록됨 · 이용 가능 ({approved.length})
            </h2>
            <div className="space-y-2">
              {approved.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  mode="approved"
                  onApprove={() => void approve(u.id, u.name)}
                  onReject={() => void reject(u.id, u.name)}
                  onRole={() => void toggleRole(u.id, u.role, u.name)}
                  onDelete={() => void del(u.id, u.name)}
                />
              ))}
              {approved.length === 0 && (
                <p className="text-sm text-white/30 text-center py-6">등록된 행이 없습니다</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function UserRow({
  u,
  mode,
  onApprove,
  onReject,
  onRole,
  onDelete,
}: {
  u: ApprovedUser
  mode: "pending" | "approved"
  onApprove: () => void
  onReject: () => void
  onRole: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all ${
        u.is_active
          ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
          : "bg-amber-500/5 border-amber-500/15"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          u.role === "admin"
            ? "bg-yellow-500/20 border border-yellow-500/30"
            : "bg-blue-500/10 border border-blue-500/20"
        }`}
      >
        {u.role === "admin" ? (
          <Crown className="h-4 w-4 text-yellow-400" />
        ) : (
          <User className="h-4 w-4 text-blue-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{u.name}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              u.role === "admin" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {u.role === "admin" ? "관리자" : "일반"}
          </span>
          {!u.kakao_id && !u.email && u.role !== "admin" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">미연결</span>
          )}
        </div>
        <div className="flex gap-3 mt-0.5 flex-wrap">
          {u.phone && <span className="text-xs text-white/40">{u.phone}</span>}
          {u.email && <span className="text-xs text-white/30 truncate max-w-[200px]">{u.email}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {mode === "pending" && u.role !== "admin" && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/25"
            >
              <ShieldCheck className="h-3 w-3" /> 승인
            </button>
            <button
              type="button"
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-red-500/10 hover:text-red-400 border border-white/10"
            >
              <Ban className="h-3 w-3" /> 거부
            </button>
          </>
        )}
        {mode === "approved" && u.role !== "admin" && (
          <button
            type="button"
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
          >
            <ShieldOff className="h-3 w-3" /> 차단
          </button>
        )}
        {u.role !== "admin" && (
          <button
            type="button"
            onClick={onRole}
            className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-500/10 border border-white/10"
            title="관리자 ↔ 일반"
          >
            <Crown className="h-3.5 w-3.5" />
          </button>
        )}
        {u.role === "admin" && (
          <button
            type="button"
            onClick={onRole}
            className="p-1.5 rounded-lg text-yellow-400/80 hover:bg-yellow-500/10 border border-yellow-500/20"
            title="일반으로 변경"
          >
            <Crown className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-white/10"
          title="삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

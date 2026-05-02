"use client"
import { User, ShieldCheck, Ban, Crown, RotateCcw } from "lucide-react"
import { formatDate, providerLabel } from "@/lib/admin-api"
import type { AuthUser } from "@/types/admin-users"

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  sub_admin: "부관리자",
  editor: "편집자",
  driver: "일반",
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-yellow-500/20 text-yellow-400",
  sub_admin: "bg-purple-500/20 text-purple-300",
  editor: "bg-emerald-500/20 text-emerald-300",
  driver: "bg-blue-500/20 text-blue-400",
}

function BlockAction({ u, currentUserEmail, onBlock, onUnblock }: {
  u: AuthUser
  currentUserEmail: string
  onBlock: () => void
  onUnblock: () => void
}) {
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

interface AuthUserRowProps {
  u: AuthUser
  currentUserEmail: string
  onBlock: () => void
  onUnblock: () => void
  onDetail: () => void
  onAssignRole?: () => void
  onReset?: () => void
}

export function AuthUserRow({ u, currentUserEmail, onBlock, onUnblock, onDetail, onAssignRole, onReset }: AuthUserRowProps) {
  const prov = providerLabel(u.provider)
  const roleKey = u.role && (u.role === "admin" || u.role === "sub_admin" || u.role === "editor")
    ? u.role
    : "driver"
  const roleLabel = ROLE_LABEL[roleKey]
  const roleBadge = ROLE_BADGE[roleKey]

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
        u.is_blocked
          ? "bg-red-500/5 border-red-500/20 opacity-70"
          : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
      }`}
      onClick={onDetail}
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
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleBadge}`}>
              {roleLabel}
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

      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[11px] text-white/25">마지막 로그인</span>
          <span className="text-[11px] text-white/50">{formatDate(u.last_sign_in_at)}</span>
          <span className="text-[10px] text-white/20 mt-0.5">가입 {formatDate(u.created_at)}</span>
        </div>
        {onAssignRole && (u.approved_id != null || !!u.email) && (
          <button
            type="button"
            onClick={onAssignRole}
            title="역할 변경"
            className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-500/10 border border-white/10"
          >
            <Crown className="h-3.5 w-3.5" />
          </button>
        )}
        <BlockAction u={u} currentUserEmail={currentUserEmail} onBlock={onBlock} onUnblock={onUnblock} />
        {u.role !== 'admin' && u.email !== currentUserEmail && onReset && (
          <button
            type='button'
            onClick={onReset}
            className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20'
          >
            <RotateCcw className='h-3 w-3' /> 초기화
          </button>
        )}
      </div>
    </div>
  )
}

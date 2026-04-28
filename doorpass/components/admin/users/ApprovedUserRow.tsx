"use client"
import { Crown, User, ShieldCheck, ShieldOff, Ban, Trash2 } from "lucide-react"
import type { ApprovedUser, ApprovedRowMode } from "@/types/admin-users"

interface ApprovedUserRowProps {
  u: ApprovedUser
  mode: ApprovedRowMode
  onApprove: () => void
  onReject: () => void
  onRole: () => void
  onDelete: () => void
}

export function ApprovedUserRow({ u, mode, onApprove, onReject, onRole, onDelete }: ApprovedUserRowProps) {
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

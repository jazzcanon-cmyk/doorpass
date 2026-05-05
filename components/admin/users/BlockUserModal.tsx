"use client"
import { Loader2, Ban } from "lucide-react"
import type { AuthUser } from "@/types/admin-users"

interface BlockUserModalProps {
  user: AuthUser
  reason: string
  blocking: boolean
  onReasonChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function BlockUserModal({ user, reason, blocking, onReasonChange, onClose, onSubmit }: BlockUserModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">사용자 차단</h3>
        <p className="text-sm text-white/50">
          <span className="text-white font-medium">
            {user.name ?? user.email ?? "이 사용자"}
          </span>
          님을 차단합니다. 차단 후 로그인 시 차단 페이지로 이동합니다.
        </p>
        <div>
          <label className="text-xs text-white/40 mb-1 block">차단 사유 (필수)</label>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="예: 악성 댓글, 부적절한 게시물 등"
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-white/30 resize-none focus:outline-none focus:border-red-500/50"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={blocking || !reason.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
          >
            {blocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
            차단
          </button>
        </div>
      </div>
    </div>
  )
}

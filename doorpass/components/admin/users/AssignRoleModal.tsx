"use client"
import { useState, useEffect } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import type { ApprovedUser } from "@/types/admin-users"

type Role = "admin" | "sub_admin" | "editor" | "driver"

const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: "admin",     label: "관리자",     desc: "모든 권한" },
  { key: "sub_admin", label: "부관리자",   desc: "엑셀 업로드 + 사용자 승인" },
  { key: "editor",    label: "편집자",     desc: "건물 정보 수정 가능" },
  { key: "driver",    label: "일반 사용자", desc: "조회만 가능" },
]

interface AssignRoleModalProps {
  user: ApprovedUser
  saving: boolean
  onClose: () => void
  onSubmit: (role: Role, managedRegion: string | null) => void
}

export function AssignRoleModal({ user, saving, onClose, onSubmit }: AssignRoleModalProps) {
  const initialRole: Role =
    user.role === "admin" || user.role === "sub_admin" || user.role === "editor" || user.role === "driver"
      ? user.role
      : "driver"
  const [role, setRole] = useState<Role>(initialRole)
  const [managedRegion, setManagedRegion] = useState(user.managed_region ?? "")

  useEffect(() => {
    setRole(initialRole)
    setManagedRegion(user.managed_region ?? "")
  }, [user.id, user.managed_region, initialRole])

  const submit = () => {
    if (role === "sub_admin" && !managedRegion.trim()) {
      // 관리 지역은 부관리자에 한해 권장 (없어도 허용)
    }
    onSubmit(role, role === "sub_admin" ? managedRegion.trim() || null : null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          역할 지정
        </h3>
        <p className="text-sm text-white/50">
          <span className="text-white font-medium">{user.name}</span>
          {user.email ? <span className="text-white/40"> ({user.email})</span> : null}
        </p>

        <div className="space-y-1.5">
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                role === r.key
                  ? "bg-blue-600/20 border-blue-500/50 text-white"
                  : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-[11px] text-white/40">{r.desc}</div>
            </button>
          ))}
        </div>

        {role === "sub_admin" && (
          <div>
            <label className="block text-xs text-white/40 mb-1">관리 지역 (선택)</label>
            <input
              type="text"
              placeholder="예: 울산, 부산, 경남"
              value={managedRegion}
              onChange={(e) => setManagedRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

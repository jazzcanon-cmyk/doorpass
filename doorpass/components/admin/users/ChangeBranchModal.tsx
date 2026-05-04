"use client"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Building2 } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import type { ApprovedUser } from "@/types/admin-users"

interface Branch {
  id: string
  name: string
  region: string
  type?: string | null
}

const TYPE_LABEL: Record<string, string> = {
  headquarters: "지사",
  branch: "대리점",
  public: "일반",
}

const TYPE_BADGE: Record<string, string> = {
  headquarters: "bg-blue-500/20 text-blue-300",
  branch: "bg-green-500/20 text-green-300",
  public: "bg-purple-500/20 text-purple-300",
}

interface ChangeBranchModalProps {
  user: ApprovedUser
  onClose: () => void
  onSuccess: () => void
}

export function ChangeBranchModal({ user, onClose, onSuccess }: ChangeBranchModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState(user.branch_id ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d.branches) ? d.branches : []))
      .catch(() => setBranches([]))
  }, [])

  const grouped = useMemo(() => {
    const groups: { label: string; type: string; items: Branch[] }[] = []
    const hq = branches.filter((b) => b.type === "headquarters")
    const regular = branches.filter((b) => !b.type || b.type === "branch")
    const pub = branches.filter((b) => b.type === "public")
    if (hq.length) groups.push({ label: "지사", type: "headquarters", items: hq })
    if (regular.length) groups.push({ label: "대리점", type: "branch", items: regular })
    if (pub.length) groups.push({ label: "일반", type: "public", items: pub })
    return groups
  }, [branches])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    console.log("[ChangeBranch] 저장 시도 — userId:", user.id, "branch_id:", selected)
    try {
      await adminApi(`/api/admin/users/${user.id}/branch`, {
        method: "PATCH",
        body: JSON.stringify({ branch_id: selected }),
      })
      console.log("[ChangeBranch] 저장 성공")
      onSuccess()
      onClose()
    } catch (err) {
      console.error("[ChangeBranch] 저장 실패:", err)
      toast.error("소속 변경에 실패했습니다.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/[0.1] rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-400" />
          소속 변경
        </h3>
        <p className="text-sm text-white/50">
          <span className="text-white font-medium">{user.name}</span>
          {user.email ? <span className="text-white/40"> ({user.email})</span> : null}
        </p>

        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          {grouped.map((group) => (
            <div key={group.type}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1.5 px-1">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelected(b.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between ${
                      selected === b.id
                        ? "bg-blue-600/20 border-blue-500/50 text-white"
                        : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGE[b.type ?? "branch"] ?? TYPE_BADGE.branch}`}>
                      {TYPE_LABEL[b.type ?? "branch"] ?? "대리점"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

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
            onClick={() => void save()}
            disabled={saving || !selected || selected === user.branch_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

"use client"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { UserPlus, Loader2, Clock, CheckCircle2 } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApprovedUserRow } from "./ApprovedUserRow"
import { AssignRoleModal } from "./AssignRoleModal"
import { ChangeBranchModal } from "./ChangeBranchModal"
import type { ApprovedUser } from "@/types/admin-users"

type BranchTypeFilter = "all" | "headquarters" | "branch" | "public"

const BRANCH_FILTERS: { key: BranchTypeFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "headquarters", label: "지사" },
  { key: "branch", label: "대리점" },
  { key: "public", label: "일반" },
]

export function ManageTab() {
  const [users, setUsers] = useState<ApprovedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [assigning, setAssigning] = useState<ApprovedUser | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [changingBranch, setChangingBranch] = useState<ApprovedUser | null>(null)
  const [branchFilter, setBranchFilter] = useState<BranchTypeFilter>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: list } = await adminApi<{ users: ApprovedUser[] }>("/api/admin/users")
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
      await adminApi("/api/admin/users", {
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
      await adminApi("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, action: "approve" }) })
      toast.success(`${n}님을 승인했습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류")
    }
  }

  const reject = async (id: number, n: string) => {
    try {
      await adminApi("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id, action: "reject" }) })
      toast.success(`${n}님을 거부(비활성)했습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류")
    }
  }

  const openAssign = (u: ApprovedUser) => setAssigning(u)
  const closeAssign = () => { setAssigning(null); setSavingRole(false) }

  const submitAssign = async (
    role: "admin" | "sub_admin" | "editor" | "driver",
    managed_region: string | null
  ) => {
    if (!assigning) return
    setSavingRole(true)
    try {
      await adminApi(`/api/admin/users/${assigning.id}/assign-subadmin`, {
        method: "POST",
        body: JSON.stringify({ role, managed_region }),
      })
      const labels: Record<string, string> = {
        admin: "관리자", sub_admin: "부관리자", editor: "편집자", driver: "일반 사용자",
      }
      toast.success(`${assigning.name}님 권한: ${labels[role] ?? role}`)
      closeAssign()
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "권한 변경 실패")
      setSavingRole(false)
    }
  }

  const del = async (id: number, n: string) => {
    if (!confirm(`${n}님을 삭제하시겠습니까?`)) return
    try {
      await adminApi(`/api/admin/users?id=${id}`, { method: "DELETE" })
      toast.success(`${n}님이 삭제되었습니다.`)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    }
  }

  const filterByBranchType = (list: ApprovedUser[]) => {
    if (branchFilter === "all") return list
    return list.filter((u) => {
      const t = u.branches?.type ?? "branch"
      return t === branchFilter
    })
  }

  const pending = filterByBranchType(users.filter((u) => !u.is_active))
  const approved = filterByBranchType(users.filter((u) => u.is_active))

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/40 -mt-4">
        사용 제한(승인 대기) {users.filter(u => !u.is_active).length}명 · 이용 가능 {users.filter(u => u.is_active).length}명 · 전체 {users.length}명
      </p>

      {/* 소속 유형 필터 */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl w-fit">
        {BRANCH_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setBranchFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              branchFilter === f.key
                ? "bg-blue-600 text-white shadow"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

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
                <ApprovedUserRow
                  key={u.id}
                  u={u}
                  mode="pending"
                  onApprove={() => void approve(u.id, u.name)}
                  onReject={() => void reject(u.id, u.name)}
                  onRole={() => openAssign(u)}
                  onDelete={() => void del(u.id, u.name)}
                  onChangeBranch={() => setChangingBranch(u)}
                />
              ))}
              {pending.length === 0 && (
                <p className="text-sm text-white/30 text-center py-6 rounded-xl border border-dashed border-white/10">
                  사용 제한 중인 계정이 없습니다.
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
                <ApprovedUserRow
                  key={u.id}
                  u={u}
                  mode="approved"
                  onApprove={() => void approve(u.id, u.name)}
                  onReject={() => void reject(u.id, u.name)}
                  onRole={() => openAssign(u)}
                  onDelete={() => void del(u.id, u.name)}
                  onChangeBranch={() => setChangingBranch(u)}
                />
              ))}
              {approved.length === 0 && (
                <p className="text-sm text-white/30 text-center py-6">등록된 행이 없습니다</p>
              )}
            </div>
          </section>
        </div>
      )}

      {assigning && (
        <AssignRoleModal
          user={assigning}
          saving={savingRole}
          onClose={closeAssign}
          onSubmit={submitAssign}
        />
      )}

      {changingBranch && (
        <ChangeBranchModal
          user={changingBranch}
          onClose={() => setChangingBranch(null)}
          onSuccess={() => {
            toast.success(`${changingBranch.name}님 소속이 변경됐습니다.`)
            void load()
          }}
        />
      )}
    </div>
  )
}

"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { adminApi } from "@/lib/admin-api"
import { AuthUserRow } from "./AuthUserRow"
import { BlockUserModal } from "./BlockUserModal"
import { AssignRoleModal } from "./AssignRoleModal"
import type { ApprovedUser, AuthUser } from "@/types/admin-users"

function toApprovedUser(u: AuthUser): ApprovedUser {
  const role: ApprovedUser["role"] =
    u.role === "admin" || u.role === "sub_admin" || u.role === "editor"
      ? u.role
      : "driver"
  return {
    id: u.approved_id ?? 0,
    kakao_id: null,
    name: u.name ?? u.email ?? "(이름 없음)",
    phone: null,
    email: u.email,
    role,
    is_active: u.is_active ?? true,
    created_at: u.created_at,
    managed_region: null,
  }
}

export function AllUsersTab() {
  const router = useRouter()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [blockModal, setBlockModal] = useState<{ user: AuthUser } | null>(null)
  const [blockReason, setBlockReason] = useState("")
  const [blocking, setBlocking] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("")
  const [assigning, setAssigning] = useState<AuthUser | null>(null)
  const [savingRole, setSavingRole] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: list } = await adminApi<{ users: AuthUser[] }>("/api/admin/auth-users")
      setUsers(list ?? [])
    } catch (e) {
      toast.error("목록을 불러오지 못했습니다.")
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
      await adminApi(`/api/admin/users/${target.approved_id}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked: true, reason: blockReason.trim() }),
      })
      toast.success(`${target.name ?? target.email ?? "사용자"}님이 차단되었습니다.`)
      closeBlock()
      void load()
    } catch (e) {
      toast.error("차단 실패")
    } finally {
      setBlocking(false)
    }
  }

  const openAssign = (u: AuthUser) => {
    if (!u.approved_id && !u.email) {
      toast.error("이메일이 없어 역할을 지정할 수 없습니다. '등록 관리' 탭에서 먼저 추가하세요.")
      return
    }
    setAssigning(u)
  }
  const closeAssign = () => { setAssigning(null); setSavingRole(false) }

  const submitAssign = async (
    role: "admin" | "sub_admin" | "editor" | "driver",
    managed_region: string | null
  ) => {
    if (!assigning) return
    const identifier = assigning.approved_id != null
      ? String(assigning.approved_id)
      : encodeURIComponent(assigning.email ?? "")
    if (!identifier) {
      toast.error("식별자가 없습니다.")
      return
    }
    setSavingRole(true)
    try {
      await adminApi(`/api/admin/users/${identifier}/assign-subadmin`, {
        method: "POST",
        body: JSON.stringify({
          role,
          managed_region,
          email: assigning.email,
          name: assigning.name,
        }),
      })
      const labels: Record<string, string> = {
        admin: "관리자",
        sub_admin: "부관리자",
        editor: "편집자",
        driver: "일반 사용자",
      }
      toast.success(`${assigning.name ?? assigning.email ?? "사용자"}님 권한: ${labels[role] ?? role}`)
      closeAssign()
      void load()
    } catch (e) {
      toast.error("역할 변경 실패")
      setSavingRole(false)
    }
  }

  const unblock = async (u: AuthUser) => {
    if (!u.approved_id) return
    try {
      await adminApi(`/api/admin/users/${u.approved_id}/block`, {
        method: "POST",
        body: JSON.stringify({ blocked: false }),
      })
      toast.success(`${u.name ?? u.email ?? "사용자"}님 차단이 해제되었습니다.`)
      void load()
    } catch (e) {
      toast.error("차단 해제 실패")
    }
  }

  const handleReset = async (u: AuthUser) => {
    if (!window.confirm(
      (u.name ?? u.email ?? '이 회원') + '을 초기화하시겠습니까?\n초기화하면 승인 정보가 삭제되고 다음 로그인 시 신규 회원으로 처음부터 시작합니다.'
    )) return

    if (!u.approved_id && !u.email) {
      toast.error('초기화할 수 없는 회원입니다.')
      return
    }

    try {
      const res = await fetch('/api/admin/users/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_id: u.approved_id ?? null,
          email: u.email ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || '회원 초기화에 실패했습니다.')
        return
      }
      toast.success((u.name ?? u.email ?? '회원') + '이 초기화되었습니다.')
      void load()
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
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
              onDetail={() => u.email && router.push(`/admin/users/${encodeURIComponent(u.email)}`)}
              onAssignRole={() => openAssign(u)}
              onReset={() => void handleReset(u)}
            />
          ))}
        </div>
      </div>

      {blockModal && (
        <BlockUserModal
          user={blockModal.user}
          reason={blockReason}
          blocking={blocking}
          onReasonChange={setBlockReason}
          onClose={closeBlock}
          onSubmit={() => void submitBlock()}
        />
      )}

      {assigning && (
        <AssignRoleModal
          user={toApprovedUser(assigning)}
          saving={savingRole}
          onClose={closeAssign}
          onSubmit={submitAssign}
        />
      )}
    </>
  )
}

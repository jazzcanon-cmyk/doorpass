"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { adminApi } from "@/lib/admin-api"
import { AuthUserRow } from "./AuthUserRow"
import { BlockUserModal } from "./BlockUserModal"
import type { AuthUser } from "@/types/admin-users"

export function AllUsersTab() {
  const router = useRouter()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [blockModal, setBlockModal] = useState<{ user: AuthUser } | null>(null)
  const [blockReason, setBlockReason] = useState("")
  const [blocking, setBlocking] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: list } = await adminApi<{ users: AuthUser[] }>("/api/admin/auth-users")
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
      await adminApi(`/api/admin/users/${target.approved_id}/block`, {
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
      await adminApi(`/api/admin/users/${u.approved_id}/block`, {
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
              onDetail={() => u.email && router.push(`/admin/users/${encodeURIComponent(u.email)}`)}
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
    </>
  )
}

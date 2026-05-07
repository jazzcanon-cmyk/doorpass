"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Calendar, Ban, Phone } from "lucide-react"

interface User {
  email: string
  name: string
  role: string
  created_at: string
  branch_id: string
  phone?: string | null
  kakao_name?: string | null
  kakao_nickname?: string | null
  profile_image_url?: string | null
  approved_by?: string | null
}

export default function SubAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>("all")

  useEffect(() => {
    void fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    const res = await fetch("/api/admin/users")
    const data = await res.json().catch(() => ({}))
    setUsers(data.users || [])
    setIsLoading(false)
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "관리자",
      sub_admin: "부관리자",
      editor: "편집자",
      driver: "기사",
    }
    return labels[role] || role
  }

  const handleRoleChange = async (userEmail: string, newRole: string) => {
    if (!confirm(`이 회원의 역할을 "${getRoleLabel(newRole)}"로 변경하시겠습니까?`)) return

    try {
      const res = await fetch("/api/admin/users/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, newRole }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.status === 409) {
        alert(data.error || "이미 같은 역할로 변경되었습니다. 화면을 새로고침해주세요.")
        await fetchUsers()
        return
      }
      if (!res.ok) {
        alert(`❌ 역할 변경 실패\n\n${data.error || "오류가 발생했습니다."}`)
        return
      }
      alert("✅ 역할이 변경되었습니다.")
      await fetchUsers()
    } catch (error) {
      console.error("역할 변경 오류:", error)
      alert("❌ 역할 변경 실패\n\n오류가 발생했습니다.")
    }
  }

  const handleBlockUser = async (userEmail: string, userName: string) => {
    if (!confirm(`"${userName}" 회원을 차단하시겠습니까?\n\n차단된 회원은 로그인할 수 없습니다.`)) return

    try {
      const res = await fetch("/api/admin/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "차단 실패")
      }
      alert("✅ 회원이 차단되었습니다.")
      await fetchUsers()
    } catch (error) {
      console.error("차단 오류:", error)
      alert("❌ 차단 실패\n\n오류가 발생했습니다.")
    }
  }

  const referralUsers = users.filter((u) => u.approved_by?.startsWith("referral:"))

  const filteredUsers = users.filter((user) => {
    if (roleFilter === "all") return true
    if (roleFilter === "referral") return user.approved_by?.startsWith("referral:")
    return user.role === roleFilter
  })

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">회원 관리</h1>
        <p className="text-white/50">{users.length}명의 회원</p>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setRoleFilter("all")} variant={roleFilter === "all" ? "default" : "outline"} size="sm">
            전체 ({users.length})
          </Button>
          <Button onClick={() => setRoleFilter("driver")} variant={roleFilter === "driver" ? "default" : "outline"} size="sm">
            기사 ({users.filter((u) => u.role === "driver").length})
          </Button>
          <Button onClick={() => setRoleFilter("editor")} variant={roleFilter === "editor" ? "default" : "outline"} size="sm">
            편집자 ({users.filter((u) => u.role === "editor").length})
          </Button>
          <Button onClick={() => setRoleFilter("referral")} variant={roleFilter === "referral" ? "default" : "outline"} size="sm">
            🔗 자동승인 ({referralUsers.length})
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const displayName = user.kakao_name || user.name || user.email
          const initial = (displayName || "?").trim().charAt(0).toUpperCase()
          const roleBadgeClass =
            user.role === "sub_admin"
              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
              : user.role === "editor"
              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
              : user.role === "driver"
              ? "bg-green-500/20 text-green-300 border-green-500/30"
              : "bg-slate-700 text-white/50 border-white/[0.08]"

          return (
            <div
              key={user.email}
              className="bg-slate-800/50 px-4 py-3 rounded-lg border border-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                {user.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profile_image_url}
                    alt={displayName}
                    className="h-11 w-11 rounded-full object-cover border border-white/[0.08] flex-shrink-0"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-slate-700 flex items-center justify-center text-base font-semibold text-white/60 flex-shrink-0">
                    {initial}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {displayName}
                    </h3>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${roleBadgeClass} flex-shrink-0`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </div>
                  <div className="text-xs text-white/40 space-y-0.5">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      {new Date(user.created_at).toLocaleDateString("ko-KR")} 가입
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      {user.phone
                        ? user.phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")
                        : "-"}
                    </p>
                    {user.approved_by?.startsWith("referral:") && (
                      <p className="flex items-center gap-1 mt-1">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          🔗 추천인: {user.approved_by.replace("referral:", "")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <select
                  value={user.role}
                  onChange={(e) => void handleRoleChange(user.email, e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-xs font-medium text-white bg-slate-800 border border-white/[0.08]"
                >
                  <option className="text-white bg-slate-800" value="driver">기사</option>
                  <option className="text-white bg-slate-800" value="editor">편집자</option>
                  <option className="text-white bg-slate-800" value="sub_admin">부관리자</option>
                </select>

                <Button
                  onClick={() => void handleBlockUser(user.email, displayName)}
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0 text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  차단
                </Button>
              </div>
            </div>
          )
        })}
        {filteredUsers.length === 0 && <div className="text-center py-12 text-white/40">등록된 회원이 없습니다</div>}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Calendar, Ban } from "lucide-react"

interface User {
  email: string
  name: string
  role: string
  created_at: string
  branch_id: string
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
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "역할 변경 실패")
      }
      alert("✅ 역할이 변경되었습니다.")
      await fetchUsers()
    } catch (error) {
      console.error("역할 변경 오류:", error)
      alert(`❌ 역할 변경 실패\n\n${error instanceof Error ? error.message : "오류가 발생했습니다."}`)
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
      alert(`❌ 차단 실패\n\n${error instanceof Error ? error.message : "오류가 발생했습니다."}`)
    }
  }

  const filteredUsers = users.filter((user) => {
    if (roleFilter === "all") return true
    return user.role === roleFilter
  })

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">회원 관리</h1>
        <p className="text-gray-600 dark:text-gray-400">{users.length}명의 회원</p>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          <Button onClick={() => setRoleFilter("all")} variant={roleFilter === "all" ? "default" : "outline"} size="sm">
            전체 ({users.length})
          </Button>
          <Button onClick={() => setRoleFilter("driver")} variant={roleFilter === "driver" ? "default" : "outline"} size="sm">
            기사 ({users.filter((u) => u.role === "driver").length})
          </Button>
          <Button onClick={() => setRoleFilter("editor")} variant={roleFilter === "editor" ? "default" : "outline"} size="sm">
            편집자 ({users.filter((u) => u.role === "editor").length})
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.email} className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{user.name || user.email}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    user.role === "admin" ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300" :
                    user.role === "sub_admin" ? "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300" :
                    user.role === "editor" ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300" :
                    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}>
                    {user.role === "admin" ? "관리자" : user.role === "sub_admin" ? "부관리자" : user.role === "editor" ? "편집자" : "기사"}
                  </span>
                </div>
                <div className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{user.email}</p>
                  <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(user.created_at).toLocaleDateString("ko-KR")} 가입</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 ml-4">
                <select
                  value={user.role}
                  onChange={(e) => void handleRoleChange(user.email, e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="driver">기사</option>
                  <option value="editor">편집자</option>
                  <option value="sub_admin">부관리자</option>
                </select>

                <Button onClick={() => void handleBlockUser(user.email, user.name || user.email)} variant="destructive" size="sm">
                  <Ban className="h-4 w-4 mr-2" />
                  차단
                </Button>
              </div>
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && <div className="text-center py-12 text-gray-500">등록된 회원이 없습니다</div>}
      </div>
    </div>
  )
}

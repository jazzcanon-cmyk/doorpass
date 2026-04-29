"use client"

import { useEffect, useState } from "react"
import { Mail, Calendar } from "lucide-react"

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

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">회원 관리</h1>
        <p className="text-gray-600 dark:text-gray-400">{users.length}명의 회원</p>
      </div>

      <div className="space-y-4">
        {users.map((user) => (
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
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="text-center py-12 text-gray-500">등록된 회원이 없습니다</div>}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Users,
  Home,
  TrendingUp,
  Calendar,
  Activity,
  Edit,
  Save,
  X,
  Search,
  UserCog,
  Loader2,
  ChevronRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface SubAdminEntry {
  id: number
  email: string
  name: string | null
  kakao_name?: string | null
  role: string
}

interface BranchDetail {
  id: string
  name: string
  region: string
  manager_email: string | null
  manager_name: string | null
  sub_admins: SubAdminEntry[]
  created_at: string
  stats: {
    userCount: number
    buildingCount: number
    activeUsers: number
    monthlyLogins: Array<{ month: string; count: number }>
    buildingsByRegion: Array<{ region: string; count: number }>
    recentActivities: Array<{
      type: string
      user: string
      timestamp: string
      description: string
    }>
  }
}

interface UserCandidate {
  id: number
  email: string
  name: string | null
  kakao_name?: string | null
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  sub_admin: "부관리자",
  editor: "편집자",
  driver: "기사",
}

const getDisplayName = (u: UserCandidate) =>
  u.kakao_name?.trim() || u.name?.trim() || u.email.split("@")[0] || u.email

export default function BranchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const branchId = params?.branchId as string

  const [branch, setBranch] = useState<BranchDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    region: "",
    manager_email: "",
  })

  // 부관리자 지정 모달 상태
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserCandidate[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAssigning, setIsAssigning] = useState<string | null>(null)

  const fetchBranchDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.branch) throw new Error(data.error || "조회 실패")
      setBranch(data.branch)
      setEditForm({
        name: data.branch.name,
        region: data.branch.region,
        manager_email: data.branch.manager_email || "",
      })
    } catch (error) {
      console.error("조회 실패:", error)
      alert(error instanceof Error ? error.message : "조회 실패")
      router.push("/admin/branches")
    } finally {
      setIsLoading(false)
    }
  }, [branchId, router])

  useEffect(() => {
    if (!branchId) return
    void fetchBranchDetail()
  }, [branchId, fetchBranchDetail])

  const searchUsers = useCallback(async (q: string) => {
    setIsSearching(true)
    try {
      const params = new URLSearchParams({ excludeAdmin: "true" })
      if (q) params.set("search", q)
      const res = await fetch(`/api/admin/users?${params}`)
      const data = (await res.json().catch(() => ({}))) as { users?: UserCandidate[] }
      setSearchResults(data.users ?? [])
    } catch {
      toast.error("회원 목록을 불러오지 못했습니다.")
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!isAssignModalOpen) return
    const timer = setTimeout(() => void searchUsers(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, isAssignModalOpen, searchUsers])

  const handleOpenAssignModal = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsAssignModalOpen(true)
    void searchUsers("")
  }

  const handleAssign = async (userEmail: string) => {
    if (!branch) return
    setIsAssigning(userEmail)
    try {
      const res = await fetch("/api/admin/assign-sub-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, userEmail }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "지정 실패")
      toast.success("부관리자가 지정되었습니다.")
      setIsAssignModalOpen(false)
      await fetchBranchDetail()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "부관리자 지정에 실패했습니다.")
    } finally {
      setIsAssigning(null)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "수정 실패")

      toast.success("대리점 정보가 수정되었습니다.")
      setIsEditing(false)
      await fetchBranchDetail()
    } catch (error) {
      console.error("수정 오류:", error)
      alert(error instanceof Error ? error.message : "수정 중 오류가 발생했습니다.")
    }
  }

  if (isLoading || !branch) {
    return <div className="p-6">로딩 중...</div>
  }

  return (
    <div className="p-6">
      {/* 브레드크럼 */}
      <nav className="flex items-center gap-1.5 text-sm mb-4">
        <button
          type="button"
          onClick={() => router.push("/admin/branches")}
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          대리점 관리
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
        <span className="text-white font-medium truncate">{branch.name}</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push("/admin/branches")} variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {isEditing ? (
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="text-2xl font-bold border-b-2 border-blue-500 bg-transparent text-white"
              />
            ) : (
              <h1 className="text-2xl font-bold text-white">{branch.name}</h1>
            )}
            {isEditing ? (
              <input
                type="text"
                value={editForm.region}
                onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                className="font-medium text-gray-300 border-b border-white/20 bg-transparent"
              />
            ) : (
              <p className="font-medium text-gray-300">{branch.region}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={() => void handleSave()}>
                <Save className="h-4 w-4 mr-2" />
                저장
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              수정
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 회원</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{branch.stats.userCount}명</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Home className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">등록 건물</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{branch.stats.buildingCount}개</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">활성 회원</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{branch.stats.activeUsers}명</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">개설일</p>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{new Date(branch.created_at).toLocaleDateString("ko-KR")}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            부관리자 정보 {branch.sub_admins?.length > 0 && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({branch.sub_admins.length}명)
              </span>
            )}
          </h2>
          {!isEditing && (
            <Button onClick={handleOpenAssignModal} variant="outline" size="sm">
              <UserCog className="h-4 w-4 mr-2" />
              부관리자 추가
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">대표 이메일 (참조용)</label>
              <input
                type="email"
                value={editForm.manager_email}
                onChange={(e) => setEditForm({ ...editForm, manager_email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="manager@example.com"
              />
            </div>
          </div>
        ) : branch.sub_admins && branch.sub_admins.length > 0 ? (
          <div className="space-y-2">
            {branch.sub_admins.map((sa) => {
              const displayName = getDisplayName({
                id: sa.id,
                email: sa.email,
                name: sa.name,
                kakao_name: sa.kakao_name ?? null,
                role: sa.role,
              })
              return (
                <div
                  key={sa.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{sa.email}</p>
                  </div>
                  <span className="ml-3 text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 flex-shrink-0">
                    부관리자
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="font-medium text-gray-700 dark:text-gray-300">부관리자가 지정되지 않았습니다</p>
        )}
      </div>

      {/* 부관리자 지정 모달 */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>부관리자 추가 지정</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 이메일로 검색"
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {isSearching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                검색 결과가 없습니다
              </p>
            ) : (
              searchResults.map((u) => {
                const displayName = getDisplayName(u)
                const isAlreadySubAdmin = !!branch.sub_admins?.some((sa) => sa.email === u.email)
                const roleBadgeClass =
                  u.role === "sub_admin"
                    ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                    : u.role === "editor"
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    : u.role === "driver"
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                      <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${roleBadgeClass}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={isAssigning === u.email || isAlreadySubAdmin}
                      onClick={() => void handleAssign(u.email)}
                      className="ml-3 shrink-0"
                    >
                      {isAssigning === u.email ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isAlreadySubAdmin ? (
                        "이미 지정됨"
                      ) : (
                        "지정"
                      )}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">월별 로그인 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={branch.stats.monthlyLogins}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" name="로그인 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">지역별 건물 분포</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branch.stats.buildingsByRegion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="region" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#10b981" name="건물 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">최근 활동</h2>
        </div>

        <div className="space-y-3">
          {branch.stats.recentActivities.length > 0 ? (
            branch.stats.recentActivities.map((activity, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white">{activity.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>{activity.user}</span>
                    <span>•</span>
                    <span>{new Date(activity.timestamp).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded">
                  {activity.type}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center font-medium text-gray-700 dark:text-gray-300 py-8">최근 활동이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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

interface BranchDetail {
  id: string
  name: string
  region: string
  manager_email: string | null
  manager_name: string | null
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

  useEffect(() => {
    if (!branchId) return
    void fetchBranchDetail()
  }, [branchId])

  const fetchBranchDetail = async () => {
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
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "수정 실패")

      alert("수정 완료!")
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
                className="text-2xl font-bold border-b-2 border-blue-500 bg-transparent"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branch.name}</h1>
            )}
            {isEditing ? (
              <input
                type="text"
                value={editForm.region}
                onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                className="text-gray-600 dark:text-gray-400 border-b border-gray-300 bg-transparent"
              />
            ) : (
              <p className="font-medium text-gray-700 dark:text-gray-300">{branch.region}</p>
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
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">부관리자 정보</h2>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">이메일</label>
              <input
                type="email"
                value={editForm.manager_email}
                onChange={(e) => setEditForm({ ...editForm, manager_email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="manager@example.com"
              />
            </div>
          </div>
        ) : branch.manager_email ? (
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{branch.manager_name || "이름 없음"}</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{branch.manager_email}</p>
          </div>
        ) : (
          <p className="font-medium text-gray-700 dark:text-gray-300">부관리자가 지정되지 않았습니다</p>
        )}
      </div>

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

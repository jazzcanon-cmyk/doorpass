"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Users,
  Home,
  TrendingUp,
  MapPin,
  Edit,
  Trash2,
  Plus,
} from "lucide-react"

interface Branch {
  id: string
  name: string
  region: string
  manager_email: string | null
  manager_name: string | null
  created_at: string
  stats?: {
    userCount: number
    buildingCount: number
    activeUsers: number
  }
}

export default function BranchesPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void fetchBranches()
  }, [])

  const fetchBranches = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/branches/stats")
      const data = await res.json().catch(() => ({}))
      setBranches(data.branches || [])
    } catch (error) {
      console.error("조회 실패:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDetails = (branchId: string) => {
    router.push(`/admin/branches/${branchId}`)
  }

  const handleDelete = async (branchId: string, branchName: string) => {
    if (!confirm(`"${branchName}" 대리점을 삭제하시겠습니까?\n\n⚠️ 연결된 회원과 건물도 모두 삭제됩니다!`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "DELETE",
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "삭제 실패")

      alert("삭제 완료!")
      await fetchBranches()
    } catch (error) {
      console.error("삭제 오류:", error)
      alert(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.")
    }
  }

  if (isLoading) {
    return <div className="p-6">로딩 중...</div>
  }

  const branchesByRegion = branches.reduce((acc, branch) => {
    if (!acc[branch.region]) {
      acc[branch.region] = []
    }
    acc[branch.region].push(branch)
    return acc
  }, {} as Record<string, Branch[]>)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">대리점 관리</h1>
          <p className="text-gray-600 dark:text-gray-400">전체 {branches.length}개 대리점</p>
        </div>
        <Button onClick={() => router.push("/admin/branches/new")}>
          <Plus className="h-4 w-4 mr-2" />
          대리점 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 대리점</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{branches.length}개</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 회원</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {branches.reduce((sum, b) => sum + (b.stats?.userCount || 0), 0)}명
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Home className="h-5 w-5 text-purple-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 건물</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {branches.reduce((sum, b) => sum + (b.stats?.buildingCount || 0), 0)}개
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">활성 회원</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {branches.reduce((sum, b) => sum + (b.stats?.activeUsers || 0), 0)}명
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(branchesByRegion).map(([region, regionBranches]) => (
          <div key={region}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-blue-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{region}</h2>
              <span className="text-sm text-gray-500">({regionBranches.length}개)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regionBranches.map((branch) => (
                <div
                  key={branch.id}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg border hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">{branch.name}</h3>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{branch.region}</p>
                    </div>
                    <Building2 className="h-8 w-8 text-blue-500" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">회원</span>
                      <span className="font-bold text-gray-900 dark:text-white">{branch.stats?.userCount || 0}명</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">건물</span>
                      <span className="font-bold text-gray-900 dark:text-white">{branch.stats?.buildingCount || 0}개</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">활성 회원</span>
                      <span className="font-bold text-gray-900 dark:text-white">{branch.stats?.activeUsers || 0}명</span>
                    </div>
                  </div>

                  {branch.manager_email && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">부관리자</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{branch.manager_name || branch.manager_email}</p>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{branch.manager_email}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={() => handleViewDetails(branch.id)} className="flex-1" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      상세
                    </Button>
                    <Button onClick={() => void handleDelete(branch.id, branch.name)} variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Building2, TrendingUp, Clock } from "lucide-react"

interface DashboardStats {
  userCount: number
  buildingCount: number
  pendingApprovals: number
  recentUploads: number
}

export default function SubAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    userCount: 0,
    buildingCount: 0,
    pendingApprovals: 0,
    recentUploads: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void fetchStats()
  }, [])

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/sub-admin/stats")
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.stats && typeof data.stats === "object") {
        setStats((prev) => ({ ...prev, ...data.stats }))
      }
    } catch (error) {
      console.error("통계 조회 실패:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="p-6">로딩 중...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">대시보드</h1>
        <p className="font-medium text-gray-700 dark:text-gray-300">대리점 현황을 한눈에 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 회원</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.userCount}명</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">등록 건물</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.buildingCount}개</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">승인 대기</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingApprovals}건</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">이번 달 업로드</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.recentUploads}개</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">빠른 실행</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/sub-admin/users"
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <Users className="h-6 w-6 text-blue-500 mb-2" />
            <p className="font-bold text-gray-900 dark:text-white">회원 관리</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">회원 조회 및 승인</p>
          </Link>

          <Link
            href="/sub-admin/buildings"
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors"
          >
            <Building2 className="h-6 w-6 text-green-500 mb-2" />
            <p className="font-bold text-gray-900 dark:text-white">건물 관리</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">건물 조회 및 수정</p>
          </Link>

          <Link
            href="/sub-admin/upload"
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors"
          >
            <TrendingUp className="h-6 w-6 text-purple-500 mb-2" />
            <p className="font-bold text-gray-900 dark:text-white">Excel 업로드</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">건물 일괄 등록</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

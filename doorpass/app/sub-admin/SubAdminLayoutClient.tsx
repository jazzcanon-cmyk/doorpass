"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  Upload,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const menuItems = [
  { icon: LayoutDashboard, label: "대시보드", href: "/sub-admin" },
  { icon: Users, label: "회원 관리", href: "/sub-admin/users" },
  { icon: Building2, label: "건물 관리", href: "/sub-admin/buildings" },
  { icon: Clock, label: "승인 대기", href: "/sub-admin/pending-approvals" },
  { icon: Upload, label: "Excel 업로드", href: "/sub-admin/upload" },
]

interface BranchInfo {
  email: string | null
  name?: string | null
  role?: string | null
  branch?: {
    id?: string
    name?: string
    region?: string
  } | null
}

export default function SubAdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)

  useEffect(() => {
    void fetchBranchInfo()
  }, [])

  const fetchBranchInfo = async () => {
    const res = await fetch("/api/users/me")
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data) {
      router.replace("/login")
      return
    }
    if (data.role !== "admin" && data.role !== "sub_admin") {
      router.replace("/settings")
      return
    }
    setBranchInfo(data)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/login")
  }

  const getBreadcrumb = () => {
    const pathMap: Record<string, string> = {
      "/sub-admin": "대시보드",
      "/sub-admin/users": "회원 관리",
      "/sub-admin/buildings": "건물 관리",
      "/sub-admin/pending-approvals": "승인 대기",
      "/sub-admin/upload": "Excel 업로드",
    }
    return pathMap[pathname] || "부관리자"
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {branchInfo?.branch?.name || "DoorPass"}
          </h1>
        </div>
      </div>

      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transform transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {branchInfo?.branch?.name || "DoorPass"}
            </h1>
          </div>

          {branchInfo && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">부관리자</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {branchInfo.name || branchInfo.email}
              </p>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {branchInfo.branch?.region || "-"}
              </p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href)
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleLogout} variant="outline" className="w-full justify-start">
              <LogOut className="h-5 w-5 mr-3" />
              로그아웃
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64">
        <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 mt-16 lg:mt-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">부관리자</span>
            <span className="text-gray-400 dark:text-gray-600">/</span>
            <span className="font-medium text-gray-900 dark:text-white">{getBreadcrumb()}</span>
          </div>
        </div>

        <main>{children}</main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  )
}

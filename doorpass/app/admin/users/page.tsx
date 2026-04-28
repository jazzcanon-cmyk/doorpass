"use client"

import { useState } from "react"
import { Users, Settings2 } from "lucide-react"
import { AllUsersTab } from "@/components/admin/users/AllUsersTab"
import { ManageTab } from "@/components/admin/users/ManageTab"
import type { AdminUserTab } from "@/types/admin-users"

export default function UsersPage() {
  const [tab, setTab] = useState<AdminUserTab>("all")

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
      </div>

      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "all"
              ? "bg-blue-600 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <Users className="h-4 w-4" />
          전체 로그인 회원
        </button>
        <button
          type="button"
          onClick={() => setTab("manage")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "manage"
              ? "bg-blue-600 text-white shadow"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          등록 관리
        </button>
      </div>

      {tab === "all" ? <AllUsersTab /> : <ManageTab />}
    </div>
  )
}

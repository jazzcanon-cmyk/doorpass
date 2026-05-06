"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, Building2, Clock, Upload,
  LogOut, Menu, X, ChevronRight, Shield, Home,
} from "lucide-react"
import { useEffect, useState } from "react"

const NAV = [
  { href: "/sub-admin", label: "📊 대시보드", icon: LayoutDashboard, exact: true },
  { href: "/sub-admin/users", label: "👥 회원 관리", icon: Users },
  { href: "/sub-admin/buildings", label: "🏢 건물 관리", icon: Building2 },
  { href: "/sub-admin/pending-approvals", label: "⏳ 승인 대기", icon: Clock },
  { href: "/sub-admin/upload", label: "📤 Excel 업로드", icon: Upload },
]

const LABEL: Record<string, string> = {
  "sub-admin": "부관리자",
  users: "회원 관리",
  buildings: "건물 관리",
  "pending-approvals": "승인 대기",
  upload: "Excel 업로드",
}

interface BranchInfo {
  email: string | null
  name?: string | null
  role?: string | null
  branch?: { id?: string; name?: string; region?: string } | null
}

function SidebarContent({
  branchInfo,
  onNav,
  onLogout,
}: {
  branchInfo: BranchInfo | null
  onNav?: () => void
  onLogout: () => void
}) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  const displayName = branchInfo?.name || branchInfo?.email || ""
  const initial = displayName.trim().charAt(0).toUpperCase() || "A"

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">DoorPass</p>
            <p className="text-[10px] text-white/40">부관리자 패널</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-white/[0.08] space-y-1">
        {branchInfo && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-blue-400 font-bold">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{displayName}</p>
              <p className="text-[10px] text-white/35 truncate">
                {branchInfo.branch?.name ?? "부관리자"}
                {branchInfo.branch?.region ? ` · ${branchInfo.branch.region}` : ""}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => { window.location.href = "/" }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <Home className="h-3.5 w-3.5 flex-shrink-0" />
          앱으로 가기
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  )
}

export default function SubAdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const segs = pathname.split("/").filter(Boolean)

  return (
    <div className="flex h-[100dvh] bg-slate-950 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900/80 border-r border-white/[0.08] flex-shrink-0">
        <SidebarContent branchInfo={branchInfo} onLogout={() => void handleLogout()} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 max-w-[85vw] bg-slate-900 border-r border-white/[0.08] z-10">
            <div className="absolute right-3 top-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              branchInfo={branchInfo}
              onNav={() => setOpen(false)}
              onLogout={() => void handleLogout()}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 min-h-14 py-3 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              {segs.map((seg, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <span className="text-white/20 flex-shrink-0">/</span>}
                  <span className={`truncate ${i === segs.length - 1 ? "text-white font-medium" : "text-white/40"}`}>
                    {LABEL[seg] ?? seg}
                  </span>
                </span>
              ))}
            </div>
          </div>
          {branchInfo && (
            <div className="hidden sm:flex flex-col items-end text-right min-w-0 max-w-[200px]">
              <span className="text-xs font-medium text-white truncate">
                {branchInfo.name || branchInfo.email}
              </span>
              {branchInfo.branch?.name && (
                <span className="text-[10px] text-white/35 truncate">{branchInfo.branch.name}</span>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950/10 to-slate-900">
          {children}
        </main>
      </div>
    </div>
  )
}

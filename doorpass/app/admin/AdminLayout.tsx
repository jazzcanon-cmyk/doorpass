"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, BarChart2, Building2, Users,
  MessageSquare, Settings, Menu, X, ChevronRight,
  LogOut, Shield,
} from "lucide-react"

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "📊 대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/analytics", label: "📈 분석", icon: BarChart2 },
  { href: "/admin/buildings/import", label: "🏢 건물 관리", icon: Building2 },
  { href: "/admin/users", label: "👥 사용자 관리", icon: Users },
  { href: "/admin/slack", label: "💬 Slack 메시지", icon: MessageSquare },
  { href: "/admin/settings", label: "⚙️ 설정", icon: Settings },
]

const LABEL: Record<string, string> = {
  admin: "관리자", analytics: "분석", buildings: "건물 관리",
  import: "일괄 등록", users: "사용자 관리", slack: "Slack", settings: "설정",
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segs = pathname.split("/").filter(Boolean)
  return (
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
  )
}

function SidebarContent({
  adminName,
  adminEmail,
  onNav,
}: {
  adminName: string
  adminEmail: string
  onNav?: () => void
}) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">신정대리점</p>
            <p className="text-[10px] text-white/40">관리자 패널</p>
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

      <div className="px-3 pb-4 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-blue-400 font-bold">{adminName[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{adminName}</p>
            {adminEmail ? (
              <p className="text-[10px] text-white/35 truncate">{adminEmail}</p>
            ) : (
              <p className="text-[10px] text-blue-400/70">어드민</p>
            )}
          </div>
          <Link
            href="/"
            title="메인으로"
            className="text-white/25 hover:text-white/60 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function AdminLayout({
  adminName,
  adminEmail,
  children,
}: {
  adminName: string
  adminEmail: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] bg-slate-950 overflow-hidden">
      <aside className="hidden md:flex flex-col w-60 bg-slate-900/80 border-r border-white/[0.08] flex-shrink-0">
        <SidebarContent adminName={adminName} adminEmail={adminEmail} />
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
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
            <SidebarContent adminName={adminName} adminEmail={adminEmail} onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 min-h-14 py-3 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <Breadcrumb pathname={pathname} />
          </div>
          <div className="hidden sm:flex flex-col items-end text-right min-w-0 max-w-[200px]">
            <span className="text-xs font-medium text-white truncate">{adminName}</span>
            {adminEmail ? (
              <span className="text-[10px] text-white/35 truncate w-full">{adminEmail}</span>
            ) : null}
          </div>
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 flex-shrink-0"
          >
            <LogOut className="h-3 w-3" />
            메인으로
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950/10 to-slate-900">
          {children}
        </main>
      </div>
    </div>
  )
}

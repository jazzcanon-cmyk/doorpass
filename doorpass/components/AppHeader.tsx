"use client"
import Link from "next/link"
import { useState, useEffect } from "react"
import { RefreshCw, Search, Navigation, MessageSquare, LogOut, Settings, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CurrentUser, TabType } from "@/types/building"

interface AppHeaderProps {
  currentUser: CurrentUser | null
  activeTab: TabType
  loading: boolean
  onTabChange: (tab: TabType) => void
  onRefresh: () => void
  onLogout: () => void
}

const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  { key: "search", label: "검색", icon: <Search className="h-4 w-4" /> },
  { key: "delivery", label: "대체배송", icon: <Truck className="h-4 w-4" /> },
  { key: "board", label: "게시판", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "nearby", label: "내 주변", icon: <Navigation className="h-4 w-4" /> },
]

export function AppHeader({ currentUser, activeTab, loading, onTabChange, onRefresh, onLogout }: AppHeaderProps) {
  const [animate, setAnimate] = useState(false)
  const total_points = currentUser?.total_points

  useEffect(() => {
    if (!total_points) return
    setAnimate(true)
    const t = setTimeout(() => setAnimate(false), 600)
    return () => clearTimeout(t)
  }, [total_points])

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => onTabChange("search")} className="flex-shrink-0 focus:outline-none">
              <img src="/icon-light-32x32.png" alt="DoorPass" width={32} height={32} className="rounded-lg" />
            </button>
            <div>
              <p className="text-[11px] text-white/40 flex items-center gap-1">
                {currentUser ? (
                  <Link href="/settings" className="hover:text-white/70 transition-colors">
                    {currentUser.userName}
                  </Link>
                ) : "공동현관 비밀번호"}
                {currentUser && (currentUser.total_points ?? 0) > 0 && (
                  <Link href="/my-points" className="text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full px-2 py-0.5 hover:opacity-80 transition-opacity" style={{ transform: animate ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'inline-block' }}>
                    🏆 {(currentUser.total_points ?? 0).toLocaleString()}P
                  </Link>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeTab !== "board" && activeTab !== "delivery" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
                className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Link
              href="/settings"
              title="설정"
              className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-3">
        <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex flex-col flex-1 items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

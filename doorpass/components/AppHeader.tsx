"use client"
import { RefreshCw, Search, Navigation, MessageSquare, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/AppLogo"
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
  { key: "nearby", label: "내 주변", icon: <Navigation className="h-4 w-4" /> },
  { key: "search", label: "검색", icon: <Search className="h-4 w-4" /> },
  { key: "board", label: "게시판", icon: <MessageSquare className="h-4 w-4" /> },
]

export function AppHeader({ currentUser, activeTab, loading, onTabChange, onRefresh, onLogout }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">DoorPass</h1>
              <p className="text-[11px] text-white/40">
                {currentUser ? currentUser.userName : "공동현관 비밀번호"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {activeTab !== "board" && (
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
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

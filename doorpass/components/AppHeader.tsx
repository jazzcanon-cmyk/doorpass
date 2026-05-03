"use client"
import Link from "next/link"
import { useState, useEffect } from "react"
import { RefreshCw, Search, Navigation, MessageSquare, LogOut, Settings, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/AppLogo"
import type { CurrentUser, TabType } from "@/types/building"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const total_points = currentUser?.total_points

  useEffect(() => {
    if (!total_points) return
    setAnimate(true)
    const t = setTimeout(() => setAnimate(false), 600)
    return () => clearTimeout(t)
  }, [total_points])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = () => {
    if (deferredPrompt) {
      toast.info("📲 아래 팝업에서 추가 버튼을 누르면 설치 완료!", {
        duration: 4000,
      })
      setTimeout(async () => {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === "accepted") {
          setIsInstalled(true)
          setDeferredPrompt(null)
          toast.success("🎉 DoorPass가 홈화면에 설치됐어요!")
        } else {
          toast.info("나중에 언제든 설치할 수 있어요 😊")
        }
      }, 500)
    } else {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        toast.success("이미 설치된 앱이에요! 😊")
      } else {
        toast.info("크롬 메뉴(⋮) → 홈화면에 추가 를 선택해주세요", { duration: 5000 })
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">DoorPass</h1>
              <p className="text-[11px] text-white/40 flex items-center gap-1">
                {currentUser ? currentUser.userName : "공동현관 비밀번호"}
                {currentUser && (currentUser.total_points ?? 0) > 0 && (
                  <Link href="/my-points" className="text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full px-2 py-0.5 hover:opacity-80 transition-opacity" style={{ transform: animate ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'inline-block' }}>
                    🏆 {(currentUser.total_points ?? 0).toLocaleString()}P
                  </Link>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isInstalled && (
              <button
                onClick={handleInstall}
                title="홈화면에 앱 설치하기"
                style={{
                  background: deferredPrompt
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "rgba(255,255,255,0.1)",
                  border: deferredPrompt ? "none" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "20px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "white",
                  whiteSpace: "nowrap",
                  boxShadow: deferredPrompt ? "0 2px 8px rgba(16,185,129,0.4)" : "none",
                  transition: "all 0.2s",
                }}
              >
                📲 <span>{deferredPrompt ? "앱 설치" : "설치 안내"}</span>
              </button>
            )}
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

import { Loader2 } from "lucide-react"
import { AppLogo } from "@/components/AppLogo"

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <AppLogo size="lg" />
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 blur-xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <p className="text-blue-200/60 text-sm">로그인 확인 중...</p>
        </div>
      </div>
    </div>
  )
}

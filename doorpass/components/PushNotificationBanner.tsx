"use client"
import { useState } from "react"
import { Bell, X } from "lucide-react"
import { toast } from "sonner"
import { usePushNotification } from "@/hooks/usePushNotification"

function PushNotificationBanner() {
  const { supported, subscribed, subscribe } = usePushNotification()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (!supported || subscribed) return null

  const handleAllow = async () => {
    const ok = await subscribe()
    if (ok) {
      toast.success("알림이 설정되었습니다")
      setDismissed(true)
    } else {
      toast.error("알림 설정에 실패했습니다")
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-blue-600 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
      <Bell className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">대체배송 알림 받기</p>
        <p className="text-xs text-blue-200 mt-0.5">
          신청자가 생기면 즉시 알려드려요
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => void handleAllow()}
          className="px-3 py-1.5 rounded-lg bg-white text-blue-600 text-xs font-semibold hover:bg-blue-50 active:scale-95 transition-all"
        >
          허용
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default PushNotificationBanner

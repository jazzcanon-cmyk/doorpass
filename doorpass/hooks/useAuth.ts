"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import type { CurrentUser } from "@/types/building"

export function useAuth() {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<"loading" | "ok">("loading")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    let cancelled = false
    let welcomeTimer: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        router.replace("/login")
        return
      }
      const userId = user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? user.id
      const email = user.email ?? ""
      const userName =
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        (email ? email.split("@")[0] : "익명")

      setCurrentUser({ userId, userName, email, canRevealBuildingPassword: false })
      setAuthStatus("ok")

      void fetch("/api/users/me", { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { canRevealBuildingPassword?: boolean; branchId?: string | null; total_points?: number }) => {
          if (cancelled) return
          setCurrentUser((prev) =>
            prev ? {
              ...prev,
              canRevealBuildingPassword: Boolean(data?.canRevealBuildingPassword),
              branchId: data?.branchId ?? null,
              total_points: data?.total_points ?? 0,
            } : null
          )
        })
        .catch(() => {})

      Promise.all([
        fetch("/api/users/login-count", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ count: 0 })),
        fetch("/api/users/approval-status", { signal: controller.signal }).then((r) => r.json()).catch(() => ({ status: "none" })),
      ]).then(([loginCountData, approvalStatusData]) => {
        if (cancelled) return
        const count = Number(loginCountData?.count ?? 0)
        const status = String(approvalStatusData?.status ?? "none")

        // 2차 로그인부터는 승인 프로세스 적용
        if (count > 1) {
          if (status === "none") {
            router.replace("/select-branch")
            return
          }
          if (status === "pending" || status === "rejected") {
            router.replace("/pending-approval")
            return
          }
        }
      }).catch(() => {})

      fetch("/api/users/welcome", { signal: controller.signal })
        .then((r) => r.json())
        .then(({ welcome_shown }) => {
          if (cancelled || welcome_shown !== false) return
          welcomeTimer = setTimeout(() => {
            if (!cancelled) setShowWelcome(true)
          }, 500)
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
      controller.abort()
      if (welcomeTimer) clearTimeout(welcomeTimer)
    }
  }, [router])

  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false)
    fetch("/api/users/welcome", { method: "POST" }).catch(() => {})
  }, [])

  const handleLogout = useCallback(async () => {
    await fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "logout", pageUrl: window.location.pathname }),
      keepalive: true,
    }).catch(() => {})
    await supabase.auth.signOut()
    router.replace("/login")
  }, [router])

  return { authStatus, currentUser, showWelcome, handleWelcomeClose, handleLogout }
}

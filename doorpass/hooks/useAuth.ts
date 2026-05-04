"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
    let approvalPoller: ReturnType<typeof setInterval> | null = null
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

      // 추천인 링크 토큰 처리: autoApproved 시 즉시 권한 갱신
      const referralToken = sessionStorage.getItem("referral_token")
      if (referralToken) {
        void fetch("/api/users/referral/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: referralToken }),
        })
          .then((r) => r.json())
          .then((data: { autoApproved?: boolean }) => {
            sessionStorage.removeItem("referral_token")
            if (cancelled || !data.autoApproved) return
            void fetch("/api/users/me", { cache: "no-store" })
              .then((r) => r.json())
              .then((meData: { canRevealBuildingPassword?: boolean; branchId?: string | null; total_points?: number }) => {
                if (cancelled) return
                setCurrentUser((prev) =>
                  prev ? {
                    ...prev,
                    canRevealBuildingPassword: Boolean(meData?.canRevealBuildingPassword),
                    branchId: meData?.branchId ?? null,
                    total_points: meData?.total_points ?? 0,
                  } : null
                )
              })
              .catch(() => {})
          })
          .catch(() => sessionStorage.removeItem("referral_token"))
      }

      void fetch("/api/users/me", { signal: controller.signal, cache: "no-store" })
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

        // 오늘 첫 로그인일 때만 기록 추가 (중복 방지)
        if (count === 0) {
          fetch("/api/users/login-count", { method: "POST" }).catch(() => {})
        }

        // 승인 완료 → me API 재호출로 canRevealBuildingPassword 즉시 갱신
        if (status === "approved") {
          void fetch("/api/users/me", { cache: "no-store" })
            .then((r) => r.json())
            .then((data: { canRevealBuildingPassword?: boolean; branchId?: string | null; total_points?: number }) => {
              if (cancelled) return
              setCurrentUser((prev) =>
                prev
                  ? {
                      ...prev,
                      canRevealBuildingPassword: Boolean(data?.canRevealBuildingPassword),
                      branchId: data?.branchId ?? prev.branchId ?? null,
                      total_points: data?.total_points ?? prev.total_points ?? 0,
                    }
                  : null
              )
            })
            .catch(() => {})
        } else {
          // 미승인 상태 → 30초마다 승인 여부 폴링
          approvalPoller = setInterval(() => {
            if (cancelled) {
              if (approvalPoller) clearInterval(approvalPoller)
              return
            }
            void fetch("/api/users/approval-status")
              .then((r) => r.json())
              .then((data: { status?: string; canRevealBuildingPassword?: boolean }) => {
                if (cancelled || data.status !== "approved") return
                if (approvalPoller) { clearInterval(approvalPoller); approvalPoller = null }
                void fetch("/api/users/me", { cache: "no-store" })
                  .then((r) => r.json())
                  .then((meData: { canRevealBuildingPassword?: boolean; branchId?: string | null; total_points?: number }) => {
                    if (cancelled) return
                    setCurrentUser((prev) =>
                      prev ? {
                        ...prev,
                        canRevealBuildingPassword: Boolean(meData?.canRevealBuildingPassword),
                        branchId: meData?.branchId ?? prev.branchId ?? null,
                        total_points: meData?.total_points ?? prev.total_points ?? 0,
                      } : null
                    )
                    toast.success("🎉 승인됐어요! 이제 비밀번호를 확인할 수 있어요!")
                  })
                  .catch(() => {})
              })
              .catch(() => {})
          }, 30_000)
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
      if (approvalPoller) clearInterval(approvalPoller)
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

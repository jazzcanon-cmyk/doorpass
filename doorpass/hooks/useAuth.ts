"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-client"
import {
  loadUserCache,
  saveUserCache,
  clearUserCache,
  clearBuildingsCache,
} from "@/lib/app-state"
import type { CurrentUser } from "@/types/building"

type MeResponse = {
  canRevealBuildingPassword?: boolean
  branchId?: string | null
  total_points?: number
  loginCount?: number
  approvalStatus?: string
  welcomeShown?: boolean
  name?: string
  role?: string | null
}

export function useAuth() {
  const router = useRouter()
  // 캐시된 인증 정보가 있으면 즉시 복원하여 로딩 화면을 건너뜀.
  // Supabase 세션 검증은 아래 useEffect에서 백그라운드로 실행됨.
  const [authStatus, setAuthStatus] = useState<"loading" | "ok">(() =>
    loadUserCache() ? "ok" : "loading"
  )
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const cached = loadUserCache()
    if (!cached) return null
    return {
      userId: cached.userId,
      userName: cached.userName,
      email: cached.email,
      branchId: cached.branchId ?? null,
      canRevealBuildingPassword: cached.canRevealBuildingPassword,
      total_points: cached.total_points,
    }
  })
  const [showWelcome, setShowWelcome] = useState(false)

  // currentUser 변경 시 캐시 동기화 (비밀번호 등 민감정보는 저장하지 않음)
  useEffect(() => {
    if (currentUser) saveUserCache(currentUser)
  }, [currentUser])

  useEffect(() => {
    let cancelled = false
    let welcomeTimer: ReturnType<typeof setTimeout> | null = null
    let approvalPoller: ReturnType<typeof setInterval> | null = null
    let visibilityListener: (() => void) | null = null
    const controller = new AbortController()

    // API 호출 1: Supabase 세션 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        // 세션 만료/무효 → 캐시 폐기 후 로그인으로
        clearUserCache()
        clearBuildingsCache()
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
      // sessionStorage 우선, 없으면 localStorage 폴백 (인앱→외부브라우저 전환 대비)
      const referralToken =
        sessionStorage.getItem("referral_token") ?? localStorage.getItem("referral_token")
      if (referralToken) {
        void fetch("/api/users/referral/use", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: referralToken }),
        })
          .then((r) => r.json())
          .then((data: { autoApproved?: boolean }) => {
            try { sessionStorage.removeItem("referral_token") } catch {}
            try { localStorage.removeItem("referral_token") } catch {}
            if (cancelled || !data.autoApproved) return
            void fetch("/api/users/me", { cache: "no-store" })
              .then((r) => r.json())
              .then((meData: MeResponse) => {
                if (cancelled) return
                setCurrentUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        canRevealBuildingPassword: Boolean(meData?.canRevealBuildingPassword),
                        branchId: meData?.branchId ?? null,
                        total_points: meData?.total_points ?? 0,
                      }
                    : null
                )
              })
              .catch(() => {})
          })
          .catch(() => {
            try { sessionStorage.removeItem("referral_token") } catch {}
            try { localStorage.removeItem("referral_token") } catch {}
          })
      }

      // API 호출 2: 통합 me API (loginCount, approvalStatus, welcomeShown 포함)
      void fetch("/api/users/me", { signal: controller.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((data: MeResponse) => {
          if (cancelled) return

          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  canRevealBuildingPassword: Boolean(data?.canRevealBuildingPassword),
                  branchId: data?.branchId ?? null,
                  total_points: data?.total_points ?? 0,
                }
              : null
          )

          const approvalStatus = data?.approvalStatus ?? "none"

          if (approvalStatus !== "approved") {
            // 미승인 → 승인 확인 함수
            const checkApproval = () => {
              if (cancelled) return
              void fetch("/api/users/me", { cache: "no-store" })
                .then((r) => r.json())
                .then((meData: MeResponse) => {
                  if (cancelled || meData.approvalStatus !== "approved") return
                  if (approvalPoller) {
                    clearInterval(approvalPoller)
                    approvalPoller = null
                  }
                  if (visibilityListener) document.removeEventListener("visibilitychange", visibilityListener)
                  setCurrentUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          canRevealBuildingPassword: Boolean(meData?.canRevealBuildingPassword),
                          branchId: meData?.branchId ?? prev.branchId ?? null,
                          total_points: meData?.total_points ?? prev.total_points ?? 0,
                        }
                      : null
                  )
                  toast.success("🎉 승인됐어요! 이제 비밀번호를 확인할 수 있어요!")
                })
                .catch(() => {})
            }

            // 탭이 다시 활성화될 때 즉시 확인 (승인 직후 탭 복귀 시 바로 반영)
            visibilityListener = () => {
              if (document.visibilityState === "visible") checkApproval()
            }
            document.addEventListener("visibilitychange", visibilityListener)

            // 15초마다 폴링
            approvalPoller = setInterval(checkApproval, 15_000)
          }

          // 환영 메시지: welcomeShown === false 일 때만 표시
          if (data?.welcomeShown === false) {
            welcomeTimer = setTimeout(() => {
              if (!cancelled) setShowWelcome(true)
            }, 500)
          }
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
      controller.abort()
      if (welcomeTimer) clearTimeout(welcomeTimer)
      if (approvalPoller) clearInterval(approvalPoller)
      if (visibilityListener) document.removeEventListener("visibilitychange", visibilityListener)
    }
  }, [router])

  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false)
    fetch("/api/users/welcome", { method: "POST" }).catch(() => {})
  }, [])

  // 포인트 적립 직후 화면(왼쪽 위 표시)을 즉시 갱신하기 위한 함수.
  // 실패해도 조용히 무시 — 다음 me 호출이나 재로그인 시 자연 반영됨.
  const refreshPoints = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as MeResponse
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              total_points: data?.total_points ?? prev.total_points,
              canRevealBuildingPassword:
                data?.canRevealBuildingPassword ?? prev.canRevealBuildingPassword,
              branchId: data?.branchId ?? prev.branchId ?? null,
            }
          : prev
      )
    } catch {}
  }, [])

  const handleLogout = useCallback(async () => {
    await fetch("/api/activity/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "logout", pageUrl: window.location.pathname }),
      keepalive: true,
    }).catch(() => {})
    clearUserCache()
    clearBuildingsCache()
    await supabase.auth.signOut()
    router.replace("/login")
  }, [router])

  return { authStatus, currentUser, showWelcome, handleWelcomeClose, handleLogout, refreshPoints }
}

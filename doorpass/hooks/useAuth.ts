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
    supabase.auth.getUser().then(({ data: { user } }) => {
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

      setCurrentUser({ userId, userName, email })
      setAuthStatus("ok")

      fetch("/api/users/welcome")
        .then((r) => r.json())
        .then(({ welcome_shown }) => {
          if (welcome_shown === false) setTimeout(() => setShowWelcome(true), 500)
        })
        .catch(() => {})
    })
  }, [router])

  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false)
    fetch("/api/users/welcome", { method: "POST" }).catch(() => {})
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }, [router])

  return { authStatus, currentUser, showWelcome, handleWelcomeClose, handleLogout }
}

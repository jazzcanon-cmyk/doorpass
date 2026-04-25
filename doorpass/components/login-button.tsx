"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase-client"

type Provider = "google" | "kakao"

interface LoginButtonProps {
  provider: Provider
  redirectTo?: string
}

export function LoginButton({ provider, redirectTo }: LoginButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo ?? (typeof window !== "undefined" ? window.location.origin + "/auth/callback" : "/auth/callback"),
      },
    })
    if (error) {
      alert("로그인 중 오류가 발생했습니다: " + error.message)
      setLoading(false)
    }
  }

  if (provider === "kakao") {
    return (
      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%",
          background: loading ? "#c9a800" : "#FEE500",
          color: "#3C1E1E",
          fontWeight: 700,
          fontSize: 16,
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20 }}>💬</span>
        {loading ? "로그인 중..." : "카카오로 시작하기"}
      </button>
    )
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      style={{
        width: "100%",
        background: loading ? "#d0d0d0" : "#ffffff",
        color: "#3c4043",
        fontWeight: 600,
        fontSize: 16,
        padding: "14px 0",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.2)",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <GoogleIcon />
      {loading ? "로그인 중..." : "Google로 시작하기"}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

"use client"
import { useState } from "react"
import { Loader2 } from "lucide-react"
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "14px 20px",
          borderRadius: 12,
          backgroundColor: loading ? "#c9a800" : "#FEE500",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontWeight: 600,
          fontSize: 14,
          color: "#3C1E1E",
          boxShadow: "0 4px 16px rgba(254,229,0,0.25), 0 1px 3px rgba(0,0,0,0.2)",
          transition: "all 0.2s ease",
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.96)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)" }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)" }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
      >
        {loading ? (
          <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
        ) : (
          <KakaoIcon />
        )}
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "14px 20px",
        borderRadius: 12,
        backgroundColor: loading ? "#f0f0f0" : "#ffffff",
        border: "1.5px solid rgba(255,255,255,0.15)",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        fontWeight: 600,
        fontSize: 14,
        color: "#3c4043",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)",
        transition: "all 0.2s ease",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f8f8f8" }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ffffff" }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)" }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
    >
      {loading ? (
        <Loader2 style={{ width: 16, height: 16, color: "#9aa0a6", animation: "spin 1s linear infinite" }} />
      ) : (
        <GoogleIcon />
      )}
      {loading ? "로그인 중..." : "Google로 시작하기"}
    </button>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.1 1.26 3.945 3.165 5.085L3.75 15.75l3.57-2.34C7.59 13.47 8.29 13.5 9 13.5c4.14 0 7.5-2.69 7.5-6s-3.36-6-7.5-6z"
        fill="#3C1E1E"
      />
    </svg>
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

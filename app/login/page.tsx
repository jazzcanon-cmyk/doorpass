"use client"
import { useEffect, useState } from "react"
import { LoginButton } from "@/components/login-button"

export default function LoginPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const err = p.get("error")
    if (err === "unauthorized") {
      setErrorMsg("승인 대기 중입니다.\n대리점장님께 연락해주세요. 📞")
    } else if (err === "exchange_failed") {
      setErrorMsg("로그인 처리 중 오류가 발생했습니다.\n다시 시도해주세요.")
    }
  }, [])

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
        padding: 20,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🚚</div>
        <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, margin: 0 }}>신정대리점</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          CJ대한통운 택배 관리 시스템
        </p>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 20,
          padding: "32px 28px",
          width: "100%",
          maxWidth: 360,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h2
          style={{ color: "white", fontSize: 18, fontWeight: 600, textAlign: "center", margin: "0 0 8px" }}
        >
          로그인
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            textAlign: "center",
            margin: "0 0 24px",
          }}
        >
          승인된 기사님만 이용할 수 있어요
        </p>

        {errorMsg && (
          <div
            style={{
              background: "rgba(255,80,80,0.15)",
              border: "1px solid rgba(255,80,80,0.3)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 20,
              color: "#ff8080",
              fontSize: 13,
              textAlign: "center",
              whiteSpace: "pre-line",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <LoginButton provider="kakao" />

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
          </div>

          <LoginButton provider="google" />
        </div>

        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          미승인 계정은 접속이 제한됩니다
        </p>
      </div>
    </div>
  )
}

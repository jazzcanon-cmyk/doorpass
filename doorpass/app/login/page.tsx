"use client"
import { useEffect, useState } from "react"
import { Shield, MapPin, Package } from "lucide-react"
import { LoginButton } from "@/components/login-button"

export default function LoginPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const p = new URLSearchParams(window.location.search)
    const err = p.get("error")
    if (err === "unauthorized") {
      setErrorMsg("승인 대기 중입니다.\n대리점장님께 연락해주세요.")
    } else if (err === "exchange_failed") {
      setErrorMsg("로그인 처리 중 오류가 발생했습니다.\n다시 시도해주세요.")
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D2144 40%, #0A3A6B 100%)" }}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#0066B3 1px, transparent 1px), linear-gradient(90deg, #0066B3 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(0,102,179,0.18) 0%, transparent 70%)" }}
      />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(243,152,0,0.06) 0%, transparent 70%)" }}
      />

      {/* Logo & Brand */}
      <div
        className={`text-center mb-8 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        {/* Abstract logo: three overlapping circles */}
        <div className="relative inline-flex items-center justify-center mb-6" style={{ width: 72, height: 72 }}>
          <span
            className="absolute rounded-full"
            style={{
              width: 42, height: 42,
              background: "#E30A17",
              top: 0, left: 0,
              opacity: 0.92,
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 42, height: 42,
              background: "#F39800",
              top: 0, right: 0,
              opacity: 0.92,
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 42, height: 42,
              background: "#0066B3",
              bottom: 0, left: "50%",
              transform: "translateX(-50%)",
              opacity: 0.95,
            }}
          />
          {/* Center blend glow */}
          <span
            className="absolute rounded-full"
            style={{
              width: 20, height: 20,
              background: "rgba(255,255,255,0.18)",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              filter: "blur(4px)",
            }}
          />
        </div>

        <h1 className="text-white font-bold tracking-tight" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          신정대리점
        </h1>
        <p className="mt-1.5 font-medium" style={{ color: "#0066B3", fontSize: 13, letterSpacing: "0.04em" }}>
          CJ대한통운 택배 관리 시스템
        </p>
      </div>

      {/* Login card */}
      <div
        className={`w-full transition-all duration-700 delay-150 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
        style={{ maxWidth: 420 }}
      >
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,102,179,0.12) inset",
          }}
        >
          {/* Card header */}
          <div className="text-center mb-7">
            <h2 className="text-white font-semibold" style={{ fontSize: 17 }}>로그인</h2>
            <p className="mt-1" style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
              승인된 기사님만 이용하실 수 있습니다
            </p>
          </div>

          {/* Accent line */}
          <div className="mb-7 rounded-full h-px"
            style={{ background: "linear-gradient(90deg, transparent, #0066B3, #F39800, transparent)" }}
          />

          {errorMsg && (
            <div
              className="rounded-xl p-3.5 mb-6 text-sm text-center whitespace-pre-line leading-relaxed"
              style={{
                background: "rgba(227,10,23,0.1)",
                border: "1px solid rgba(227,10,23,0.25)",
                color: "#ff8a8a",
              }}
            >
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <LoginButton provider="kakao" />

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 12 }}>또는</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            <LoginButton provider="google" />
          </div>

          <p className="text-center mt-6" style={{ color: "rgba(255,255,255,0.18)", fontSize: 12 }}>
            미승인 계정은 접속이 제한됩니다
          </p>
        </div>
      </div>

      {/* Feature badges */}
      <div
        className={`flex items-center gap-6 mt-8 transition-all duration-700 delay-300 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {[
          { icon: <MapPin className="h-3.5 w-3.5" />, label: "위치 기반" },
          { icon: <Shield className="h-3.5 w-3.5" />, label: "보안 접속" },
          { icon: <Package className="h-3.5 w-3.5" />, label: "택배 전용" },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.22)", fontSize: 12 }}>
            {icon}
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Bottom brand */}
      <p className={`mt-6 transition-all duration-700 delay-500 ${mounted ? "opacity-100" : "opacity-0"}`}
        style={{ color: "rgba(255,255,255,0.12)", fontSize: 11 }}
      >
        © CJ대한통운
      </p>
    </div>
  )
}

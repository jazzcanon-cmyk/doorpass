"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, Loader2, CheckCircle2, XCircle, Bot, Hash } from "lucide-react"

type Scenario = "basic" | "post" | "alert" | "building"

const SCENARIOS: { key: Scenario; label: string; desc: string; color: string }[] = [
  { key: "basic",    label: "기본 연결 테스트",  desc: "연동 정상 여부 확인",     color: "text-blue-400" },
  { key: "post",     label: "새 게시글 알림",     desc: "게시글 작성 포맷",        color: "text-green-400" },
  { key: "alert",    label: "중요 검색어 알림",   desc: "긴급 키워드 감지",        color: "text-red-400" },
  { key: "building", label: "건물 등록 알림",     desc: "새 건물 등록 포맷",       color: "text-purple-400" },
]

interface StatusData {
  botTokenConfigured: boolean
  chatIdConfigured: boolean
  deployPlatform: "vercel" | "local"
  nodeEnv: string
}

export default function TelegramPage() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [scenario, setScenario] = useState<Scenario>("basic")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram/status")
      if (!res.ok) throw new Error("status fetch failed")
      setStatus((await res.json()) as StatusData)
    } catch {
      setStatus(null)
    } finally {
      setStatusLoaded(true)
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const sendTest = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      })
      setResult((await res.json()) as { ok: boolean; message?: string; error?: string })
    } catch {
      setResult({ ok: false, error: "네트워크 오류" })
    } finally {
      setSending(false)
    }
  }

  const configured = status?.botTokenConfigured && status?.chatIdConfigured

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Telegram 메시지</h1>
        <p className="text-sm text-white/40 mt-1">연동 상태 확인 및 테스트 전송</p>
      </div>

      {/* 연동 상태 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" /> 연동 상태
        </h2>

        {[
          { label: "Bot Token", env: "TELEGRAM_BOT_TOKEN", ok: status?.botTokenConfigured, icon: Bot },
          { label: "Chat ID",   env: "TELEGRAM_CHAT_ID",   ok: status?.chatIdConfigured,   icon: Hash },
        ].map(({ label, env, ok, icon: Icon }) => (
          <div key={env} className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="h-4 w-4 text-white/30 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-white/40">{env}</p>
              </div>
            </div>
            {!statusLoaded ? (
              <span className="text-xs text-white/30">확인 중…</span>
            ) : ok ? (
              <div className="flex items-center gap-2 text-green-400 flex-shrink-0">
                <CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">설정됨</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-400 flex-shrink-0">
                <XCircle className="h-4 w-4" /><span className="text-xs font-medium">미설정</span>
              </div>
            )}
          </div>
        ))}

        {statusLoaded && !configured && (
          <div className="mt-2 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300/80 text-xs leading-relaxed">
            {status?.deployPlatform === "vercel"
              ? "Vercel → Project → Settings → Environment Variables 에서 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID를 설정하세요."
              : ".env.local 파일에 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID를 설정하세요."}
          </div>
        )}
      </div>

      {/* 테스트 전송 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Send className="h-4 w-4 text-blue-400" /> 테스트 메시지 전송
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setScenario(s.key); setResult(null) }}
              className={`text-left p-3 rounded-xl border transition-all ${
                scenario === s.key
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <p className={`text-sm font-medium ${scenario === s.key ? "text-white" : "text-white/70"}`}>{s.label}</p>
              <p className={`text-xs mt-0.5 ${s.color}`}>{s.desc}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Telegram으로 테스트 전송
        </button>

        {result && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
            result.ok
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {result.ok
              ? <><CheckCircle2 className="h-4 w-4 flex-shrink-0" />{result.message}</>
              : <><XCircle className="h-4 w-4 flex-shrink-0" />전송 실패: {result.error}</>
            }
          </div>
        )}
      </div>

      {/* 설정 안내 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">환경변수 설정 안내</h2>
        <div className="space-y-2 text-xs text-white/50 leading-relaxed">
          <p>1. <span className="text-white/70">BotFather</span>에서 봇을 생성하고 <code className="bg-white/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code>을 발급받으세요.</p>
          <p>2. 봇을 채널/그룹에 추가하고 <code className="bg-white/10 px-1 rounded">TELEGRAM_CHAT_ID</code>를 확인하세요.</p>
          <p>3. {status?.deployPlatform === "vercel"
            ? "Vercel → Project → Settings → Environment Variables에서 설정 후 재배포하세요."
            : ".env.local 파일에 두 값을 추가 후 서버를 재시작하세요."
          }</p>
        </div>
      </div>
    </div>
  )
}

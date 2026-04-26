"use client"

import { useState, useEffect, useCallback } from "react"
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Bell,
  BellOff,
  History,
} from "lucide-react"

type Scenario = "basic" | "post" | "alert" | "building"

const SCENARIOS: { key: Scenario; label: string; desc: string; color: string }[] = [
  { key: "basic", label: "기본 연결 테스트", desc: "연동 정상 여부 확인", color: "text-blue-400" },
  { key: "post", label: "새 게시글 알림", desc: "게시글 작성 포맷", color: "text-green-400" },
  { key: "alert", label: "중요 검색어 알림", desc: "긴급 키워드 감지", color: "text-red-400" },
  { key: "building", label: "건물 등록 알림", desc: "새 건물 등록 포맷", color: "text-purple-400" },
]

const LS_PREFIX = "doorpass_slack_notify_"
const NOTIFY_KEYS = [
  { id: "post", label: "새 게시글 작성 시", desc: "게시판에 글 등록되면 알림" },
  { id: "keyword", label: "중요 검색어 감지 시", desc: "긴급·클레임 등 키워드 검색 시" },
  { id: "building", label: "새 건물 등록 시", desc: "건물 DB에 새 항목 추가 시" },
  { id: "user", label: "신규 가입 시", desc: "신규 기사님 연동 시 (미구현)" },
] as const

interface HistoryItem {
  id: number
  scenario: string
  ok: boolean
  created_at: string
}

function loadNotifyToggles(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  const out: Record<string, boolean> = {}
  for (const { id } of NOTIFY_KEYS) {
    const v = window.localStorage.getItem(LS_PREFIX + id)
    out[id] = v === null ? id !== "user" : v === "1"
  }
  return out
}

function saveNotifyToggle(id: string, on: boolean) {
  window.localStorage.setItem(LS_PREFIX + id, on ? "1" : "0")
}

export default function SlackPage() {
  const [scenario, setScenario] = useState<Scenario>("basic")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null)
  const [deployPlatform, setDeployPlatform] = useState<"vercel" | "local" | null>(null)
  const [nodeEnv, setNodeEnv] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [notifyToggles, setNotifyToggles] = useState<Record<string, boolean>>({})

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/slack/status")
      if (!res.ok) throw new Error("status")
      const j = (await res.json()) as {
        webhookConfigured?: boolean
        nodeEnv?: string
        deployPlatform?: "vercel" | "local"
      }
      setWebhookConfigured(Boolean(j.webhookConfigured))
      setNodeEnv(typeof j.nodeEnv === "string" ? j.nodeEnv : "development")
      setDeployPlatform(j.deployPlatform === "vercel" ? "vercel" : "local")
      setStatusLoaded(true)
    } catch {
      setWebhookConfigured(null)
      setDeployPlatform(null)
      setNodeEnv(null)
      setStatusLoaded(true)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/slack/history")
      const j = (await res.json()) as { items?: HistoryItem[] }
      setHistory(j.items ?? [])
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    setNotifyToggles(loadNotifyToggles())
    void loadStatus()
    void loadHistory()
  }, [loadStatus, loadHistory])

  const sendTest = async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`/api/slack/test?scenario=${scenario}`)
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string }
      setResult(json)
      if (json.ok) void loadHistory()
    } catch {
      setResult({ ok: false, error: "네트워크 오류" })
    } finally {
      setSending(false)
    }
  }

  const toggleNotify = (id: string) => {
    setNotifyToggles((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      saveNotifyToggle(id, next[id] ?? false)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Slack 메시지</h1>
        <p className="text-sm text-white/40 mt-1">연동 상태, 전송 기록, 테스트</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-400" /> 연동 상태
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Webhook URL</p>
              <p className="text-xs text-white/40 mt-0.5">SLACK_WEBHOOK_URL</p>
            </div>
            {!statusLoaded ? (
              <span className="text-xs text-white/30">확인 중…</span>
            ) : webhookConfigured === null ? (
              <span className="text-xs text-white/30">확인 실패</span>
            ) : webhookConfigured ? (
              <div className="flex items-center gap-2 text-green-400 flex-shrink-0">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">설정됨</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-400 flex-shrink-0">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">미설정</span>
              </div>
            )}
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">실행 환경</p>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                {!statusLoaded ? (
                  "환경 정보를 불러오는 중…"
                ) : deployPlatform === "vercel" ? (
                  <>
                    <span className="text-blue-300/90">Vercel</span>에서 동작 중입니다. Slack 등 비밀 값은{" "}
                    <span className="text-white/50">Vercel → Project → Settings → Environment Variables</span>
                    에서 설정합니다.
                  </>
                ) : deployPlatform === "local" ? (
                  <>
                    <span className="text-slate-300">로컬 또는 Vercel 외 서버</span>에서 동작 중입니다.{" "}
                    <span className="text-white/50">NODE_ENV={nodeEnv ?? "?"}</span> · Slack URL은{" "}
                    <span className="text-white/50">.env.local</span> 등 이 머신의 환경변수를 사용합니다.
                  </>
                ) : (
                  "환경 정보를 불러오지 못했습니다. 페이지를 새로고침 해 주세요."
                )}
              </p>
            </div>
            <div
              className={`flex items-center gap-2 flex-shrink-0 pt-0.5 ${
                !statusLoaded
                  ? "text-white/30"
                  : deployPlatform
                    ? "text-emerald-400/90"
                    : "text-white/35"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">
                {!statusLoaded ? "…" : deployPlatform ? "감지됨" : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-blue-400" /> 최근 전송 내역
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-6">테스트 전송 기록이 없습니다.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06]"
              >
                <span className="text-white/70">{h.scenario}</span>
                <span className="flex items-center gap-2 text-white/40">
                  {h.ok ? (
                    <span className="text-green-400/90">성공</span>
                  ) : (
                    <span className="text-red-400/90">실패</span>
                  )}
                  <span className="tabular-nums">
                    {new Date(h.created_at).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-blue-400" /> 테스트 메시지 전송
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setScenario(s.key)
                setResult(null)
              }}
              className={`text-left p-3 rounded-xl border transition-all ${
                scenario === s.key
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <p className={`text-sm font-medium ${scenario === s.key ? "text-white" : "text-white/70"}`}>
                {s.label}
              </p>
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
          Slack으로 테스트 전송
        </button>

        {result && (
          <div
            className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
              result.ok
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {result.ok ? (
              <>
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Slack 채널에 메시지가 전송됐습니다.
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 flex-shrink-0" /> 전송 실패: {result.error}
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">알림 on/off</h2>
        <p className="text-[11px] text-white/30 mb-4">
          이 기기 브라우저에만 저장됩니다. 서버 알림 로직과 연동하려면 추후 DB 설정이 필요합니다.
        </p>
        <div className="space-y-2">
          {NOTIFY_KEYS.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="min-w-0">
                <p className="text-sm text-white flex items-center gap-2">
                  {notifyToggles[n.id] ? (
                    <Bell className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
                  )}
                  {n.label}
                </p>
                <p className="text-xs text-white/40 mt-0.5">{n.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotify(n.id)}
                className={`relative rounded-full transition-colors flex-shrink-0 ${
                  notifyToggles[n.id] ? "bg-blue-600" : "bg-white/10"
                }`}
                style={{ height: 22, width: 40 }}
                aria-pressed={notifyToggles[n.id]}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    notifyToggles[n.id] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

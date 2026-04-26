"use client"

import { useState } from "react"
import { Bell, Shield, Server, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"

const ENV_VARS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL",        label: "Supabase URL",            required: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",   label: "Supabase Anon Key",       required: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY",       label: "Service Role (승인 조회)", required: false },
  { key: "SLACK_WEBHOOK_URL",               label: "Slack Webhook URL",       required: true },
  { key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", label: "Google Maps API Key",     required: false },
] as const

const NOTIFY_SETTINGS = [
  { id: "notify_post",     label: "새 게시글 알림",    desc: "게시판에 글 등록 시 Slack 알림",       defaultOn: true },
  { id: "notify_keyword",  label: "중요 키워드 알림",  desc: "긴급·클레임 등 키워드 감지 시 알림",   defaultOn: true },
  { id: "notify_building", label: "건물 등록 알림",    desc: "새 건물 DB 등록 시 Slack 알림",        defaultOn: true },
  { id: "notify_user",     label: "신규 가입 알림",    desc: "기사님 카카오 로그인 최초 가입 시",     defaultOn: false },
]

const KEYWORDS = ["배송지연", "클레임", "긴급", "사고", "분실"]

interface EnvStatus { key: string; set: boolean | null; required?: boolean }

export default function SettingsPage() {
  const [envStatuses, setEnvStatuses] = useState<EnvStatus[]>([])
  const [checking, setChecking] = useState(false)
  const [notifyToggles, setNotifyToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFY_SETTINGS.map(n => [n.id, n.defaultOn]))
  )
  const [showKey, setShowKey] = useState(false)

  const checkEnv = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/admin/env-check")
      const json = await res.json() as { vars: EnvStatus[] }
      setEnvStatuses(json.vars ?? [])
    } catch {
      setEnvStatuses(ENV_VARS.map(v => ({ key: v.key, set: null })))
    } finally {
      setChecking(false)
    }
  }

  const toggleNotify = (id: string) =>
    setNotifyToggles(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-sm text-white/40 mt-1">알림·보안·환경변수 설정</p>
      </div>

      {/* 알림 설정 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-400" /> 알림 설정
        </h2>
        <div className="space-y-2">
          {NOTIFY_SETTINGS.map(n => (
            <div key={n.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div>
                <p className="text-sm text-white">{n.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{n.desc}</p>
              </div>
              <button
                onClick={() => toggleNotify(n.id)}
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                  notifyToggles[n.id] ? "bg-blue-600" : "bg-white/10"
                }`}
                style={{ height: "22px", width: "40px" }}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  notifyToggles[n.id] ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          ))}
        </div>

        {/* 중요 키워드 목록 */}
        <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-xs font-semibold text-white/50 mb-2">중요 키워드 (코드 설정)</p>
          <div className="flex flex-wrap gap-2">
            {KEYWORDS.map(kw => (
              <span key={kw} className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                {kw}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/25 mt-2">
            변경하려면 <code className="text-white/40">app/api/analytics/track/route.ts</code> 의 IMPORTANT_KEYWORDS 수정
          </p>
        </div>
      </div>

      {/* 보안 설정 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" /> 보안 설정
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">관리자 접근 제한</p>
              <p className="text-xs text-white/40 mt-0.5">approved_users 테이블 role=admin 만 허용</p>
            </div>
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> 활성
            </div>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">카카오 OAuth 로그인</p>
              <p className="text-xs text-white/40 mt-0.5">Supabase Auth Provider</p>
            </div>
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> 활성
            </div>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">Row Level Security</p>
              <p className="text-xs text-white/40 mt-0.5">Supabase RLS 정책 적용됨</p>
            </div>
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> 활성
            </div>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">API 키 노출 여부</p>
              <p className="text-xs text-white/40 mt-0.5">NEXT_PUBLIC_ 접두사 키는 브라우저에 노출됨</p>
            </div>
            <button
              onClick={() => setShowKey(v => !v)}
              className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showKey ? "숨기기" : "상세 보기"}
            </button>
          </div>
          {showKey && (
            <div className="mt-1 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400/80 leading-relaxed">
              <p className="font-semibold mb-1">주의 사항</p>
              <ul className="list-disc list-inside space-y-0.5 text-yellow-400/60">
                <li>NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY는 클라이언트에 노출됩니다.</li>
                <li>Anon Key는 RLS로 보호되므로 노출되어도 안전합니다.</li>
                <li>SLACK_WEBHOOK_URL, GOOGLE_MAPS_API_KEY는 서버 전용으로 노출되지 않습니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 환경변수 확인 */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-400" /> 환경변수 확인
          </h2>
          <button
            onClick={checkEnv}
            disabled={checking}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {checking ? "확인 중..." : "상태 확인"}
          </button>
        </div>

        <div className="space-y-2">
          {ENV_VARS.map(v => {
            const status = envStatuses.find(s => s.key === v.key)
            return (
              <div key={v.key} className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <p className="text-sm text-white font-mono text-xs">{v.key}</p>
                  <p className="text-xs text-white/40 mt-0.5">{v.label}{v.required ? "" : " (선택)"}</p>
                </div>
                {status == null ? (
                  <span className="text-xs text-white/20">미확인</span>
                ) : status.set === null ? (
                  <div className="flex items-center gap-1.5 text-white/30 text-xs"><AlertCircle className="h-3.5 w-3.5" /> 오류</div>
                ) : status.set ? (
                  <div className="flex items-center gap-1.5 text-green-400 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 설정됨</div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <AlertCircle className="h-3.5 w-3.5" /> {v.required ? "누락!" : "미설정"}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-white/25 mt-3">
          &quot;상태 확인&quot; 버튼을 누르면 서버에서 환경변수 설정 여부를 확인합니다 (값은 노출되지 않음).
        </p>
      </div>
    </div>
  )
}

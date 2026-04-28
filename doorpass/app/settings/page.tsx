"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, ShieldCheck, Clock, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface RoleRequest {
  id: string
  status: "pending" | "approved" | "rejected"
  reason: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export default function SettingsPage() {
  const [role, setRole] = useState<string>("driver")
  const [pending, setPending] = useState<RoleRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [meRes, reqRes] = await Promise.all([
        fetch("/api/users/me"),
        fetch("/api/role-requests"),
      ])
      if (meRes.ok) {
        const me = await meRes.json()
        setRole(me.role ?? "driver")
      }
      if (reqRes.ok) {
        const { requests } = await reqRes.json()
        const found = (requests as RoleRequest[]).find((r) => r.status === "pending") ?? null
        setPending(found)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("요청 사유를 10자 이상 입력해주세요.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/role-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "요청 실패")
        return
      }
      toast.success("권한 요청이 전송되었습니다. 관리자 승인 후 알려드립니다.")
      setReason("")
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel =
    role === "admin" ? "관리자" : role === "editor" ? "편집자" : "일반 사용자"

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-bold">설정</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-xl space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-400" /> 내 권한
          </h2>
          <p className="text-xs text-white/50 mb-4">
            현재 역할: <span className="font-semibold text-white">{roleLabel}</span>
          </p>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          ) : role !== "driver" ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              건물 정보를 수정할 수 있는 권한이 있습니다.
            </div>
          ) : pending ? (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              편집자 권한 요청이 대기 중입니다. 관리자 승인을 기다려주세요.
            </div>
          ) : (
            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-blue-400" /> 편집자 권한 요청
              </h3>
              <p className="text-xs text-white/50 mb-3">
                건물 정보(비밀번호·이름·메모)를 수정하려면 편집자 권한이 필요합니다.
              </p>
              <textarea
                placeholder="권한이 필요한 사유를 입력해주세요 (10자 이상)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 mb-3"
              />
              <Button onClick={submit} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "권한 요청"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

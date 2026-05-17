"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, Building2, Loader2, Clock, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Branch {
  id: string
  name: string
  region: string
  type?: string | null
}

type ApprovalStatus = "loading" | "none" | "pending" | "approved"

export function ApprovalRequestModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("none")
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)

  const isEtc = selected === "etc-branch"

  useEffect(() => {
    if (!open) {
      setSelected("")
      setReason("")
      setTermsChecked(false)
      setPurposeChecked(false)
      return
    }

    setApprovalStatus("loading")

    // 승인 상태 조회 (silent background — 실패 시 'none'으로 폴백)
    void (async () => {
      try {
        const res = await fetch("/api/users/approval-status")
        if (!res.ok) {
          setApprovalStatus("none")
          return
        }
        const d = (await res.json()) as { status?: string }
        const s = d.status ?? "none"
        if (s === "approved") { onOpenChange(false); return }
        setApprovalStatus(s === "pending" ? "pending" : "none")
      } catch {
        setApprovalStatus("none")
      }
    })()

    // 대리점 목록 조회 (silent background — 실패 시 빈 배열)
    void (async () => {
      try {
        const res = await fetch("/api/branches")
        if (!res.ok) {
          setBranches([])
          return
        }
        const d = await res.json()
        setBranches(Array.isArray(d.branches) ? d.branches : [])
      } catch {
        setBranches([])
      }
    })()
  }, [open, onOpenChange])

  // type='branch'만 필터
  const branchOnly = useMemo(
    () => branches.filter((b) => !b.type || b.type === "branch"),
    [branches]
  )

  const branchesByRegion = useMemo(() => {
    return branchOnly.reduce<Record<string, Branch[]>>((acc, b) => {
      if (!acc[b.region]) acc[b.region] = []
      acc[b.region].push(b)
      return acc
    }, {})
  }, [branchOnly])

  const canSubmit =
    !!selected &&
    termsChecked &&
    purposeChecked &&
    (!isEtc || reason.trim().length >= 2)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selected,
          reason: isEtc ? reason.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "요청에 실패했습니다.")
        return
      }
      const data = (await res.json()) as { status?: string; message?: string }

      if (data.status === "approved" || String(data.message ?? "").includes("이미 승인")) {
        toast.success("이미 승인된 계정입니다.")
        onOpenChange(false)
        return
      }

      toast.success("승인 요청이 접수됐습니다. 승인 후 비밀번호를 볼 수 있어요.")
      setApprovalStatus("pending")
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-full max-w-md overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">비밀번호를 보려면 승인이 필요해요</DialogTitle>
          <p className="text-left text-sm text-white/60">
            소속 대리점을 선택하고 약관에 동의하면 승인 요청이 전달됩니다.
          </p>
        </DialogHeader>

        {approvalStatus === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        )}

        {approvalStatus === "pending" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock className="h-10 w-10 text-yellow-400" />
            <p className="text-base font-semibold text-white">승인 대기 중입니다</p>
            <p className="text-sm text-white/60">
              관리자가 요청을 검토 중이에요. 승인이 완료되면 알림을 드릴게요.
            </p>
          </div>
        )}

        {approvalStatus === "none" && (
          <>
            {/* 대리점 목록 */}
            <div className="max-h-[32vh] overflow-y-auto space-y-3 pr-1">
              {Object.entries(branchesByRegion).map(([region, list]) => (
                <div key={region}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-white">{region}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {list.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => { setSelected(branch.id); setReason("") }}
                        className={`rounded-lg border-2 p-3 text-left transition-colors ${
                          selected === branch.id
                            ? "border-blue-500 bg-blue-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className={`h-4 w-4 shrink-0 ${selected === branch.id ? "text-blue-400" : "text-white/40"}`} />
                          <span className="text-sm font-medium text-white">{branch.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* 기타 옵션 */}
              <button
                type="button"
                onClick={() => setSelected("etc-branch")}
                className={`w-full rounded-lg border-2 p-3 text-left transition-colors flex items-center gap-2 ${
                  isEtc
                    ? "border-amber-500 bg-amber-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                }`}
              >
                <HelpCircle className={`h-4 w-4 shrink-0 ${isEtc ? "text-amber-400" : "text-white/40"}`} />
                <div>
                  <span className="text-sm font-medium text-white">기타 (소속 대리점 없음)</span>
                  <p className="text-[11px] text-white/40 mt-0.5">쿠팡, 한진 등 자영업 기사님</p>
                </div>
              </button>
            </div>

            {/* 기타 사유 입력 */}
            {isEtc && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5">소속/사유 입력 <span className="text-red-400">(필수)</span></label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 쿠팡 기사, 한진택배 등"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            {/* 약관 동의 */}
            {selected && (
              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40">이용약관 동의</p>
                <div
                  onClick={() => setTermsChecked((v) => !v)}
                  style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"10px", borderRadius:"8px", cursor:"pointer", background: termsChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", border: termsChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)", userSelect:"none" }}
                >
                  <div style={{ width:"18px", height:"18px", minWidth:"18px", borderRadius:"5px", marginTop:"1px", background: termsChecked ? "#3b82f6" : "transparent", border: termsChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {termsChecked && <span style={{ color:"white", fontSize:"11px", fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"13px", lineHeight:"1.5" }}>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color:"#60a5fa", textDecoration:"underline" }}>이용약관</a>에 동의합니다.{" "}
                    <span style={{ color:"#f87171", fontWeight:600 }}>(필수)</span>
                  </span>
                </div>
                <div
                  onClick={() => setPurposeChecked((v) => !v)}
                  style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"10px", borderRadius:"8px", cursor:"pointer", background: purposeChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", border: purposeChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)", userSelect:"none" }}
                >
                  <div style={{ width:"18px", height:"18px", minWidth:"18px", borderRadius:"5px", marginTop:"1px", background: purposeChecked ? "#3b82f6" : "transparent", border: purposeChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {purposeChecked && <span style={{ color:"white", fontSize:"11px", fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"13px", lineHeight:"1.5" }}>
                    비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{" "}
                    <span style={{ color:"#f87171", fontWeight:600 }}>(필수)</span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {approvalStatus === "pending" ? "닫기" : "취소"}
          </Button>
          {approvalStatus === "none" && (
            <Button
              type="button"
              className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              disabled={submitting || !canSubmit}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              승인 신청하기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, Building2, Loader2, Clock } from "lucide-react"
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
  const [submitting, setSubmitting] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("none")
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected("")
      setTermsChecked(false)
      setPurposeChecked(false)
      return
    }

    setApprovalStatus("loading")

    void fetch("/api/users/approval-status")
      .then((r) => r.json())
      .then((d: { status?: string }) => {
        const s = d.status ?? "none"
        if (s === "approved") {
          onOpenChange(false)
          return
        }
        setApprovalStatus(s === "pending" ? "pending" : "none")
      })
      .catch(() => setApprovalStatus("none"))

    void fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d.branches) ? d.branches : []))
      .catch(() => setBranches([]))
  }, [open, onOpenChange])

  const branchesByRegion = useMemo(() => {
    return branches.reduce<Record<string, Branch[]>>((acc, b) => {
      if (!acc[b.region]) acc[b.region] = []
      acc[b.region].push(b)
      return acc
    }, {})
  }, [branches])

  const canSubmit = !!selected && termsChecked && purposeChecked

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "요청 실패")

      if (data.status === "approved" || String(data.message ?? "").includes("이미 승인")) {
        toast.success("이미 승인된 계정입니다.")
        onOpenChange(false)
        return
      }

      toast.success("승인 요청이 접수되었습니다. 관리자 승인 후 비밀번호를 볼 수 있어요.")
      setApprovalStatus("pending")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "요청에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-md overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">
            비밀번호를 보려면 승인이 필요해요
          </DialogTitle>
          <p className="text-left text-sm text-white/60">
            소속 대리점을 선택하고 약관에 동의하면 관리자에게 승인 요청이 전달됩니다.
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
            {/* 대리점 선택 */}
            <div className="max-h-[35vh] space-y-4 overflow-y-auto pr-1">
              {Object.entries(branchesByRegion).map(([region, list]) => (
                <div key={region}>
                  <div className="mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-white">{region}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {list.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => setSelected(branch.id)}
                        className={`rounded-lg border-2 p-3 text-left transition-colors ${
                          selected === branch.id
                            ? "border-blue-500 bg-blue-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2
                            className={`h-4 w-4 shrink-0 ${selected === branch.id ? "text-blue-400" : "text-white/40"}`}
                          />
                          <span className="text-sm font-medium text-white">{branch.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">이용약관 동의</p>
              <div
                onClick={() => setTermsChecked((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: termsChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                  border: termsChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: "18px", height: "18px", minWidth: "18px", borderRadius: "5px", marginTop: "1px",
                    background: termsChecked ? "#3b82f6" : "transparent",
                    border: termsChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {termsChecked && <span style={{ color: "white", fontSize: "11px", fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px", lineHeight: "1.5" }}>
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "#60a5fa", textDecoration: "underline" }}
                  >
                    이용약관
                  </a>
                  에 동의합니다.{" "}
                  <span style={{ color: "#f87171", fontWeight: 600 }}>(필수)</span>
                </span>
              </div>

              <div
                onClick={() => setPurposeChecked((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: purposeChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                  border: purposeChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: "18px", height: "18px", minWidth: "18px", borderRadius: "5px", marginTop: "1px",
                    background: purposeChecked ? "#3b82f6" : "transparent",
                    border: purposeChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {purposeChecked && <span style={{ color: "white", fontSize: "11px", fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px", lineHeight: "1.5" }}>
                  비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{" "}
                  <span style={{ color: "#f87171", fontWeight: 600 }}>(필수)</span>
                </span>
              </div>
            </div>
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

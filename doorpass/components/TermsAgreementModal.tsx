"use client"

import { useState } from "react"
import { Shield, AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface TermsAgreementModalProps {
  onAgreed: () => void
}

export function TermsAgreementModal({ onAgreed }: TermsAgreementModalProps) {
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = termsChecked && purposeChecked

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/users/terms-check", { method: "POST" })
      if (!res.ok) throw new Error("동의 저장 실패")
      onAgreed()
    } catch {
      toast.error("약관 동의 저장에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400 shrink-0" />
          <h2 className="text-base font-bold text-white">이용약관 동의</h2>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">
            서비스 이용 전 이용약관에 동의하셔야 합니다.
            비밀번호 정보는 <strong>배송 업무 목적으로만</strong> 사용해야 하며,
            위반 시 모든 법적 책임은 사용자 본인에게 있습니다.
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group select-none py-2 px-1 rounded-lg active:bg-white/5">
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="h-5 w-5 accent-blue-500 cursor-pointer"
              />
            </div>
            <span className="text-sm text-white/80 leading-relaxed">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline underline-offset-2 hover:text-blue-300 inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                이용약관 <ExternalLink className="h-3 w-3" />
              </a>
              에 동의합니다.{" "}
              <span className="text-red-400 font-medium">(필수)</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group select-none py-2 px-1 rounded-lg active:bg-white/5">
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={purposeChecked}
                onChange={(e) => setPurposeChecked(e.target.checked)}
                className="h-5 w-5 accent-blue-500 cursor-pointer"
              />
            </div>
            <span className="text-sm text-white/80 leading-relaxed group-active:text-white">
              비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{" "}
              <span className="text-red-400 font-medium">(필수)</span>
            </span>
          </label>
        </div>

        <Button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "동의하고 시작하기"
          )}
        </Button>

        <p className="text-[11px] text-white/25 text-center">
          동의하지 않으면 서비스를 이용할 수 없습니다.
        </p>
      </div>
    </div>
  )
}

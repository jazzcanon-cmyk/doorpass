"use client"
import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { DeliveryVolume, DeliveryPayType } from "@/types/delivery"

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  branchId?: string | null
}

export function DeliveryRequestModal({ open, onClose, onCreated, branchId }: Props) {
  const [requestDate, setRequestDate] = useState("")
  const [volume, setVolume] = useState<DeliveryVolume>("small")
  const [payType, setPayType] = useState<DeliveryPayType>("per_item")
  const [payAmount, setPayAmount] = useState("")
  const [area, setArea] = useState("")
  const [memo, setMemo] = useState("")
  const [contact, setContact] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const reset = () => {
    setRequestDate("")
    setVolume("small")
    setPayType("per_item")
    setPayAmount("")
    setArea("")
    setMemo("")
    setContact("")
  }

  const submit = async () => {
    if (!requestDate) return toast.error("날짜를 선택해주세요")
    if (!contact.trim()) return toast.error("연락처를 입력해주세요")
    if (payType !== "negotiable" && !payAmount) return toast.error("금액을 입력해주세요")

    setSubmitting(true)
    try {
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          requestDate,
          volume,
          payType,
          payAmount: payType === "negotiable" ? null : Number(payAmount),
          area,
          memo,
          contact,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "등록 실패")
      toast.success("대체배송 요청 등록 완료")
      reset()
      onCreated()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록 실패")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">🚚 대체배송 요청</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">날짜 *</label>
            <Input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">물량 *</label>
            <div className="grid grid-cols-1 gap-1.5">
              {(
                [
                  { v: "small" as const, label: "소량 (50개 이하)" },
                  { v: "medium" as const, label: "중량 (50~100개)" },
                  { v: "large" as const, label: "대량 (100개 이상)" },
                ] satisfies { v: DeliveryVolume; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setVolume(opt.v)}
                  className={`px-3 py-2.5 text-sm rounded-lg border text-left transition ${
                    volume === opt.v
                      ? "bg-blue-500/20 border-blue-400 text-white"
                      : "bg-white/5 border-white/10 text-white/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">단가 방식 *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { v: "per_item" as const, label: "건당" },
                  { v: "per_day" as const, label: "일당" },
                  { v: "negotiable" as const, label: "협의" },
                ] satisfies { v: DeliveryPayType; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPayType(opt.v)}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    payType === opt.v
                      ? "bg-blue-500/20 border-blue-400 text-white"
                      : "bg-white/5 border-white/10 text-white/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {payType !== "negotiable" && (
              <Input
                type="number"
                inputMode="numeric"
                placeholder="금액 (원)"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-2"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">구역 설명</label>
            <Input
              type="text"
              placeholder="예: 남구 신정동 일대"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">메모</label>
            <Textarea
              rows={3}
              placeholder="추가로 전달할 내용"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              연락처 * <span className="text-white/40">(매칭 후 공개)</span>
            </label>
            <Input
              type="tel"
              placeholder="010-1234-5678"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-white/10 px-4 py-3 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-white/70">
            취소
          </Button>
          <Button onClick={submit} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "등록하기"}
          </Button>
        </div>
      </div>
    </div>
  )
}

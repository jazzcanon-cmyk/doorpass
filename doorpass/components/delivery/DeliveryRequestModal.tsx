"use client"
import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { type DeliveryVolume, type DeliveryPayType, type PostType, VOLUME_OPTIONS } from "@/types/delivery"

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  branchId?: string | null
  postType?: PostType
}

export function DeliveryRequestModal({ open, onClose, onCreated, branchId, postType = "request" }: Props) {
  const isOffer = postType === "offer"

  const [requestDate, setRequestDate] = useState("")
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [volume, setVolume] = useState<DeliveryVolume>("v50")
  const [payType, setPayType] = useState<DeliveryPayType>("per_item")
  const [payAmount, setPayAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [contact, setContact] = useState("")
  const [availableVolume, setAvailableVolume] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const DISTRICTS = ["전체", "남구", "북구", "중구", "동구", "울주군"]

  if (!open) return null

  const reset = () => {
    setRequestDate("")
    setSelectedDistrict(null)
    setVolume("v50")
    setPayType("per_item")
    setPayAmount("")
    setMemo("")
    setContact("")
    setAvailableVolume("")
  }

  const submit = async () => {
    if (!requestDate) return toast.error("날짜를 선택해주세요")
    if (selectedDistrict === null) return toast.error("지역을 선택해주세요")
    if (!contact.trim()) return toast.error("연락처를 입력해주세요")
    if (payType !== "negotiable" && !payAmount) return toast.error("금액을 입력해주세요")
    if (payType !== "negotiable" && Number(payAmount) <= 0) return toast.error("금액은 1원 이상이어야 합니다")

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
          area: selectedDistrict === "전체" ? "" : selectedDistrict,
          memo,
          contact,
          postType,
          ...(isOffer && {
            availableDate: requestDate,
            availableArea: selectedDistrict === "전체" ? "" : selectedDistrict,
            availableVolume: availableVolume ? Number(availableVolume) : null,
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "등록 실패")
      toast.success(isOffer ? "할게요 등록 완료" : "대체배송 요청 등록 완료")
      reset()
      onCreated()
      onClose()
    } catch (e) {
      toast.error("등록 실패")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            {isOffer ? "🙋 대체배송 할게요" : "🚚 대체배송 구해요"}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              {isOffer ? "가능 날짜 *" : "날짜 *"}
            </label>
            <Input
              type="date"
              value={requestDate}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
              onChange={(e) => setRequestDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">지역 선택 *</label>
            <div className="flex flex-wrap gap-1.5">
              {DISTRICTS.map((district) => (
                <button
                  key={district}
                  type="button"
                  onClick={() => setSelectedDistrict(district)}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    selectedDistrict === district
                      ? "bg-blue-500/20 border-blue-400 text-white"
                      : "bg-white/5 border-white/10 text-white/70"
                  }`}
                >
                  {district}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">물량 *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {VOLUME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVolume(opt.value)}
                  className={`px-3 py-2.5 text-sm rounded-lg border text-left transition ${
                    volume === opt.value
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
                type="tel"
                inputMode="decimal"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="금액 (원)"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 300) }}
                className="bg-white/5 border-white/10 text-white mt-2"
              />
            )}
          </div>

          {isOffer && (
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">가능 물량 (건)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="예: 100"
                min="0"
                value={availableVolume}
                onChange={(e) => setAvailableVolume(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

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

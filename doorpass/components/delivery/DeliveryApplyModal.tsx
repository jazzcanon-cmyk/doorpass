"use client"
import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  open: boolean
  requestId: number | string | null
  onClose: () => void
  onApplied: () => void
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

export function DeliveryApplyModal({ open, requestId, onClose, onApplied }: Props) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open || requestId == null) return null

  const phoneDigits = phone.replace(/\D/g, "")
  const isValid = name.trim().length > 0 && phoneDigits.length >= 10

  const handleClose = () => {
    setName("")
    setPhone("")
    setMessage("")
    onClose()
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const submit = async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/delivery/${requestId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "신청 실패")
      toast.success("신청 완료")
      setName("")
      setPhone("")
      setMessage("")
      onApplied()
      onClose()
    } catch (e) {
      toast.error("신청 실패")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">대체배송 신청</h2>
          <button onClick={handleClose} className="text-white/60 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              이름 <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              휴대폰번호 <span className="text-red-400">*</span>
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">메모 (선택)</label>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="요청자에게 한 마디를 남겨보세요"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          {!isValid && (
            <p className="text-xs text-red-400">이름과 휴대폰번호는 필수 항목입니다</p>
          )}
        </div>
        <div className="border-t border-white/10 px-4 py-3 flex gap-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1 text-white/70">
            취소
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !isValid}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "신청 완료"}
          </Button>
        </div>
      </div>
    </div>
  )
}

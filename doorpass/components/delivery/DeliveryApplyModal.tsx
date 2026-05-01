"use client"
import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  open: boolean
  requestId: number | string | null
  onClose: () => void
  onApplied: () => void
}

export function DeliveryApplyModal({ open, requestId, onClose, onApplied }: Props) {
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open || requestId == null) return null

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/delivery/${requestId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "신청 실패")
      toast.success("신청 완료")
      setMessage("")
      onApplied()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "신청 실패")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">대체배송 신청</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <label className="block text-xs font-medium text-white/70 mb-1.5">한 마디 (선택)</label>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="요청자에게 한 마디를 남겨보세요"
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
        <div className="border-t border-white/10 px-4 py-3 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-white/70">
            취소
          </Button>
          <Button onClick={submit} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "신청 완료"}
          </Button>
        </div>
      </div>
    </div>
  )
}

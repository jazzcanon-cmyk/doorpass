"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface NewBuildingModalProps {
  open: boolean
  onClose: () => void
  branchId?: string | null
  userEmail: string
  onSuccess: () => void
}

const REGIONS = ["울산", "부산", "대구", "서울", "경기", "기타"]

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm " +
  "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
  "placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500"

const LABEL_CLS = "block text-sm font-medium mb-1.5 text-gray-900 dark:text-white"

export function NewBuildingModal({
  open,
  onClose,
  branchId,
  userEmail,
  onSuccess,
}: NewBuildingModalProps) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    password: "",
    memo: "",
    region: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetAndClose = () => {
    setForm({ name: "", address: "", password: "", memo: "", region: "" })
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("건물명을 입력해주세요.")
      return
    }
    if (!form.address.trim()) {
      toast.error("주소를 입력해주세요.")
      return
    }
    if (form.password.length < 4) {
      toast.error("비밀번호는 4자리 이상 입력해주세요.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          password: form.password,
          memo: form.memo.trim() || null,
          region: form.region || null,
          branch_id: branchId ?? null,
          uploaded_by: userEmail,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "등록 실패")

      toast.success("새 건물이 등록되었습니다! 감사합니다 🎉")
      resetAndClose()
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "건물 등록에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose() }}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>새 건물 비밀번호 등록</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-3 py-2">
          🎁 새 건물을 등록하면 포인트가 적립됩니다!
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className={LABEL_CLS}>
              건물명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예) 롯데캐슬 101동"
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="예) 울산시 남구 삼산로 123"
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="4자리 이상"
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className={LABEL_CLS}>지역</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">선택 (선택사항)</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>메모 (선택)</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="추가 정보 (예: 공동현관, 2층 계단 옆)"
              rows={2}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "등록하기"}
            </Button>
            <Button type="button" onClick={resetAndClose} variant="outline" className="flex-1">
              취소
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

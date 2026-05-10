"use client"
import { useState } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Props {
  ratedEmail: string
  deliveryRequestId?: number | null
  onSuccess?: () => void
}

export function RatingForm({ ratedEmail, deliveryRequestId, onSuccess }: Props) {
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected === 0) {
      toast.error("별점을 선택해주세요.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/delivery/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratedEmail,
          deliveryRequestId: deliveryRequestId ?? null,
          rating: selected,
          comment: comment.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "평점 등록 실패")
        return
      }
      toast.success("평점이 등록되었습니다.")
      setSelected(0)
      setComment("")
      onSuccess?.()
    } catch {
      toast.error("네트워크 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setSelected(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${n}점`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                n <= (hovered || selected)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-white/30"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="코멘트 (선택)"
        rows={2}
        maxLength={300}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30"
      />
      <Button
        type="submit"
        disabled={submitting || selected === 0}
        size="sm"
        className="self-end bg-blue-600 hover:bg-blue-500 text-white"
      >
        {submitting ? "등록 중..." : "평점 등록"}
      </Button>
    </form>
  )
}

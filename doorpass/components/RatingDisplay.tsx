"use client"
import { useEffect, useState } from "react"
import { Star } from "lucide-react"

interface Props {
  email: string
}

interface RatingData {
  average: number
  count: number
}

export function RatingDisplay({ email }: Props) {
  const [data, setData] = useState<RatingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) return
    fetch(`/api/delivery/ratings/average?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d: RatingData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [email])

  if (loading) return <span className="text-white/40 text-sm">평점 로딩 중...</span>
  if (!data || data.count === 0) return <span className="text-white/40 text-sm">평점 없음</span>

  return (
    <span className="inline-flex items-center gap-1 text-sm text-white/80">
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      <span className="font-semibold text-yellow-400">{data.average.toFixed(1)}</span>
      <span className="text-white/40">({data.count}건)</span>
    </span>
  )
}

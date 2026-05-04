"use client"
import { useState, useEffect } from "react"
import type { Stats } from "@/types/analytics"

export function useAnalyticsStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/analytics/stats")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError("데이터를 불러오지 못했습니다."); return }
        setStats(d)
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}

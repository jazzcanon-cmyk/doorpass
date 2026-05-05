"use client"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import type { Memo } from "@/types/calendar"

export function useCalendarMemos() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchMemos = useCallback(async () => {
    setFetchError(null)
    try {
      const res = await fetch("/api/calendar")
      const data = await res.json()
      if (!res.ok) { setFetchError(data.error ?? "메모를 불러오지 못했습니다."); return }
      setMemos(data.memos ?? [])
    } catch {
      setFetchError("네트워크 오류로 메모를 불러오지 못했습니다.")
    }
  }, [])

  useEffect(() => { fetchMemos() }, [fetchMemos])

  const deleteMemo = useCallback(async (id: number) => {
    if (!confirm("삭제하시겠어요?")) return
    try {
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      await fetchMemos()
    } catch {
      toast.error("삭제 중 오류가 발생했습니다.")
    }
  }, [fetchMemos])

  return { memos, fetchError, fetchMemos, deleteMemo }
}

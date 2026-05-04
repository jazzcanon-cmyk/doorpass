"use client"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import type { ResourceItem } from "@/types/resource"

export function useResources() {
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch("/api/resources")
      const d = await r.json()
      if (d.error) { setError("자료를 불러오지 못했습니다."); return }
      setResources(d.resources ?? [])
    } catch {
      setError("자료를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchResources() }, [fetchResources])

  const deleteResource = useCallback(async (id: number) => {
    if (!confirm("삭제하시겠어요?")) return
    try {
      const r = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      if (!r.ok) { toast.error("삭제 실패"); return }
      setResources((prev) => prev.filter((item) => item.id !== id))
      toast.success("삭제됐습니다.")
    } catch { toast.error("삭제 실패") }
  }, [])

  return { resources, loading, error, fetchResources, deleteResource }
}

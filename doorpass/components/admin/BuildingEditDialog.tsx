"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface BuildingDetailPayload {
  id: number
  name: string
}

export function BuildingEditDialog({
  buildingId,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  buildingId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (payload: BuildingDetailPayload) => void
  onDeleted: (id: number) => void
}) {
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [password, setPassword] = useState("")
  const [memo, setMemo] = useState("")
  const [createdAt, setCreatedAt] = useState("")

  const reset = useCallback(() => {
    setName("")
    setAddress("")
    setPassword("")
    setMemo("")
    setCreatedAt("")
    setLoadingDetail(false)
    setSaving(false)
    setDeleting(false)
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/buildings/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "불러오기 실패")
      setName(String(data.name ?? ""))
      setAddress(String(data.address ?? ""))
      setPassword(String(data.password ?? ""))
      setMemo(String(data.memo ?? ""))
      setCreatedAt(String(data.created_at ?? ""))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "건물 정보를 불러오지 못했습니다")
      onOpenChange(false)
    } finally {
      setLoadingDetail(false)
    }
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (buildingId == null) return
    setLoadingDetail(true)
    void loadDetail(buildingId)
  }, [open, buildingId, loadDetail, reset])

  const busy = saving || deleting

  const handleSave = async () => {
    if (buildingId == null) return
    setSaving(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, memo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "저장 실패")
      toast.success("저장되었습니다")
      onSaved({ id: buildingId, name })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (buildingId == null) return
    if (!window.confirm("이 건물을 삭제하시겠습니까?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "삭제 실패")
      toast.success("삭제되었습니다")
      onDeleted(buildingId)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-md sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">건물 상세</DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-name" className="text-gray-900 dark:text-gray-100">
                건물명
              </Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className="bg-white dark:bg-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-gray-100">주소</Label>
              <div className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                {address || "—"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-pw" className="text-gray-900 dark:text-gray-100">
                비밀번호
              </Label>
              <Input
                id="b-pw"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="bg-white dark:bg-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-memo" className="text-gray-900 dark:text-gray-100">
                메모
              </Label>
              <Textarea
                id="b-memo"
                rows={4}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                disabled={busy}
                className="resize-y bg-white dark:bg-gray-900"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-gray-500 dark:text-gray-400 text-xs">등록일</Label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {createdAt ? new Date(createdAt).toLocaleString("ko-KR") : "—"}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="destructive"
            disabled={busy || loadingDetail || buildingId == null}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2"
          >
            {deleting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            삭제
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={busy || loadingDetail || buildingId == null}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

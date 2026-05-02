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
  const [accessType, setAccessType] = useState<"free" | "password">("password")
  const [elevatorStatus, setElevatorStatus] = useState<"" | "yes" | "no">("")
  const [memoText, setMemoText] = useState("")

  const reset = useCallback(() => {
    setName("")
    setAddress("")
    setPassword("")
    setMemo("")
    setCreatedAt("")
    setAccessType("password")
    setElevatorStatus("")
    setMemoText("")
    setLoadingDetail(false)
    setSaving(false)
    setDeleting(false)
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/buildings/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "불러오기 실패")
      const pw = String(data.password ?? "")
      const rawMemo = String(data.memo ?? "")
      setName(String(data.name ?? ""))
      setAddress(String(data.address ?? ""))
      setPassword(pw)
      setMemo(rawMemo)
      setCreatedAt(String(data.created_at ?? ""))

      setAccessType(pw === "자유출입" || pw === "" ? "free" : "password")

      let elev: "" | "yes" | "no" = ""
      let remaining = rawMemo
      if (rawMemo.includes("엘리베이터 있음")) {
        elev = "yes"
        remaining = rawMemo.replace(/엘리베이터 있음\.?\s*/g, "")
      } else if (rawMemo.includes("엘리베이터 없음")) {
        elev = "no"
        remaining = rawMemo.replace(/엘리베이터 없음\.?\s*/g, "")
      }
      setElevatorStatus(elev)
      setMemoText(remaining.trim())
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
    const finalPassword = accessType === "free" ? "자유출입" : password
    const elevatorPrefix =
      elevatorStatus === "yes"
        ? "엘리베이터 있음. "
        : elevatorStatus === "no"
          ? "엘리베이터 없음. "
          : ""
    const finalMemo = (elevatorPrefix + memoText).trim()
    setSaving(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: finalPassword, memo: finalMemo }),
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
                className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-gray-100">주소</Label>
              <div className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                {address || "—"}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-gray-100">비밀번호</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessType("free")
                    setPassword("")
                  }}
                  disabled={busy}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                    accessType === "free"
                      ? "bg-blue-500/20 border-blue-400 text-blue-700 dark:text-white"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  자유출입
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType("password")}
                  disabled={busy}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                    accessType === "password"
                      ? "bg-blue-500/20 border-blue-400 text-blue-700 dark:text-white"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  직접입력
                </button>
              </div>
              {accessType === "password" && (
                <Input
                  id="b-pw"
                  type="text"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-gray-100">메모</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setElevatorStatus((prev) => (prev === "yes" ? "" : "yes"))
                  }
                  disabled={busy}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                    elevatorStatus === "yes"
                      ? "bg-green-500/20 border-green-400 text-green-700 dark:text-green-300"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  엘리베이터 있음
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setElevatorStatus((prev) => (prev === "no" ? "" : "no"))
                  }
                  disabled={busy}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                    elevatorStatus === "no"
                      ? "bg-green-500/20 border-green-400 text-green-700 dark:text-green-300"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  엘리베이터 없음
                </button>
              </div>
              <Textarea
                id="b-memo"
                rows={4}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                disabled={busy}
                placeholder="추가 메모 (예: 공동현관, 2층 계단 옆)"
                className="resize-y bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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

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
  const [, setMemo] = useState("")
  const [createdAt, setCreatedAt] = useState("")
  const [accessType, setAccessType] = useState<"free" | "password">("password")
  const [elevatorStatus, setElevatorStatus] = useState<"" | "yes" | "no" | "other">("")
  const [memoText, setMemoText] = useState("")
  const [jibunAddress, setJibunAddress] = useState<string | null>(null)
  const [jibunLoading, setJibunLoading] = useState(false)

  const reset = useCallback(() => {
    setName("")
    setAddress("")
    setPassword("")
    setMemo("")
    setCreatedAt("")
    setAccessType("password")
    setElevatorStatus("")
    setMemoText("")
    setJibunAddress(null)
    setJibunLoading(false)
    setLoadingDetail(false)
    setSaving(false)
    setDeleting(false)
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/buildings/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "건물 정보를 불러오지 못했습니다")
        onOpenChange(false)
        return
      }
      const data = await res.json()
      const pw = String(data.password ?? "")
      const rawMemo = String(data.memo ?? "")
      setName(String(data.name ?? ""))
      setAddress(String(data.address ?? ""))
      setPassword(pw)
      setMemo(rawMemo)
      setCreatedAt(String(data.created_at ?? ""))

      setAccessType(pw === "자유출입" || pw === "" ? "free" : "password")

      let elev: "" | "yes" | "no" | "other" = ""
      let remaining = rawMemo
      if (rawMemo.includes("엘리베이터 있음")) {
        elev = "yes"
        remaining = rawMemo.replace(/엘리베이터 있음\.?\s*/g, "")
      } else if (rawMemo.includes("엘리베이터 없음")) {
        elev = "no"
        remaining = rawMemo.replace(/엘리베이터 없음\.?\s*/g, "")
      } else if (rawMemo.startsWith("기타. ") || rawMemo === "기타") {
        elev = "other"
        remaining = rawMemo.replace(/^기타\.?\s*/g, "")
      }
      setElevatorStatus(elev)
      setMemoText(remaining.trim())
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
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

  useEffect(() => {
    if (!open || !address) {
      setJibunAddress(null)
      return
    }
    setJibunLoading(true)
    setJibunAddress(null)
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/address/jibun?address=${encodeURIComponent(address)}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { jibun?: string | null }
        if (!cancelled) setJibunAddress(data.jibun ?? null)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setJibunLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, address])

  const busy = saving || deleting

  const handleSave = async () => {
    if (buildingId == null) return
    const finalPassword = accessType === "free" ? "자유출입" : password
    const elevatorPrefix =
      elevatorStatus === "yes"
        ? "엘리베이터 있음. "
        : elevatorStatus === "no"
          ? "엘리베이터 없음. "
          : elevatorStatus === "other"
            ? "기타. "
            : ""
    const finalMemo = (elevatorPrefix + memoText).trim()
    setSaving(true)
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: finalPassword, memo: finalMemo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "저장에 실패했습니다")
        return
      }
      toast.success("저장되었습니다")
      onSaved({ id: buildingId, name })
      onOpenChange(false)
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "삭제에 실패했습니다")
        return
      }
      toast.success("삭제되었습니다")
      onDeleted(buildingId)
      onOpenChange(false)
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-md sm:max-w-md bg-white dark:bg-[#1e293b]"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[#111827] dark:text-white">건물 상세</DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-name" className="font-medium text-[#374151] dark:text-gray-200">
                건물명
              </Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className="border-[#d1d5db] bg-white text-[#111827] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-[#374151] dark:text-gray-200">주소</Label>
              <div className="rounded-md border border-[#d1d5db] bg-[#f9fafb] px-3 py-2 text-sm text-[#374151] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <p>{address || "—"}</p>
                {jibunLoading && (
                  <p className="text-[11px] text-gray-400 mt-0.5">번지 조회 중...</p>
                )}
                {!jibunLoading && jibunAddress && (
                  <p className="text-[11px] text-gray-400 mt-0.5">({jibunAddress})</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-[#374151] dark:text-gray-200">비밀번호</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessType("free")
                    setPassword("")
                  }}
                  disabled={busy}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    accessType === "free"
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  자유출입
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType("password")}
                  disabled={busy}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    accessType === "password"
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
                  className="border-[#d1d5db] bg-white text-[#111827] focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-[#374151] dark:text-gray-200">메모</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setElevatorStatus((prev) => (prev === "yes" ? "" : "yes"))}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                    elevatorStatus === "yes"
                      ? "border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xl">🛗</span>
                  엘리베이터
                </button>
                <button
                  type="button"
                  onClick={() => setElevatorStatus((prev) => (prev === "no" ? "" : "no"))}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                    elevatorStatus === "no"
                      ? "border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xl">🪜</span>
                  계단만
                </button>
                <button
                  type="button"
                  onClick={() => setElevatorStatus((prev) => (prev === "other" ? "" : "other"))}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                    elevatorStatus === "other"
                      ? "border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "border-[#d1d5db] bg-white text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xl">📝</span>
                  기타
                </button>
              </div>
              <Textarea
                id="b-memo"
                rows={4}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                disabled={busy}
                placeholder="추가 메모 (예: 공동현관, 2층 계단 옆)"
                className="resize-y border-[#d1d5db] bg-white text-[#111827] placeholder:text-[#9ca3af] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-[#6b7280]">등록일</Label>
              <p className="text-sm text-[#6b7280] dark:text-gray-400">
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
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700"
          >
            {deleting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            삭제
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={busy || loadingDetail || buildingId == null}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Search, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { AccessType } from "@/types/building"

type AccessChoice = Exclude<AccessType, "etc">
type ElevatorStatus = "" | "yes" | "no"

const ELEVATOR_LABEL: Record<Exclude<ElevatorStatus, "">, string> = {
  yes: "엘리베이터 있음",
  no: "엘리베이터 없음",
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void
        theme?: Record<string, string>
      }) => { open: () => void }
    }
  }
}

interface NewBuildingModalProps {
  open: boolean
  onClose: () => void
  branchId?: string | null
  userEmail: string
  onSuccess: () => void
  onGoToBuilding?: (buildingId: string, address: string) => void
}

interface DuplicateBuilding {
  id: string
  name: string
  address: string
  created_at: string
}

type DuplicateCheckResult =
  | null
  | { exists: false }
  | { exists: true; building: DuplicateBuilding }

const REGIONS = ["울산", "부산", "대구", "서울", "경기", "기타"]

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-600 rounded-lg text-sm " +
  "bg-gray-800 text-white " +
  "placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500"

const LABEL_CLS = "block text-sm font-medium mb-1.5 text-gray-200"

export function NewBuildingModal({
  open,
  onClose,
  branchId,
  userEmail,
  onSuccess,
  onGoToBuilding,
}: NewBuildingModalProps) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    password: "",
    memo: "",
    region: "",
    accessType: "password" as AccessChoice,
  })
  const [elevatorStatus, setElevatorStatus] = useState<ElevatorStatus>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult>(null)
  const [isChecking, setIsChecking] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const SCRIPT_ID = "kakao-postcode-script"
    if (document.getElementById(SCRIPT_ID)) return
    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
    script.async = true
    document.head.appendChild(script)
  }, [])

  const checkDuplicate = async (address: string, name?: string) => {
    setIsChecking(true)
    setDuplicateCheck(null)
    try {
      const params = new URLSearchParams({ address })
      if (name && name.trim()) params.set("name", name.trim())
      const res = await fetch(`/api/buildings/check-duplicate?${params.toString()}`)
      const data = (await res.json()) as DuplicateCheckResult & { error?: string }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "확인 실패")
      setDuplicateCheck(data as DuplicateCheckResult)
    } catch {
      setDuplicateCheck(null)
    } finally {
      setIsChecking(false)
    }
  }

  const openAddressSearch = () => {
    if (!window.daum?.Postcode) {
      toast.error("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해주세요.")
      return
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const address = data.roadAddress || data.jibunAddress
        setForm((prev) => ({ ...prev, address }))
        void checkDuplicate(address)
      },
    }).open()
  }

  const resetAndClose = () => {
    setForm({ name: "", address: "", password: "", memo: "", region: "", accessType: "password" })
    setElevatorStatus("")
    setDuplicateCheck(null)
    onClose()
  }

  const handleAccessTypeChange = (value: AccessChoice) => {
    setForm((prev) => {
      const next = { ...prev, accessType: value }
      if (value === "free") next.password = ""
      return next
    })
  }

  const toggleElevator = (value: Exclude<ElevatorStatus, "">) => {
    setElevatorStatus((prev) => (prev === value ? "" : value))
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
    if (form.accessType === "password" && form.password.length < 4) {
      toast.error("비밀번호는 4자리 이상 입력해주세요.")
      return
    }

    const payloadPassword =
      form.accessType === "free" ? "자유출입" : form.password

    const elevatorPrefix =
      elevatorStatus === "" ? "" : `${ELEVATOR_LABEL[elevatorStatus]}. `
    const combinedMemo = (elevatorPrefix + form.memo).trim()

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          password: payloadPassword,
          memo: combinedMemo || null,
          region: form.region || null,
          branch_id: branchId ?? null,
          uploaded_by: userEmail,
          access_type: form.accessType,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as { error?: string; existingId?: number }
      if (res.status === 409) {
        toast.error(
          data.error
            ? `${data.error}. 기존 건물을 수정하시겠어요?`
            : "이미 등록된 건물입니다. 기존 건물을 수정하시겠어요?"
        )
        return
      }
      if (!res.ok) throw new Error(data.error ?? "등록 실패")

      toast.success("새 건물이 등록되었습니다! 감사합니다 🎉")
      resetAndClose()
      onSuccess()
    } catch {
      toast.error("건물 등록에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDuplicate = duplicateCheck?.exists === true
  const isNew = duplicateCheck?.exists === false
  const reward = form.accessType === "free" ? "+50P" : "+100P"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose() }}>
      <DialogContent className="max-w-md w-full bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">새 건물 비밀번호 등록</DialogTitle>
        </DialogHeader>

        {/* 주소 선택 영역 */}
        <div>
          <label className={LABEL_CLS}>
            주소 <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.address}
              onChange={(e) => {
                setForm({ ...form, address: e.target.value })
                setDuplicateCheck(null)
              }}
              placeholder="예) 울산시 남구 삼산로 123"
              className={`${INPUT_CLS} flex-1`}
            />
            <button
              type="button"
              onClick={openAddressSearch}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 transition-colors shrink-0"
            >
              <Search className="h-3.5 w-3.5" />
              주소검색
            </button>
          </div>

          {isChecking && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              중복 건물 확인 중...
            </div>
          )}

          {!isChecking && isDuplicate && duplicateCheck && duplicateCheck.exists && (
            <div className="mt-2 rounded-lg border border-yellow-600 bg-yellow-900/30 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-yellow-300">
                    같은 주소+건물명이 이미 등록되어 있어요
                  </p>
                  <p className="text-sm text-yellow-400 mt-0.5 font-medium">
                    {duplicateCheck.building.name}
                  </p>
                  <p className="text-xs text-yellow-500 mt-0.5 truncate">
                    {duplicateCheck.building.address}
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    등록일: {new Date(duplicateCheck.building.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isChecking && isNew && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-600 bg-green-900/30 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-300 font-medium">
                새로운 건물이에요! 등록해주세요 <span className="font-semibold">{reward}</span>
              </p>
            </div>
          )}
        </div>

        {isDuplicate && duplicateCheck && duplicateCheck.exists && (
          <div className="flex gap-3">
            <Button
              type="button"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={() => {
                const { id, address } = duplicateCheck.building
                resetAndClose()
                onGoToBuilding?.(id, address)
              }}
            >
              🔑 비밀번호 수정하기
            </Button>
            <Button
              type="button"
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold"
              onClick={() => {
                setForm((prev) => ({ ...prev, name: "" }))
                setDuplicateCheck(null)
                setTimeout(() => nameInputRef.current?.focus(), 50)
              }}
            >
              🏢 다른 동 추가하기
            </Button>
          </div>
        )}

        {!isDuplicate && (
          <>
            <p className="text-sm text-green-300 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2">
              🎁 새 건물을 등록하면 포인트가 적립됩니다!
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className={LABEL_CLS}>
                  건물명 <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const newName = e.target.value
                    setForm({ ...form, name: newName })
                    if (form.address && newName.length >= 2) {
                      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current)
                      nameCheckTimerRef.current = setTimeout(() => {
                        void checkDuplicate(form.address, newName)
                      }, 500)
                    }
                  }}
                  placeholder="예) 롯데캐슬 101동"
                  className={INPUT_CLS}
                  required
                />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  비밀번호 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccessTypeChange("free")}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      form.accessType === "free"
                        ? "bg-blue-500/20 border-blue-400 text-white"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    자유출입
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAccessTypeChange("password")}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      form.accessType === "password"
                        ? "bg-blue-500/20 border-blue-400 text-white"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    직접입력
                  </button>
                </div>
                {form.accessType === "password" && (
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="4자리 이상"
                    className={`${INPUT_CLS} mt-2`}
                    required
                  />
                )}
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
                <label className={LABEL_CLS}>메모</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleElevator("yes")}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border font-medium transition ${
                      elevatorStatus === "yes"
                        ? "border-blue-500/50 bg-blue-600/25 text-blue-300"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 9 L12 5 L16 9" />
                        <path d="M8 15 L12 19 L16 15" />
                      </svg>
                    </span>
                    <span className="text-sm">엘리베이터</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleElevator("no")}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border font-medium transition ${
                      elevatorStatus === "no"
                        ? "border-amber-500/50 bg-amber-500/25 text-amber-300"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 20 L4 16 L9 16 L9 12 L14 12 L14 8 L19 8 L19 4 L22 4" />
                      </svg>
                    </span>
                    <span className="text-sm">계단만</span>
                  </button>
                </div>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="추가 메모 (예: 공동현관, 2층 계단 옆)"
                  rows={2}
                  className={`${INPUT_CLS} resize-none mt-2`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `등록하기 ${reward}`}
                </Button>
                <Button type="button" onClick={resetAndClose} variant="outline" className="flex-1 border-gray-600 text-gray-200 hover:bg-gray-700">
                  취소
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

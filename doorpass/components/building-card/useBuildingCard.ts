"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { useIsAdmin } from "@/hooks/useIsAdmin"

export interface BuildingPhoto {
  id: number
  building_id: number
  uploader_email: string
  photo_url: string
  photo_type: string
  caption: string | null
  created_at: string
}

export interface Building {
  id: string
  name: string
  address: string
  password: string
  memo?: string
  distance?: number
  lat: number
  lng: number
  access_type?: "free" | "password" | "etc"
}

export interface UseBuildingCardProps {
  building: Building
  canRevealBuildingPassword?: boolean
  onUpdate?: (buildingId: string, updated: Partial<Building>) => void
  onPointsUpdate?: () => void
  autoOpen?: boolean
}

const ACTION_LABEL: Record<string, string> = {
  building_name: "건물명 입력",
  building_password: "비밀번호 입력",
  building_free_access: "자유출입 입력",
  building_elevator: "엘리베이터 정보 입력",
  building_memo: "메모 입력",
}

export function useBuildingCard({
  building,
  canRevealBuildingPassword = false,
  onUpdate,
  onPointsUpdate,
  autoOpen = false,
}: UseBuildingCardProps) {
  const { canEdit, role } = useIsAdmin()
  const [showPopup, setShowPopup] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentBuilding, setCurrentBuilding] = useState(building)

  const [accessType, setAccessType] = useState<"free" | "password">(
    currentBuilding.access_type === "free" ? "free" : "password"
  )
  const [passwordDraft, setPasswordDraft] = useState(currentBuilding.password || "")
  const [isEditingPassword, setIsEditingPassword] = useState(false)
  const [elevatorStatus, setElevatorStatus] = useState<"" | "yes" | "no">("")
  const [isEditingElevator, setIsEditingElevator] = useState(false)

  const [showPasswordReport, setShowPasswordReport] = useState(false)
  const [pwReportMode, setPwReportMode] = useState<"changed" | "wrong" | null>(null)
  const [pwReportNewPassword, setPwReportNewPassword] = useState("")
  const [pwReportMemo, setPwReportMemo] = useState("")
  const [pwReportSubmitting, setPwReportSubmitting] = useState(false)

  const [memoText, setMemoText] = useState("")
  const [memoDraft, setMemoDraft] = useState("")
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [pointPopup, setPointPopup] = useState<{ points: number; action: string; total: number } | null>(null)
  const [photos, setPhotos] = useState<BuildingPhoto[]>([])
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxPhotoId, setLightboxPhotoId] = useState<number | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [jibunAddress, setJibunAddress] = useState<string | null>(null)
  const [jibunLoading, setJibunLoading] = useState(false)
  const jibunCacheRef = useRef<Map<string, string | null>>(new Map())

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/buildings/${currentBuilding.id}/photos`)
      if (!res.ok) return
      const data = (await res.json()) as { photos: BuildingPhoto[] }
      setPhotos(data.photos ?? [])
    } catch {
      // ignore
    }
  }, [currentBuilding.id])

  const submitPasswordReport = async () => {
    let content = ""
    if (pwReportMode === "changed") {
      const np = pwReportNewPassword.trim()
      if (!np) { toast.error("새 비밀번호를 입력해주세요."); return }
      content = `[비밀번호 변경됨] 새 비밀번호: ${np}`
    } else if (pwReportMode === "wrong") {
      const memo = pwReportMemo.trim()
      if (!memo) { toast.error("간단한 설명을 입력해주세요."); return }
      content = `[비밀번호 안 맞음] ${memo}`
    } else {
      return
    }

    setPwReportSubmitting(true)
    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "password_error",
          content,
          building_id: currentBuilding.id,
          building_name: currentBuilding.name || currentBuilding.address,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || "신고 전송에 실패했습니다.")
        return
      }
      toast.success("신고가 접수됐어요. 빠르게 확인할게요.")
      setShowPasswordReport(false)
      setPwReportMode(null)
      setPwReportNewPassword("")
      setPwReportMemo("")
    } catch {
      toast.error("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setPwReportSubmitting(false)
    }
  }

  useEffect(() => {
    setCurrentBuilding(building)
  }, [building])

  useEffect(() => {
    if (showPopup) void fetchPhotos()
  }, [showPopup, fetchPhotos])

  useEffect(() => {
    if (!showPopup) return
    const buildingId = currentBuilding.id
    const address = currentBuilding.address?.trim()
    if (!address) return
    if (jibunCacheRef.current.has(buildingId)) {
      setJibunAddress(jibunCacheRef.current.get(buildingId) ?? null)
      setJibunLoading(false)
      return
    }
    setJibunLoading(true)
    setJibunAddress(null)
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/address/jibun?address=${encodeURIComponent(address)}`)
        if (!res.ok || cancelled) return
        const data = await res.json() as { jibun?: string | null }
        const result = data.jibun ?? null
        if (!cancelled) {
          jibunCacheRef.current.set(buildingId, result)
          setJibunAddress(result)
        }
      } catch {
        if (!cancelled) jibunCacheRef.current.set(buildingId, null)
      } finally {
        if (!cancelled) setJibunLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showPopup, currentBuilding.id, currentBuilding.address])

  useEffect(() => {
    if (autoOpen) setShowPopup(true)
  }, [autoOpen])

  useEffect(() => {
    setAccessType(currentBuilding.access_type === "free" ? "free" : "password")
  }, [currentBuilding])

  useEffect(() => {
    setPasswordDraft(currentBuilding.password || "")
  }, [currentBuilding.password])

  useEffect(() => {
    const raw = currentBuilding.memo || ""
    let elev: "" | "yes" | "no" = ""
    let remaining = raw
    if (raw.includes("엘리베이터 있음")) {
      elev = "yes"
      remaining = raw.replace(/엘리베이터 있음\.?\s*/g, "")
    } else if (raw.includes("엘리베이터 없음")) {
      elev = "no"
      remaining = raw.replace(/엘리베이터 없음\.?\s*/g, "")
    }
    setElevatorStatus(elev)
    setMemoText(remaining.trim())
    setMemoDraft(remaining.trim())
    setIsEditingElevator(false)
  }, [currentBuilding.memo])

  const composeMemo = (status: "" | "yes" | "no", text: string) => {
    const prefix =
      status === "yes" ? "엘리베이터 있음. " : status === "no" ? "엘리베이터 없음. " : ""
    return (prefix + text).trim()
  }

  const isManager = role === "admin" || role === "sub_admin"
  const isPasswordLocked = !isManager && !!(
    currentBuilding.password &&
    currentBuilding.password.trim() !== "" &&
    currentBuilding.password !== "미입력"
  )
  const isElevatorLocked = !isManager && elevatorStatus !== ""
  const isMemoLocked = !isManager && memoText.trim() !== ""

  const saveField = async (field: "name" | "password" | "memo", value: string) => {
    if (field === "password" && !canRevealBuildingPassword) return
    setSaving(true)
    try {
      const res = await fetch("/api/buildings/save-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId: currentBuilding.id, field, value }),
      })
      const data = await res.json() as {
        success?: boolean
        error?: string
        points?: number
        newTotal?: number | null
        action?: string | null
      }
      if (!res.ok) throw new Error(data.error ?? "저장 실패")

      setCurrentBuilding({ ...currentBuilding, [field]: value })
      onUpdate?.(currentBuilding.id, { [field]: value })
      toast.success("저장되었습니다.")

      if (data.points && data.points > 0 && data.newTotal != null) {
        setPointPopup({
          points: data.points,
          action: ACTION_LABEL[data.action ?? ""] ?? "정보 입력",
          total: data.newTotal,
        })
        onPointsUpdate?.()
      }
    } catch {
      toast.error("저장 실패")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("이 건물을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/buildings/${currentBuilding.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "삭제 실패")
      toast.success("건물이 삭제되었습니다.")
      setShowPopup(false)
      onUpdate?.(currentBuilding.id, { _deleted: true } as Partial<Building>)
    } catch {
      toast.error("삭제에 실패했습니다.")
    } finally {
      setIsDeleting(false)
    }
  }

  const openNavigation = (e: React.MouseEvent) => {
    e.stopPropagation()
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const name = encodeURIComponent(currentBuilding.name)
    const lat = currentBuilding.lat
    const lng = currentBuilding.lng

    if (isMobile) {
      // 모바일: 카카오맵 앱 딥링크 시도 → 1.5초 후 앱 없으면 웹으로 폴백
      window.location.href = `kakaomap://route?ep=${lat},${lng}&by=CAR`
      setTimeout(() => {
        window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, "_blank")
      }, 1500)
    } else {
      window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, "_blank")
    }
  }

  const mapUrl = `https://maps.google.com/maps?q=${currentBuilding.lat},${currentBuilding.lng}&z=17&output=embed`

  return {
    canEdit,
    role,
    showPopup, setShowPopup,
    showApprovalModal, setShowApprovalModal,
    saving,
    isDeleting,
    currentBuilding,
    accessType, setAccessType,
    passwordDraft, setPasswordDraft,
    isEditingPassword, setIsEditingPassword,
    elevatorStatus, setElevatorStatus,
    isEditingElevator, setIsEditingElevator,
    showPasswordReport, setShowPasswordReport,
    pwReportMode, setPwReportMode,
    pwReportNewPassword, setPwReportNewPassword,
    pwReportMemo, setPwReportMemo,
    pwReportSubmitting,
    memoText, setMemoText,
    memoDraft, setMemoDraft,
    isEditingMemo, setIsEditingMemo,
    pointPopup, setPointPopup,
    photos,
    showPhotoModal, setShowPhotoModal,
    lightboxUrl, setLightboxUrl,
    lightboxPhotoId, setLightboxPhotoId,
    showMap, setShowMap,
    jibunAddress,
    jibunLoading,
    isManager,
    isPasswordLocked,
    isElevatorLocked,
    isMemoLocked,
    mapUrl,
    fetchPhotos,
    submitPasswordReport,
    composeMemo,
    saveField,
    handleDelete,
    openNavigation,
  }
}

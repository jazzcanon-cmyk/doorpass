"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Navigation, Pencil, X, Check, MapPin, Lock, Trash2, Loader2, Camera, Flag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import { ApprovalRequestModal } from "@/components/ApprovalRequestModal"
import { PointPopup } from "@/components/PointPopup"
import { BuildingPhotoModal } from "@/components/BuildingPhotoModal"
import { shortenAddress } from "@/lib/utils"

interface BuildingPhoto {
  id: number
  building_id: number
  uploader_email: string
  photo_url: string
  photo_type: string
  caption: string | null
  created_at: string
}

interface Building {
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

interface BuildingCardProps {
  building: Building
  showDistance?: boolean
  /** 승인·역할이 갖춰진 사용자만 실제 비밀번호 노출 (서버와 동일 기준) */
  canRevealBuildingPassword?: boolean
  onUpdate?: (buildingId: string, updated: Partial<Building>) => void
  /** true이면 마운트 즉시 팝업 오픈 (중복 건물에서 이동 시 사용) */
  autoOpen?: boolean
}

// 수정 가능한 필드 행 컴포넌트
function EditableRow({
  label,
  value,
  onSave,
  saving,
  canEdit,
}: {
  label: string
  value: string
  onSave: (val: string) => Promise<void>
  saving: boolean
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return }
    await onSave(draft)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 text-sm bg-secondary border-primary/50 flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
          />
          <Button variant="default" size="icon" onClick={handleSave} disabled={saving}
            className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => { setEditing(false); setDraft(value) }}
            className="h-9 w-9 flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className={`text-sm flex-1 ${label === "비밀번호" ? "font-mono font-bold text-yellow-400" : "text-foreground"}`}>
            {value || <span className="text-muted-foreground italic">미입력</span>}
          </span>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => { setEditing(true); setDraft(value) }}
              className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function BuildingCard({
  building,
  showDistance = true,
  canRevealBuildingPassword = false,
  onUpdate,
  autoOpen = false,
}: BuildingCardProps) {
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
  const [memoText, setMemoText] = useState("")
  const [memoDraft, setMemoDraft] = useState("")
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [pointPopup, setPointPopup] = useState<{ points: number; action: string; total: number } | null>(null)
  const [photos, setPhotos] = useState<BuildingPhoto[]>([])
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxPhotoId, setLightboxPhotoId] = useState<number | null>(null)

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

  useEffect(() => {
    setCurrentBuilding(building)
  }, [building])

  useEffect(() => {
    if (showPopup) void fetchPhotos()
  }, [showPopup, fetchPhotos])

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
  }, [currentBuilding.memo])

  const composeMemo = (status: "" | "yes" | "no", text: string) => {
    const prefix =
      status === "yes" ? "엘리베이터 있음. " : status === "no" ? "엘리베이터 없음. " : ""
    return (prefix + text).trim()
  }

  const isPasswordLocked = !!(
    currentBuilding.password &&
    currentBuilding.password.trim() !== "" &&
    currentBuilding.password !== "미입력"
  )
  const isElevatorLocked = elevatorStatus !== ""
  const isMemoLocked = memoText.trim() !== ""

  const ACTION_LABEL: Record<string, string> = {
    building_name: "건물명 입력",
    building_password: "비밀번호 입력",
    building_free_access: "자유출입 입력",
    building_elevator: "엘리베이터 정보 입력",
    building_memo: "메모 입력",
  }

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
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패")
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.")
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
      // PC: 카카오맵 웹으로 바로 열기
      window.open(`https://map.kakao.com/link/to/${name},${lat},${lng}`, "_blank")
    }
  }

  const mapUrl = `https://maps.google.com/maps?q=${currentBuilding.lat},${currentBuilding.lng}&z=17&output=embed`

  return (
    <>
      {pointPopup && (
        <PointPopup
          points={pointPopup.points}
          action={pointPopup.action}
          totalPoints={pointPopup.total}
          onClose={() => setPointPopup(null)}
        />
      )}

      {/* 카드 */}
      <Card
        className="overflow-hidden border-border bg-card transition-all hover:border-primary/50 cursor-pointer active:scale-[0.98]"
        onClick={() => setShowPopup(true)}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {showDistance && currentBuilding.distance !== undefined && (
              <div className="flex w-20 flex-shrink-0 flex-col items-center justify-center bg-secondary px-3 py-4">
                <span className="text-2xl font-bold text-primary">{currentBuilding.distance}</span>
                <span className="text-xs text-muted-foreground">미터</span>
              </div>
            )}
            <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">
                  <span className="font-semibold">{currentBuilding.name}</span>
                  <span className="text-muted-foreground"> - </span>
                  <span className="text-muted-foreground">{shortenAddress(currentBuilding.address)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {currentBuilding.access_type === "free" ? (
                    <span className="text-sm font-semibold text-emerald-400 whitespace-nowrap">
                      🚪 자유출입
                    </span>
                  ) : currentBuilding.access_type === "etc" ? (
                    <span className="text-sm font-semibold text-sky-400 whitespace-nowrap">
                      📋 메모 참조
                    </span>
                  ) : (
                    <span className="font-mono text-base font-bold text-yellow-400 whitespace-nowrap">
                      {currentBuilding.password}
                    </span>
                  )}
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                {!canRevealBuildingPassword && currentBuilding.access_type !== "free" && (
                  <p className="text-[10px] text-muted-foreground text-right max-w-[200px] leading-snug">
                    승인 후 열람 가능 —{" "}
                    <button
                      type="button"
                      className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowApprovalModal(true)
                      }}
                    >
                      승인 요청하기
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 팝업 */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="w-full max-w-lg bg-card rounded-2xl overflow-hidden shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground">건물 정보</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPopup(false)}
                className="h-8 w-8 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 정보 섹션 */}
            <div className="px-4 pt-3 pb-1">
              {/* 주소 (수정 불가) */}
              <div className="flex items-center gap-2 py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0">주소</span>
                <span className="text-sm text-foreground flex-1">{shortenAddress(currentBuilding.address)}</span>
              </div>

              {/* 수정 가능 필드들 */}
              <EditableRow
                label="건물명"
                value={currentBuilding.name || ""}
                onSave={(v) => saveField("name", v)}
                saving={saving}
                canEdit={canEdit}
              />
              {currentBuilding.access_type === "free" ? (
                <div className="flex items-center gap-2 py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">출입</span>
                  <span className="text-sm font-semibold text-emerald-400 flex-1">
                    🚪 자유출입 (비밀번호 없음)
                  </span>
                </div>
              ) : currentBuilding.access_type === "etc" ? (
                <div className="flex items-center gap-2 py-2 border-b border-border/40">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">출입</span>
                  <span className="text-sm font-semibold text-sky-400 flex-1">
                    📋 메모 참조
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2 py-2 border-b border-border/40">
                    <span className="text-xs text-muted-foreground w-16 flex-shrink-0 pt-1">비밀번호</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canEdit || !canRevealBuildingPassword || saving || isPasswordLocked}
                          onClick={() => {
                            setAccessType("free")
                            setIsEditingPassword(false)
                            void saveField("password", "자유출입")
                          }}
                          className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                            accessType === "free"
                              ? "bg-blue-500/20 border-blue-400 text-blue-300"
                              : "bg-secondary border-border text-muted-foreground"
                          } ${(!canEdit || !canRevealBuildingPassword || isPasswordLocked) ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary/80"}`}
                        >
                          자유출입
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit || !canRevealBuildingPassword || saving || isPasswordLocked}
                          onClick={() => {
                            setAccessType("password")
                            setIsEditingPassword(true)
                          }}
                          className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                            accessType === "password"
                              ? "bg-blue-500/20 border-blue-400 text-blue-300"
                              : "bg-secondary border-border text-muted-foreground"
                          } ${(!canEdit || !canRevealBuildingPassword || isPasswordLocked) ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary/80"}`}
                        >
                          직접입력
                        </button>
                      </div>

                      {accessType === "password" && (
                        <div className="mt-2">
                          {isEditingPassword ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={passwordDraft}
                                onChange={(e) => setPasswordDraft(e.target.value)}
                                className="h-9 text-sm bg-secondary border-primary/50 flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    void saveField("password", passwordDraft).then(() =>
                                      setIsEditingPassword(false)
                                    )
                                  }
                                  if (e.key === "Escape") {
                                    setPasswordDraft(currentBuilding.password || "")
                                    setIsEditingPassword(false)
                                  }
                                }}
                              />
                              <Button
                                variant="default"
                                size="icon"
                                disabled={saving}
                                onClick={async () => {
                                  await saveField("password", passwordDraft)
                                  setIsEditingPassword(false)
                                }}
                                className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => {
                                  setPasswordDraft(currentBuilding.password || "")
                                  setIsEditingPassword(false)
                                }}
                                className="h-9 w-9 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-mono font-bold text-yellow-400">
                                {currentBuilding.password || (
                                  <span className="text-muted-foreground italic font-sans font-normal">미입력</span>
                                )}
                              </span>
                              {canEdit && canRevealBuildingPassword && !isPasswordLocked && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setIsEditingPassword(true)}
                                  className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {canEdit && isPasswordLocked && (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {!canRevealBuildingPassword && (
                    <p className="text-[11px] text-muted-foreground mt-1 pl-[4.5rem]">
                      승인 후 열람 가능 —{" "}
                      <button
                        type="button"
                        className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                        onClick={() => setShowApprovalModal(true)}
                      >
                        승인 요청하기
                      </button>
                    </p>
                  )}
                </>
              )}
              <div className="flex items-start gap-2 py-2 border-b border-border/40 last:border-0">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0 pt-2">메모</span>
                <div className="flex-1 min-w-0">
                  {(!canEdit || isElevatorLocked) ? (
                    // 표시 전용: 활성 상태일 때만 해당 뱃지 노출
                    (elevatorStatus === "yes" || elevatorStatus === "no") ? (
                      <div className="flex flex-wrap gap-2">
                        {elevatorStatus === "yes" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-blue-300 border border-blue-500/30 bg-blue-600/20">
                            <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-blue-600 flex-shrink-0">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 9 L12 5 L16 9" />
                                <path d="M8 15 L12 19 L16 15" />
                              </svg>
                            </span>
                            엘리베이터
                          </span>
                        )}
                        {elevatorStatus === "no" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-amber-300 border border-amber-500/30 bg-amber-500/20">
                            <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-amber-500 flex-shrink-0">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 20 L4 16 L9 16 L9 12 L14 12 L14 8 L19 8 L19 4 L22 4" />
                              </svg>
                            </span>
                            계단만
                          </span>
                        )}
                      </div>
                    ) : null
                  ) : (
                    // 편집 가능 + 미설정 상태: 두 뱃지를 선택 버튼으로 노출
                    // (isElevatorLocked === false 이므로 elevatorStatus === "")
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setElevatorStatus("yes")
                          void saveField("memo", composeMemo("yes", memoText))
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-blue-500/30 bg-blue-600/20 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-all"
                      >
                        <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-blue-600 flex-shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 9 L12 5 L16 9" />
                            <path d="M8 15 L12 19 L16 15" />
                          </svg>
                        </span>
                        엘리베이터
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setElevatorStatus("no")
                          void saveField("memo", composeMemo("no", memoText))
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-amber-500/30 bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-all"
                      >
                        <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-amber-500 flex-shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20 L4 16 L9 16 L9 12 L14 12 L14 8 L19 8 L19 4 L22 4" />
                          </svg>
                        </span>
                        계단만
                      </button>
                    </div>
                  )}

                  <div className="mt-2">
                    {isEditingMemo ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={memoDraft}
                          onChange={(e) => setMemoDraft(e.target.value)}
                          placeholder="추가 메모 (예: 공동현관, 2층 계단 옆)"
                          className="h-9 text-sm bg-secondary border-primary/50 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void saveField("memo", composeMemo(elevatorStatus, memoDraft)).then(() => {
                                setMemoText(memoDraft)
                                setIsEditingMemo(false)
                              })
                            }
                            if (e.key === "Escape") {
                              setMemoDraft(memoText)
                              setIsEditingMemo(false)
                            }
                          }}
                        />
                        <Button
                          variant="default"
                          size="icon"
                          disabled={saving}
                          onClick={async () => {
                            await saveField("memo", composeMemo(elevatorStatus, memoDraft))
                            setMemoText(memoDraft)
                            setIsEditingMemo(false)
                          }}
                          className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            setMemoDraft(memoText)
                            setIsEditingMemo(false)
                          }}
                          className="h-9 w-9 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground flex-1">
                          {memoText || (
                            <span className="text-muted-foreground italic">미입력</span>
                          )}
                        </span>
                        {canEdit && !isMemoLocked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setMemoDraft(memoText)
                              setIsEditingMemo(true)
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canEdit && isMemoLocked && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {!canEdit && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 flex items-center gap-2 text-xs text-white/50">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="flex-1">건물 정보 수정은 편집자만 가능합니다.</span>
                  <Link href="/settings" className="text-blue-400 hover:underline whitespace-nowrap">권한 요청</Link>
                </div>
              )}
              {canEdit && (isPasswordLocked || isElevatorLocked || isMemoLocked) && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 flex items-center gap-2 text-xs text-white/50">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>입력된 정보는 부관리자에게 문의하여 수정 가능합니다</span>
                </div>
              )}
            </div>

            {/* 건물 사진 */}
            <div className="px-4 pt-2 pb-1 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">현장 사진</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPhotoModal(true)}
                  className="h-7 gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Camera className="h-3.5 w-3.5" />
                  사진 추가
                </Button>
              </div>
              {photos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pb-1">아직 사진이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setLightboxUrl(p.photo_url)
                        setLightboxPhotoId(p.id)
                      }}
                      className="aspect-square rounded-lg overflow-hidden bg-secondary border border-border hover:border-primary/60 transition-colors"
                    >
                      <img src={p.photo_url} alt="건물 사진" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 길찾기 버튼 */}
            <div className="px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openNavigation}
                className="w-full gap-2 text-primary border-primary/50 hover:bg-primary/10"
              >
                <Navigation className="h-4 w-4" />
                길찾기
              </Button>
            </div>

            {/* 지도 */}
            <div className="w-full h-48 bg-secondary">
              <iframe
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={currentBuilding.name}
              />
            </div>

            {/* 관리자 삭제 버튼 */}
            {(role === "admin" || role === "sub_admin") && (
              <div className="px-4 pt-3 pb-1 border-t border-border">
                <Button
                  variant="destructive"
                  className="w-full gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeleting ? "삭제 중..." : "이 건물 삭제"}
                </Button>
              </div>
            )}

            {/* 하단 닫기 버튼 */}
            <div className="px-4 py-3 border-t border-border">
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => setShowPopup(false)}
              >
                <X className="h-4 w-4" />
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      <ApprovalRequestModal open={showApprovalModal} onOpenChange={setShowApprovalModal} />

      <BuildingPhotoModal
        buildingId={currentBuilding.id}
        open={showPhotoModal}
        onOpenChange={setShowPhotoModal}
        onUploaded={(result) => {
          void fetchPhotos()
          if (result.point?.success && result.point.points && result.point.newTotal != null) {
            setPointPopup({
              points: result.point.points,
              action: "사진 업로드",
              total: result.point.newTotal,
            })
          }
        }}
      />

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => {
            setLightboxUrl(null)
            setLightboxPhotoId(null)
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxUrl(null)
              setLightboxPhotoId(null)
            }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="건물 사진"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxPhotoId != null && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                if (!window.confirm("이 사진을 신고하시겠습니까?")) return
                try {
                  const res = await fetch(
                    `/api/buildings/${currentBuilding.id}/photos/${lightboxPhotoId}/report`,
                    { method: "POST" }
                  )
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(data.error || "신고 실패")
                  toast.success(
                    data.hidden
                      ? "신고가 접수되어 사진이 숨김 처리되었습니다."
                      : "신고가 접수되었습니다."
                  )
                  setLightboxUrl(null)
                  setLightboxPhotoId(null)
                  void fetchPhotos()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "신고 실패")
                }
              }}
              className="absolute bottom-4 right-4 bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-red-500/30"
            >
              <Flag className="h-3.5 w-3.5" />
              신고
            </button>
          )}
        </div>
      )}
    </>
  )
}

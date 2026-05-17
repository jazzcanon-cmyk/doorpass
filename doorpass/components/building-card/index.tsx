"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Navigation, Pencil, X, Check, MapPin, Lock, Trash2, Loader2, Camera, Flag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PointPopup } from "@/components/PointPopup"
import { shortenAddress } from "@/lib/utils"
import { EditableRow } from "./EditableRow"
import { useBuildingCard, type Building } from "./useBuildingCard"

// 클릭 시에만 열리는 모달 → lazy load (초기 번들 제외)
const ApprovalRequestModal = dynamic(
  () => import("@/components/ApprovalRequestModal").then((m) => ({ default: m.ApprovalRequestModal })),
  { ssr: false }
)
const BuildingPhotoModal = dynamic(
  () => import("@/components/BuildingPhotoModal").then((m) => ({ default: m.BuildingPhotoModal })),
  { ssr: false }
)

interface BuildingCardProps {
  building: Building
  showDistance?: boolean
  /** 승인·역할이 갖춰진 사용자만 실제 비밀번호 노출 (서버와 동일 기준) */
  canRevealBuildingPassword?: boolean
  onUpdate?: (buildingId: string, updated: Partial<Building>) => void
  /** 포인트 적립 후 헤더 표시를 즉시 갱신하기 위한 콜백 */
  onPointsUpdate?: () => void
  /** true이면 마운트 즉시 팝업 오픈 (중복 건물에서 이동 시 사용) */
  autoOpen?: boolean
}

export function BuildingCard({
  building,
  showDistance = true,
  canRevealBuildingPassword = false,
  onUpdate,
  onPointsUpdate,
  autoOpen = false,
}: BuildingCardProps) {
  const {
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
  } = useBuildingCard({
    building,
    canRevealBuildingPassword,
    onUpdate,
    onPointsUpdate,
    autoOpen,
  })

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
            className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground">건물 정보</h3>
              <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => setShowPopup(false)}
                className="h-8 w-8 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 정보 섹션 */}
            <div className="px-4 pt-3 pb-1">
              {/* 주소 (수정 불가) */}
              <div className="flex items-start gap-2 py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground w-16 flex-shrink-0 pt-0.5">주소</span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{shortenAddress(currentBuilding.address)}</p>
                  {jibunLoading && (
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">번지 주소 확인 중...</p>
                  )}
                  {!jibunLoading && jibunAddress && (
                    <p className="text-[11px] text-gray-400 mt-0.5">({jibunAddress})</p>
                  )}
                </div>
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

                      {accessType === "password" && canRevealBuildingPassword && (
                        <button
                          type="button"
                          onClick={() => { setShowPasswordReport(true); setPwReportMode(null) }}
                          className="mt-2 text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2"
                        >
                          ⚠️ 비밀번호가 틀려요?
                        </button>
                      )}
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
                                aria-label="저장"
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
                                aria-label="취소"
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
                                  aria-label="비밀번호 수정"
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
                  {/*
                    뱃지 표시 규칙:
                    - 값이 설정됨 + 수정 모드 아님 → 선택된 뱃지 하나만 (편집자는 클릭해 수정 모드 진입)
                    - 값이 설정됨 + 수정 모드 OR 미설정 + 편집 가능 → 두 버튼 (선택 시 저장 후 보기 모드 복귀)
                    - 미설정 + 편집 불가 → 아무것도 표시 안 함
                  */}
                  {elevatorStatus !== "" && !isEditingElevator ? (
                    <div className="flex flex-wrap gap-2">
                      {elevatorStatus === "yes" && (
                        <button
                          type="button"
                          disabled={!canEdit || isElevatorLocked}
                          onClick={() => setIsEditingElevator(true)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-blue-300 border border-blue-500/30 bg-blue-600/20 ${(!canEdit || isElevatorLocked) ? "cursor-default" : "hover:bg-blue-600/30 transition-all"}`}
                        >
                          <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-blue-600 flex-shrink-0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 9 L12 5 L16 9" />
                              <path d="M8 15 L12 19 L16 15" />
                            </svg>
                          </span>
                          엘리베이터
                        </button>
                      )}
                      {elevatorStatus === "no" && (
                        <button
                          type="button"
                          disabled={!canEdit || isElevatorLocked}
                          onClick={() => setIsEditingElevator(true)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-amber-300 border border-amber-500/30 bg-amber-500/20 ${(!canEdit || isElevatorLocked) ? "cursor-default" : "hover:bg-amber-500/30 transition-all"}`}
                        >
                          <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-amber-500 flex-shrink-0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 20 L4 16 L9 16 L9 12 L14 12 L14 8 L19 8 L19 4 L22 4" />
                            </svg>
                          </span>
                          계단만
                        </button>
                      )}
                    </div>
                  ) : canEdit && !isElevatorLocked ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setElevatorStatus("yes")
                          setIsEditingElevator(false)
                          void saveField("memo", composeMemo("yes", memoText))
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-all ${
                          elevatorStatus === "yes"
                            ? "border-blue-400 bg-blue-600/30 text-blue-200 ring-2 ring-blue-500/40"
                            : "border-blue-500/30 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                        }`}
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
                          setIsEditingElevator(false)
                          void saveField("memo", composeMemo("no", memoText))
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition-all ${
                          elevatorStatus === "no"
                            ? "border-amber-400 bg-amber-500/30 text-amber-200 ring-2 ring-amber-500/40"
                            : "border-amber-500/30 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        }`}
                      >
                        <span className="flex items-center justify-center w-[18px] h-[18px] rounded-md bg-amber-500 flex-shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20 L4 16 L9 16 L9 12 L14 12 L14 8 L19 8 L19 4 L22 4" />
                          </svg>
                        </span>
                        계단만
                      </button>
                    </div>
                  ) : null}

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
                          aria-label="저장"
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
                          aria-label="취소"
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
                            aria-label="메모 수정"
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
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 flex items-center gap-2 text-[11px] text-white/40">
                  <Lock className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1">건물 정보 수정은 편집자만 가능합니다.</span>
                  <Link href="/settings" className="text-blue-400 hover:underline whitespace-nowrap">권한 요청</Link>
                </div>
              )}
              {canEdit && (isPasswordLocked || isElevatorLocked || isMemoLocked) && (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 flex items-center gap-2 text-[11px] text-white/40">
                  <Lock className="h-3 w-3 flex-shrink-0" />
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
                <div className="flex gap-2">
                  {photos.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setLightboxUrl(p.photo_url)
                        setLightboxPhotoId(p.id)
                      }}
                      className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-secondary border border-border hover:border-primary/60 transition-colors"
                    >
                      <Image src={p.photo_url} alt="건물 사진" width={80} height={80} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 길찾기 + 지도 보기 버튼 */}
            <div className="px-4 py-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openNavigation}
                className="flex-1 gap-2 text-primary border-primary/50 hover:bg-primary/10"
              >
                <Navigation className="h-4 w-4" />
                길찾기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap((v) => !v)}
                className="flex-1 gap-2 text-muted-foreground border-border hover:bg-secondary/60"
              >
                <MapPin className="h-4 w-4" />
                {showMap ? "지도 닫기" : "지도 보기"}
              </Button>
            </div>

            {/* 지도 (토글) */}
            {showMap && (
              <div className="w-full h-[200px] bg-secondary">
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
            )}

            {/* 건물 삭제 + 닫기 버튼 */}
            <div className="px-4 py-3 border-t border-border flex gap-2">
              {(role === "admin" || role === "sub_admin") && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeleting ? "삭제 중..." : "건물 삭제"}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 gap-2"
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

      {showPasswordReport && (
        <div
          onClick={() => !pwReportSubmitting && setShowPasswordReport(false)}
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 text-white"
          >
            <h3 className="text-base font-bold mb-1">비밀번호 오류 신고</h3>
            <p className="text-xs text-white/60 mb-4">
              건물: <span className="text-white">{currentBuilding.name || currentBuilding.address}</span>
            </p>

            {pwReportMode === null && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPwReportMode("changed")}
                  className="w-full rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-3 text-left text-sm transition"
                >
                  <div className="font-semibold">🔄 비밀번호가 변경됐어요</div>
                  <div className="text-xs text-white/60 mt-0.5">새 비밀번호를 알려주세요.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPwReportMode("wrong")}
                  className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3 text-left text-sm transition"
                >
                  <div className="font-semibold">⚠️ 비밀번호가 안 맞아요</div>
                  <div className="text-xs text-white/60 mt-0.5">상황을 간단히 알려주세요.</div>
                </button>
              </div>
            )}

            {pwReportMode === "changed" && (
              <div className="space-y-3">
                <label className="block text-xs text-white/60">새 비밀번호</label>
                <Input
                  value={pwReportNewPassword}
                  onChange={(e) => setPwReportNewPassword(e.target.value.slice(0, 50))}
                  placeholder="예: 1234#"
                  className="bg-white/[0.05] border-white/10 text-white"
                  autoFocus
                />
                <p className="text-[11px] text-white/40">
                  관리자가 확인 후 건물 정보를 업데이트합니다.
                </p>
              </div>
            )}

            {pwReportMode === "wrong" && (
              <div className="space-y-3">
                <label className="block text-xs text-white/60">상세 설명 (선택)</label>
                <textarea
                  value={pwReportMemo}
                  onChange={(e) => setPwReportMemo(e.target.value.slice(0, 500))}
                  placeholder="예: 표시된 1234#를 눌렀는데 안 열려요. 어제는 됐는데..."
                  rows={4}
                  className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <Button
                onClick={() => {
                  if (pwReportMode === null) {
                    setShowPasswordReport(false)
                  } else {
                    setPwReportMode(null)
                  }
                }}
                disabled={pwReportSubmitting}
                variant="outline"
                className="flex-1"
              >
                {pwReportMode === null ? "취소" : "뒤로"}
              </Button>
              {pwReportMode !== null && (
                <Button
                  onClick={() => void submitPasswordReport()}
                  disabled={pwReportSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {pwReportSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "신고 보내기"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
            onPointsUpdate?.()
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
            aria-label="사진 닫기"
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
                } catch {
                  toast.error("신고 실패")
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

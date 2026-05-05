"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Navigation, Pencil, X, Check, MapPin, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import { BuildingPasswordDisplay } from "@/components/BuildingPasswordDisplay"
import type { PasswordAccess } from "@/types/building"

interface Building {
  id: string
  name: string
  address: string
  password: string
  memo?: string
  distance?: number
  latitude: number
  longitude: number
}

interface BuildingCardProps {
  building: Building
  showDistance?: boolean
  passwordAccess: PasswordAccess
  onUpdate?: (buildingId: string, updated: Partial<Building>) => void
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

export function BuildingCard({ building, showDistance = true, passwordAccess, onUpdate }: BuildingCardProps) {
  const { canEdit } = useIsAdmin()
  const [showPopup, setShowPopup] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentBuilding, setCurrentBuilding] = useState(building)

  const saveField = async (field: "name" | "password" | "memo", value: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/buildings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId: currentBuilding.id, [field]: value }),
      })
      if (res.ok) {
        const updated = { ...currentBuilding, [field]: value }
        setCurrentBuilding(updated)
        onUpdate?.(currentBuilding.id, { [field]: value })
        toast.success("저장되었습니다.")
      } else {
        toast.error("저장에 실패했습니다.")
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const openNavigation = (e: React.MouseEvent) => {
    e.stopPropagation()
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const name = encodeURIComponent(currentBuilding.name)
    const lat = currentBuilding.latitude
    const lng = currentBuilding.longitude

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

  const mapUrl = `https://maps.google.com/maps?q=${currentBuilding.latitude},${currentBuilding.longitude}&z=17&output=embed`

  return (
    <>
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
                  <span className="text-muted-foreground">{currentBuilding.address}</span>
                </p>
              </div>
              <div className="flex items-start gap-2 flex-shrink-0 max-w-[min(160px,42vw)]">
                <BuildingPasswordDisplay
                  access={passwordAccess}
                  password={currentBuilding.password}
                  variant="compact"
                  className="min-w-0"
                />
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
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
                <span className="text-sm text-foreground flex-1">{currentBuilding.address}</span>
              </div>

              {/* 수정 가능 필드들 */}
              <EditableRow
                label="건물명"
                value={currentBuilding.name || ""}
                onSave={(v) => saveField("name", v)}
                saving={saving}
                canEdit={canEdit}
              />
              {passwordAccess === "full" && canEdit ? (
                <EditableRow
                  label="비밀번호"
                  value={currentBuilding.password || ""}
                  onSave={(v) => saveField("password", v)}
                  saving={saving}
                  canEdit
                />
              ) : (
                <div className="flex items-start gap-2 py-2 border-b border-border/40 last:border-0">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0 pt-0.5">비밀번호</span>
                  <div className="flex-1 min-w-0">
                    <BuildingPasswordDisplay
                      access={passwordAccess}
                      password={currentBuilding.password}
                      variant="panel"
                    />
                  </div>
                </div>
              )}
              <EditableRow
                label="메모"
                value={currentBuilding.memo || ""}
                onSave={(v) => saveField("memo", v)}
                saving={saving}
                canEdit={canEdit}
              />
              {!canEdit && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 flex items-center gap-2 text-xs text-white/50">
                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="flex-1">건물 정보 수정은 편집자만 가능합니다.</span>
                  <Link href="/settings" className="text-blue-400 hover:underline whitespace-nowrap">권한 요청</Link>
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
    </>
  )
}

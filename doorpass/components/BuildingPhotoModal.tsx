"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { X, Upload, Loader2, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

const PHOTO_TYPES = [
  { value: "entrance", label: "입구/현관", emoji: "🚪" },
  { value: "keypad", label: "비번패드", emoji: "🔢" },
  { value: "parking", label: "주차", emoji: "🅿️" },
  { value: "elevator", label: "엘리베이터", emoji: "🛗" },
  { value: "other", label: "기타", emoji: "📷" },
] as const

type PhotoType = (typeof PHOTO_TYPES)[number]["value"]

interface UploadResult {
  photo: { id: number; photo_url: string }
  point: { success: boolean; points?: number; newTotal?: number; reason?: string }
}

interface Props {
  buildingId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onUploaded?: (result: UploadResult) => void
}

export function BuildingPhotoModal({ buildingId, open, onOpenChange, onUploaded }: Props) {
  const [photoType, setPhotoType] = useState<PhotoType>("entrance")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setPhotoType("entrance")
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setProgress(0)
    setUploading(false)
  }

  const handleClose = () => {
    if (uploading) return
    reset()
    onOpenChange(false)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB 이하여야 합니다.")
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const upload = async () => {
    if (!file) {
      toast.error("사진을 선택해주세요.")
      return
    }
    setUploading(true)
    setProgress(0)

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("photo_type", photoType)

      const res = await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `/api/buildings/${buildingId}/photos`)
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        }
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) resolve(data)
            else reject(new Error(data.error || "업로드 실패"))
          } catch {
            reject(new Error("응답 파싱 실패"))
          }
        }
        xhr.onerror = () => reject(new Error("네트워크 오류"))
        xhr.send(fd)
      })

      if (res.point?.success && res.point.points) {
        toast.success(`사진 업로드 완료! +${res.point.points}P 획득!`)
      } else {
        toast.success("사진 업로드 완료!")
      }
      onUploaded?.(res)
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-card rounded-2xl overflow-hidden shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-bold text-foreground">건물 사진 추가</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={uploading}
            className="h-8 w-8 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">사진 종류</label>
            <div className="flex flex-wrap gap-2">
              {PHOTO_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={uploading}
                  onClick={() => setPhotoType(t.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    photoType === t.value
                      ? "bg-blue-500/20 border-blue-400 text-blue-300"
                      : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2">사진</label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="w-full max-h-64 object-contain rounded-lg border border-border bg-secondary"
                />
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl)
                      setPreviewUrl(null)
                      setFile(null)
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="h-20 flex-col gap-1"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">파일 선택</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  className="h-20 flex-col gap-1"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-xs">카메라</span>
                </Button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPick}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPick}
            />
          </div>

          {uploading && (
            <div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                업로드 중... {progress}%
              </p>
            </div>
          )}

          <Button
            onClick={() => void upload()}
            disabled={!file || uploading}
            className="w-full gap-2 bg-primary text-primary-foreground"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "업로드 중..." : "업로드"}
          </Button>
        </div>
      </div>
    </div>
  )
}

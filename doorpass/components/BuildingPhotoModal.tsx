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

const TARGET_MAX_BYTES = 5 * 1024 * 1024
const MAX_DIM = 1920
const QUALITY_STEPS = [0.85, 0.7, 0.5] as const

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."))
    img.src = src
  })
}

async function compressToJpeg(input: File): Promise<File> {
  const objectUrl = URL.createObjectURL(input)
  try {
    const img = await loadImage(objectUrl)
    let { width, height } = img
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D 컨텍스트를 만들 수 없습니다.")
    ctx.drawImage(img, 0, 0, width, height)

    let lastBlob: Blob | null = null
    for (const q of QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", q)
      })
      if (!blob) throw new Error("이미지 인코딩에 실패했습니다.")
      lastBlob = blob
      if (blob.size <= TARGET_MAX_BYTES) break
    }
    if (!lastBlob) throw new Error("압축 결과가 비어 있습니다.")
    if (lastBlob.size > TARGET_MAX_BYTES) {
      throw new Error("압축 후에도 5MB를 초과합니다. 더 작은 사진을 사용해주세요.")
    }
    const baseName = input.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([lastBlob], `${baseName}.jpg`, { type: "image/jpeg" })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

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
  const [compressing, setCompressing] = useState(false)
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
    setCompressing(false)
  }

  const handleClose = () => {
    if (uploading || compressing) return
    reset()
    onOpenChange(false)
  }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    // 동일 파일 재선택을 허용하도록 input 값을 비운다
    e.target.value = ""
    if (!f) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setCompressing(true)

    try {
      const compressed = await compressToJpeg(f)
      setFile(compressed)
      setPreviewUrl(URL.createObjectURL(compressed))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 처리에 실패했습니다.")
    } finally {
      setCompressing(false)
    }
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
      toast.error("업로드 실패")
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
            {compressing ? (
              <div className="h-40 rounded-lg border border-border bg-secondary flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">이미지 처리 중...</span>
              </div>
            ) : previewUrl ? (
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
            disabled={!file || uploading || compressing}
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

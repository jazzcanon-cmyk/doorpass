"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, FileIcon, ImageIcon, X } from "lucide-react"
import { toast } from "sonner"
import type { ResourceItem, ResourceType } from "@/types/resource"
import { uploadFile } from "@/lib/upload"
import { compressImage } from "@/lib/image-utils"

interface EditResourceModalProps {
  isOpen: boolean
  onClose: () => void
  resource: ResourceItem | null
  onSuccess: () => Promise<void> | void
}

export function EditResourceModal({ isOpen, onClose, resource, onSuccess }: EditResourceModalProps) {
  const resourceType = (resource?.resource_type as ResourceType) ?? "link"

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("") // link type only
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isText = resourceType === "text"
  const isLink = resourceType === "link"
  const isImage = resourceType === "image"

  const existingUrl = resource?.url ?? ""

  const fileAccept = useMemo(() => {
    if (isImage) return "image/*"
    if (resourceType === "document") return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
    if (resourceType === "file") return undefined
    return undefined
  }, [isImage, resourceType])

  useEffect(() => {
    if (!resource) return
    setTitle(resource.title ?? "")
    setDescription(resource.description ?? "")
    setUrl(resource.url ?? "")
    setPickedFile(null)
    setImagePreview(null)
    setSaving(false)
  }, [resource, isOpen])

  const clearFile = () => {
    setPickedFile(null)
    setImagePreview(null)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    clearFile()

    // image 유형은 자동 압축
    if (isImage) {
      try {
        const compressed = await compressImage(f)
        setPickedFile(compressed)
        setImagePreview(URL.createObjectURL(compressed))
      } catch {
        setPickedFile(f)
        setImagePreview(URL.createObjectURL(f))
      }
    } else {
      setPickedFile(f)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resource) return

    const nextTitle = title.trim()
    const nextDescription = description.trim()

    if (!nextTitle) {
      toast.error("제목을 입력해주세요.")
      return
    }

    if (isText && !nextDescription) {
      toast.error("내용을 입력해주세요.")
      return
    }

    setSaving(true)
    try {
      let nextUrl: string | null = null

      if (isText) {
        nextUrl = null
      } else if (isLink) {
        const v = url.trim()
        if (!v) throw new Error("URL을 입력해주세요.")
        nextUrl = v
      } else {
        // file/image/document: 새 파일 업로드가 없으면 기존 URL 유지
        if (pickedFile) {
          const uploaded = await uploadFile(pickedFile)
          if (!uploaded) throw new Error("파일 업로드 실패")
          nextUrl = uploaded
        } else {
          nextUrl = existingUrl || null
          if (!nextUrl) throw new Error("기존 첨부파일이 없습니다.")
        }
      }

      const payload = {
        title: nextTitle,
        description: isText ? nextDescription : nextDescription ? nextDescription : null,
        resource_type: resourceType,
        url: nextUrl,
      }

      const res = await fetch(`/api/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(d.error || "수정 실패")
        return
      }

      toast.success("자료가 수정되었습니다.")
      await onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정 중 오류")
    } finally {
      setSaving(false)
    }
  }

  if (!resource) return null

  return (
    <Dialog open={isOpen} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>자료 수정</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">제목</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">내용</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={6}
              required={isText}
            />
          </div>

          {/* 링크 타입: url 입력 */}
          {isLink && (
            <div>
              <label className="block text-sm font-medium mb-2">첨부 (URL)</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required />
            </div>
          )}

          {/* file/document/image 타입: 새 파일 업로드 선택(없으면 기존 유지) */}
          {!isText && !isLink && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">
                  첨부파일 {isImage ? "(이미지)" : ""}
                </label>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  disabled={!pickedFile && !imagePreview}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {isImage && (
                <div className="bg-secondary rounded-lg p-3">
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="" className="w-full rounded-md" />
                  ) : existingUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={existingUrl} alt="" className="w-full rounded-md" />
                  ) : (
                    <div className="text-xs text-muted-foreground">기존 이미지가 없습니다.</div>
                  )}
                </div>
              )}

              <Input type="file" accept={fileAccept} onChange={handleFileChange} />

              {pickedFile && (
                <div className="text-xs text-muted-foreground">
                  선택됨: {pickedFile.name}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />수정 중...
                </>
              ) : (
                "수정 완료"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


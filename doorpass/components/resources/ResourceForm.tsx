"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2, ImageIcon, File as FileIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { compressImage } from "@/lib/image-utils"
import { uploadFile } from "@/lib/upload"
import { RESOURCE_TYPE_CONFIG, type ResourceType } from "@/types/resource"

interface ResourceFormProps {
  onCancel: () => void
  onSubmitted: () => Promise<void> | void
}

export function ResourceForm({ onCancel, onSubmitted }: ResourceFormProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [resourceType, setResourceType] = useState<ResourceType>("link")
  const [url, setUrl] = useState("")
  const [author, setAuthor] = useState("")
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [compressInfo, setCompressInfo] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const clearFile = () => {
    setPickedFile(null)
    setImagePreview(null)
    setCompressInfo(null)
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ""

    if (isImage) {
      const origKB = Math.round(f.size / 1024)
      if (f.size > 500 * 1024) {
        setCompressing(true)
        try {
          const compressed = await compressImage(f)
          setPickedFile(compressed)
          setImagePreview(URL.createObjectURL(compressed))
          setCompressInfo(`자동 압축: ${origKB}KB → ${Math.round(compressed.size / 1024)}KB`)
        } catch {
          setPickedFile(f)
          setImagePreview(URL.createObjectURL(f))
        }
        setCompressing(false)
      } else {
        setPickedFile(f)
        setImagePreview(URL.createObjectURL(f))
        setCompressInfo(`${origKB}KB (압축 불필요)`)
      }
    } else {
      setPickedFile(f)
      setCompressInfo(`${f.name} (${Math.round(f.size / 1024)}KB)`)
    }
  }

  const submit = async () => {
    if (!title.trim()) { toast.error("제목을 입력해주세요."); return }
    if (resourceType === "text" && !description.trim()) { toast.error("내용을 입력해주세요."); return }
    if (resourceType === "link" && !url.trim()) { toast.error("URL을 입력해주세요."); return }
    if (resourceType !== "link" && resourceType !== "text" && !pickedFile && !url.trim()) {
      toast.error("파일을 선택하거나 URL을 입력해주세요."); return
    }

    setSubmitting(true)
    let finalUrl = url.trim() || null

    if (pickedFile) {
      const uploaded = await uploadFile(pickedFile)
      if (!uploaded) { setSubmitting(false); return }
      finalUrl = uploaded
    }

    try {
      const r = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          resource_type: resourceType,
          url: finalUrl,
          author: author.trim() || "관리자",
        }),
      })
      if (!r.ok) { toast.error("등록 실패"); return }
      toast.success("자료가 등록됐습니다.")
      await onSubmitted()
      onCancel()
    } catch { toast.error("등록 실패") }
    setSubmitting(false)
  }

  return (
    <Card className="mb-4 border-primary/30">
      <CardContent className="p-4 space-y-3">
        <Input placeholder="닉네임 (기본: 관리자)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-secondary border-0" />
        <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-0 font-medium" />
        {resourceType !== "text" && (
          <Input placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-0" />
        )}

        <div className="flex gap-2">
          {(Object.keys(RESOURCE_TYPE_CONFIG) as ResourceType[]).map((t) => {
            const cfg = RESOURCE_TYPE_CONFIG[t]
            return (
              <button
                key={t}
                onClick={() => { setResourceType(t); clearFile(); setUrl("") }}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  resourceType === t
                    ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <cfg.Icon className="h-4 w-4" />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {resourceType === "text" && (
          <textarea
            placeholder="내용을 입력하세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded-md bg-secondary border-0 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {resourceType === "link" && (
          <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary border-0" />
        )}

        {resourceType === "image" && (
          <div className="space-y-2">
            {pickedFile ? (
              <div className="relative">
                {imagePreview && <img src={imagePreview} alt="" className="w-full rounded-lg" />}
                <button onClick={clearFile} className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80">
                  <X className="h-4 w-4" />
                </button>
                {compressInfo && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{compressInfo}</div>
                )}
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground text-sm py-1">
                  {compressing
                    ? <><Loader2 className="h-4 w-4 animate-spin" />압축 중...</>
                    : <><ImageIcon className="h-4 w-4" />이미지 파일 선택 (자동 압축)</>
                  }
                  <input type="file" accept="image/*" className="hidden" disabled={compressing}
                    onChange={(e) => handleFilePick(e, true)} />
                </label>
                <p className="text-xs text-muted-foreground">또는</p>
                <Input placeholder="이미지 URL" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary border-0" />
              </>
            )}
          </div>
        )}

        {(resourceType === "file" || resourceType === "document") && (
          <div className="space-y-2">
            {pickedFile ? (
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{compressInfo}</span>
                <button onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground text-sm py-1">
                  <FileIcon className="h-4 w-4" />
                  {resourceType === "document" ? "문서 파일 선택 (PDF, DOC, XLS, PPT...)" : "파일 선택"}
                  <input
                    type="file"
                    className="hidden"
                    accept={resourceType === "document"
                      ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      : undefined}
                    onChange={(e) => handleFilePick(e, false)}
                  />
                </label>
                <p className="text-xs text-muted-foreground">또는</p>
                <Input placeholder="파일 URL" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary border-0" />
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1">취소</Button>
          <Button onClick={submit} disabled={submitting || compressing} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "등록"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

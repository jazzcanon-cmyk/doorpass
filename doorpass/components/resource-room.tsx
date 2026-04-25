"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, AlertCircle, Link, FileText, ImageIcon, File as FileIcon, FolderOpen, ExternalLink, X, PenLine, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type ResourceType = "link" | "file" | "image" | "document" | "text"

interface Resource {
  id: number
  title: string
  description?: string
  resource_type: ResourceType
  url?: string
  author: string
  created_at: string
}

const TYPE_CONFIG: Record<ResourceType, { label: string; Icon: React.ElementType; color: string; bg: string }> = {
  link:     { label: "링크",   Icon: Link,      color: "text-blue-400",   bg: "bg-blue-500/10" },
  file:     { label: "파일",   Icon: FileIcon,  color: "text-orange-400", bg: "bg-orange-500/10" },
  image:    { label: "이미지", Icon: ImageIcon,  color: "text-green-400",  bg: "bg-green-500/10" },
  document: { label: "문서",   Icon: FileText,  color: "text-purple-400", bg: "bg-purple-500/10" },
  text:     { label: "글",     Icon: PenLine,   color: "text-cyan-400",   bg: "bg-cyan-500/10" },
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  if (file.size <= 500 * 1024) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > 1200 || height > 1200) {
        const ratio = Math.min(1200 / width, 1200 / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() })
        resolve(compressed.size < file.size ? compressed : file)
      }, "image/jpeg", 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append("file", file)
  const r = await fetch("/api/upload/files", { method: "POST", body: fd })
  const d = await r.json()
  if (!r.ok) { toast.error(d.error || "업로드 실패"); return null }
  return d.url as string
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return Math.floor(s / 60) + "분 전"
  if (s < 86400) return Math.floor(s / 3600) + "시간 전"
  return Math.floor(s / 86400) + "일 전"
}

export function ResourceRoom() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
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
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchResources = async () => {
    setError(null)
    try {
      const r = await fetch("/api/resources")
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      setResources(d.resources ?? [])
    } catch {
      setError("자료를 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchResources() }, [])

  const clearFile = () => {
    setPickedFile(null)
    setImagePreview(null)
    setCompressInfo(null)
  }

  const resetForm = () => {
    setTitle(""); setDescription(""); setUrl(""); setAuthor("")
    setResourceType("link"); clearFile(); setShowForm(false)
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
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "등록 실패"); return }
      toast.success("자료가 등록됐습니다.")
      resetForm()
      await fetchResources()
    } catch { toast.error("등록 실패") }
    setSubmitting(false)
  }

  const deleteResource = async (id: number) => {
    if (!confirm("삭제하시겠어요?")) return
    try {
      const r = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      if (!r.ok) { toast.error("삭제 실패"); return }
      setResources((prev) => prev.filter((item) => item.id !== id))
      toast.success("삭제됐습니다.")
    } catch { toast.error("삭제 실패") }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">자료실</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />자료 등록
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4 border-primary/30">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="닉네임 (기본: 관리자)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-secondary border-0" />
            <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-0 font-medium" />
            {resourceType !== "text" && (
              <Input placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary border-0" />
            )}

            {/* 타입 선택 */}
            <div className="flex gap-2">
              {(Object.keys(TYPE_CONFIG) as ResourceType[]).map((t) => {
                const cfg = TYPE_CONFIG[t]
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

            {/* 글: 텍스트 내용 */}
            {resourceType === "text" && (
              <textarea
                placeholder="내용을 입력하세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-md bg-secondary border-0 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}

            {/* 링크: URL만 */}
            {resourceType === "link" && (
              <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary border-0" />
            )}

            {/* 이미지: 파일 선택(압축) + URL 병행 */}
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

            {/* 파일/문서: 파일 선택 + URL 병행 */}
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
              <Button variant="ghost" onClick={resetForm} className="flex-1">취소</Button>
              <Button onClick={submit} disabled={submitting || compressing} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "등록"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm py-4">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {resources.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">등록된 자료가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {resources.map((res) => {
            const cfg = TYPE_CONFIG[res.resource_type as ResourceType] ?? TYPE_CONFIG.link
            const isText = res.resource_type === "text"
            const isExpanded = expandedId === res.id
            return (
              <Card
                key={res.id}
                className="hover:border-primary/50 transition-all"
                onClick={() => {
                  if (isText) setExpandedId(isExpanded ? null : res.id)
                  else if (res.url) window.open(res.url, "_blank")
                }}
                style={{ cursor: isText || res.url ? "pointer" : "default" }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                      <cfg.Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium flex-shrink-0`}>
                          {cfg.label}
                        </span>
                        <p className="font-medium text-sm text-foreground truncate">{res.title}</p>
                        {!isText && res.url && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        {isText && (
                          isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      {isText ? (
                        isExpanded && res.description && (
                          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{res.description}</p>
                        )
                      ) : (
                        res.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{res.description}</p>
                        )
                      )}
                      {res.resource_type === "image" && res.url && (
                        <img
                          src={res.url}
                          alt={res.title}
                          className="mt-2 w-full rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="text-xs text-muted-foreground mt-1">{res.author} · {ago(res.created_at)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteResource(res.id) }}
                      className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

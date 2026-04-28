"use client"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ImageIcon, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBoardStore } from "@/stores/boardStore"
import { compressImage } from "@/lib/image-utils"

export function PostWrite({ defaultAuthor }: { defaultAuthor?: string }) {
  const { goToList, afterWrite } = useBoardStore()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState(defaultAuthor ?? "")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [compressInfo, setCompressInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const origKB = Math.round(f.size / 1024)
    if (f.size > 500 * 1024) {
      setCompressing(true)
      try {
        const c = await compressImage(f)
        setImageFile(c); setPreview(URL.createObjectURL(c))
        setCompressInfo("자동 압축: " + origKB + "KB → " + Math.round(c.size / 1024) + "KB")
      } catch { setImageFile(f); setPreview(URL.createObjectURL(f)) }
      setCompressing(false)
    } else {
      setImageFile(f); setPreview(URL.createObjectURL(f))
      setCompressInfo(origKB + "KB (압축 불필요)")
    }
  }

  const submit = async () => {
    if (!title.trim() || !content.trim()) { toast.error("제목과 내용을 입력해주세요."); return }
    setSubmitting(true)
    let image_url = null
    if (imageFile) {
      const fd = new FormData(); fd.append("file", imageFile)
      try {
        const r = await fetch("/api/upload", { method: "POST", body: fd })
        if (r.ok) { const d = await r.json(); image_url = d.url }
        else { toast.error("이미지 업로드에 실패했습니다."); setSubmitting(false); return }
      } catch { toast.error("이미지 업로드에 실패했습니다."); setSubmitting(false); return }
    }
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, author: author || "익명", image_url }),
      })
      if (r.ok) { afterWrite() } else { const d = await r.json(); toast.error(d.error || "게시글 등록에 실패했습니다."); setSubmitting(false) }
    } catch { toast.error("게시글 등록에 실패했습니다."); setSubmitting(false) }
  }

  return (
    <div>
      <button onClick={goToList} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground"><ArrowLeft className="h-4 w-4" />취소</button>
      <h2 className="text-base font-bold mb-4">글쓰기</h2>
      <div className="space-y-3">
        <Input placeholder="닉네임 (선택)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-secondary border-0" />
        <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-0 font-medium" />
        <textarea placeholder="내용을 입력하세요" value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="w-full rounded-md bg-secondary border-0 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-auto rounded-lg" />
            <button onClick={() => { setImageFile(null); setPreview(null); setCompressInfo(null) }} className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
            {compressInfo && <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{compressInfo}</div>}
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
            {compressing ? <><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">압축 중...</span></> : <><ImageIcon className="h-5 w-5" /><span className="text-sm">사진 첨부 (자동 압축)</span></>}
            <input type="file" accept="image/*" onChange={onImage} className="hidden" disabled={compressing} />
          </label>
        )}
        <Button onClick={submit} disabled={submitting || compressing} className="w-full">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />등록 중...</> : "게시글 등록"}
        </Button>
      </div>
    </div>
  )
}

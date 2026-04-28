"use client"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBoardStore, type PostDetail } from "@/stores/boardStore"

export function PostEdit({ post }: { post: PostDetail }) {
  const { goToDetail, afterEdit } = useBoardStore()
  const [title, setTitle] = useState(post.title)
  const [content, setContent] = useState(post.content)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!title.trim() || !content.trim()) { toast.error("제목과 내용을 입력해주세요."); return }
    setSubmitting(true)
    try {
      const r = await fetch("/api/posts/" + post.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      })
      if (r.ok) { afterEdit() } else { const d = await r.json(); toast.error(d.error || "수정 실패"); setSubmitting(false) }
    } catch { toast.error("수정 실패"); setSubmitting(false) }
  }

  return (
    <div>
      <button onClick={() => goToDetail(post.id)} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground"><ArrowLeft className="h-4 w-4" />취소</button>
      <h2 className="text-base font-bold mb-4">게시글 수정</h2>
      <div className="space-y-3">
        <div className="px-3 py-2 bg-secondary/50 rounded-md text-xs text-muted-foreground">작성자: {post.author}</div>
        <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-0 font-medium" />
        <textarea placeholder="내용" value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full rounded-md bg-secondary border-0 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
        {post.image_url && <div className="text-xs text-muted-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4" />첨부 이미지는 수정 시 유지됩니다</div>}
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />수정 중...</> : "수정 완료"}
        </Button>
      </div>
    </div>
  )
}

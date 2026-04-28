"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ArrowLeft, Eye, Send, Loader2, Pencil, Trash2, Check, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useBoardStore, type PostDetail as PostDetailType } from "@/stores/boardStore"
import { ago } from "@/lib/date-utils"
import { trackPostView } from "@/lib/analytics"
import type { Comment } from "@/types/board"

interface PostDetailProps {
  postId: number
  defaultAuthor?: string
}

export function PostDetail({ postId, defaultAuthor }: PostDetailProps) {
  const { goToList, goToEdit, afterDelete } = useBoardStore()
  const [post, setPost] = useState<PostDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState("")
  const [author, setAuthor] = useState(defaultAuthor ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [likingIds, setLikingIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!postId || isNaN(postId)) { setError("잘못된 ID"); setLoading(false); return }
    fetch("/api/posts/" + postId)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else { setPost(d.post); if (d.post) trackPostView(postId, d.post.title) } setLoading(false) })
      .catch(() => { setError("불러오기 실패"); setLoading(false) })
  }, [postId])

  const toggleLike = async (commentId: number) => {
    if (likingIds.has(commentId)) return
    setLikingIds((prev) => new Set(prev).add(commentId))
    setPost((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        comments: prev.comments.map((c: Comment) =>
          c.id === commentId
            ? { ...c, liked: !c.liked, like_count: c.liked ? c.like_count - 1 : c.like_count + 1 }
            : c
        ),
      }
    })
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setPost((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            comments: prev.comments.map((c: Comment) =>
              c.id === commentId ? { ...c, liked: data.liked, like_count: data.like_count } : c
            ),
          }
        })
      }
    } catch { /* 낙관적 업데이트 유지 */ }
    setLikingIds((prev) => { const s = new Set(prev); s.delete(commentId); return s })
  }

  const submitComment = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/posts/" + postId + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, author: author || "익명" }),
      })
      const data = await res.json()
      if (res.ok && data.comment) {
        setPost((prev) => prev ? { ...prev, comments: [...prev.comments, data.comment] } : prev)
        setComment("")
      } else {
        toast.error(data.error || "댓글 작성에 실패했습니다.")
      }
    } catch { toast.error("댓글 작성에 실패했습니다.") }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch("/api/posts/" + postId, { method: "DELETE" })
      if (res.ok) { afterDelete() }
      else { const d = await res.json(); toast.error(d.error || "삭제 실패"); setDeleting(false); setConfirmDelete(false) }
    } catch { toast.error("삭제 실패"); setDeleting(false); setConfirmDelete(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error || !post) return (
    <div>
      <button onClick={goToList} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm"><ArrowLeft className="h-4 w-4" />목록</button>
      <p className="text-center py-8 text-muted-foreground">{error || "게시글을 찾을 수 없습니다."}</p>
    </div>
  )
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goToList} className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"><ArrowLeft className="h-4 w-4" />목록으로</button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => goToEdit(post)} className="h-8 gap-1.5 text-xs"><Pencil className="h-3.5 w-3.5" />수정</Button>
          <Button variant={confirmDelete ? "destructive" : "outline"} size="sm" onClick={handleDelete} disabled={deleting} className="h-8 gap-1.5 text-xs">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmDelete ? <><Check className="h-3.5 w-3.5" />확인</> : <><Trash2 className="h-3.5 w-3.5" />삭제</>}
          </Button>
          {confirmDelete && !deleting && <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-8 text-xs">취소</Button>}
        </div>
      </div>
      <Card className="mb-4"><CardContent className="p-4">
        <h2 className="font-bold text-foreground text-base mb-2">{post.title}</h2>
        <div className="flex gap-3 text-xs text-muted-foreground mb-4">
          <span>{post.author}</span><span>{ago(post.created_at)}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.view_count}</span>
        </div>
        {post.image_url && <img src={post.image_url} alt="" className="w-full h-auto rounded-lg mb-4" />}
        <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
      </CardContent></Card>
      <div className="mb-3">
        <p className="text-sm font-medium text-muted-foreground mb-2">댓글 {post.comments?.length ?? 0}개</p>
        <div className="space-y-2">
          {(post.comments || []).map((c: Comment) => (
            <Card key={c.id} className="bg-secondary/50"><CardContent className="p-3">
              <div className="flex gap-2 mb-1"><span className="text-xs font-medium">{c.author}</span><span className="text-xs text-muted-foreground">{ago(c.created_at)}</span></div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm flex-1">{c.content}</p>
                <button
                  onClick={() => toggleLike(c.id)}
                  disabled={likingIds.has(c.id)}
                  className={`flex items-center gap-1 text-xs flex-shrink-0 transition-colors ${c.liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-400"}`}
                  aria-label="좋아요"
                >
                  <Heart className={`h-3.5 w-3.5 ${c.liked ? "fill-rose-500" : ""}`} />
                  {(c.like_count ?? 0) > 0 && <span>{c.like_count}</span>}
                </button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
      <Card><CardContent className="p-3 space-y-2">
        <Input placeholder="닉네임 (선택)" value={author} onChange={(e) => setAuthor(e.target.value)} className="h-8 text-sm bg-secondary border-0" />
        <div className="flex gap-2">
          <Input placeholder="댓글을 입력하세요" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()} className="h-9 text-sm bg-secondary border-0 flex-1" />
          <Button size="icon" onClick={submitComment} disabled={submitting || !comment.trim()} className="h-9 w-9">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  )
}

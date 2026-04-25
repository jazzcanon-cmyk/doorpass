"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Megaphone, Loader2, AlertCircle, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Notice {
  id: number
  title: string
  content: string
  author: string
  is_important: boolean
  created_at: string
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return Math.floor(s / 60) + "분 전"
  if (s < 86400) return Math.floor(s / 3600) + "시간 전"
  return Math.floor(s / 86400) + "일 전"
}

export function NoticeBoard() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [author, setAuthor] = useState("")
  const [isImportant, setIsImportant] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchNotices = async () => {
    setError(null)
    try {
      const r = await fetch("/api/notices")
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      setNotices(d.notices ?? [])
    } catch {
      setError("공지사항을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotices() }, [])

  const resetForm = () => {
    setTitle(""); setContent(""); setAuthor(""); setIsImportant(false); setShowForm(false)
  }

  const submit = async () => {
    if (!title.trim() || !content.trim()) { toast.error("제목과 내용을 입력해주세요."); return }
    setSubmitting(true)
    try {
      const r = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, author: author || "관리자", is_important: isImportant }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "등록 실패"); return }
      toast.success("공지사항이 등록됐습니다.")
      resetForm()
      await fetchNotices()
    } catch { toast.error("등록 실패") }
    setSubmitting(false)
  }

  const deleteNotice = async (id: number) => {
    if (!confirm("삭제하시겠어요?")) return
    try {
      const r = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      if (!r.ok) { toast.error("삭제 실패"); return }
      setNotices((prev) => prev.filter((n) => n.id !== id))
      toast.success("삭제됐습니다.")
    } catch { toast.error("삭제 실패") }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">공지사항</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />공지 작성
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4 border-primary/30">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="닉네임 (기본: 관리자)" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-secondary border-0" />
            <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-0 font-medium" />
            <textarea
              placeholder="내용을 입력하세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full rounded-md bg-secondary border-0 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => setIsImportant(!isImportant)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-colors ${isImportant ? "bg-yellow-500/20 text-yellow-400" : "bg-secondary text-muted-foreground"}`}
            >
              <Star className="h-4 w-4" />
              {isImportant ? "중요 공지 ✓" : "중요 공지로 표시"}
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetForm} className="flex-1">취소</Button>
              <Button onClick={submit} disabled={submitting} className="flex-1">
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

      {notices.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <Megaphone className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">등록된 공지사항이 없습니다.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => (
            <Card key={n.id} className={n.is_important ? "border-yellow-500/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.is_important && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          중요
                        </span>
                      )}
                      <p className="font-medium text-sm text-foreground line-clamp-1">{n.title}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">{n.author} · {ago(n.created_at)}</div>
                    {expandedId === n.id && (
                      <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{n.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {expandedId === n.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteNotice(n.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { ArrowLeft, Plus, Eye, ImageIcon, X, Send, Loader2, MessageCircle, Pencil, Trash2, Check, Megaphone, FolderOpen, Search, ChevronDown, ChevronUp, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useBoardStore, type PostDetail } from "@/stores/boardStore"
import { NoticeBoard } from "@/components/notice-board"
import { ResourceRoom } from "@/components/resource-room"
import { trackPostView, trackButtonClick } from "@/lib/analytics"

type BoardTab = "notices" | "resources" | "posts"

interface Post {
  id: number
  title: string
  author: string
  created_at: string
  view_count: number
  image_url?: string
}
interface Comment {
  id: number
  content: string
  author: string
  created_at: string
  like_count: number
  liked?: boolean
}
interface Notice {
  id: number
  title: string
  content: string
  author: string
  is_important: boolean
  created_at: string
}
interface Resource {
  id: number
  title: string
  description?: string
  resource_type: string
  url?: string
  author: string
  created_at: string
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
        const c = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() })
        resolve(c.size < file.size ? c : file)
      }, "image/jpeg", 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "방금 전"
  if (s < 3600) return Math.floor(s / 60) + "분 전"
  if (s < 86400) return Math.floor(s / 3600) + "시간 전"
  return Math.floor(s / 86400) + "일 전"
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary not-italic rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function SearchBar({ searchQuery, onSearchChange, onClear }: {
  searchQuery: string
  onSearchChange: (v: string) => void
  onClear: () => void
}) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="제목, 내용으로 검색..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9 pr-9 bg-secondary border-0 h-9 text-sm"
      />
      {searchQuery && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="검색어 초기화"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function SearchableNoticeList({ query }: { query: string }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/notices")
      .then((r) => r.json())
      .then((d) => { setNotices(d.notices ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = notices.filter((n) => {
    const q = query.toLowerCase()
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  })

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        공지사항에서 &ldquo;{query}&rdquo; {filtered.length}개 검색됨
      </p>
      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <Search className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground text-sm text-center">공지사항에서 검색 결과가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card key={n.id} className={n.is_important ? "border-yellow-500/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.is_important && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">중요</span>
                      )}
                      <p className="font-medium text-sm text-foreground line-clamp-1">
                        <Highlight text={n.title} query={query} />
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">{n.author} · {ago(n.created_at)}</div>
                    {expandedId === n.id && (
                      <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        <Highlight text={n.content} query={query} />
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    {expandedId === n.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const TYPE_LABELS: Record<string, string> = {
  link: "링크", file: "파일", image: "이미지", document: "문서", text: "글",
}

function SearchableResourceList({ query }: { query: string }) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/resources")
      .then((r) => r.json())
      .then((d) => { setResources(d.resources ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = resources.filter((r) => {
    const q = query.toLowerCase()
    return r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
  })

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        자료실에서 &ldquo;{query}&rdquo; {filtered.length}개 검색됨
      </p>
      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <Search className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground text-sm text-center">자료실에서 검색 결과가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((res) => (
            <Card
              key={res.id}
              className="hover:border-primary/50 transition-all"
              onClick={() => res.url && window.open(res.url, "_blank")}
              style={{ cursor: res.url ? "pointer" : "default" }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium flex-shrink-0">
                        {TYPE_LABELS[res.resource_type] ?? res.resource_type}
                      </span>
                      <p className="font-medium text-sm text-foreground truncate">
                        <Highlight text={res.title} query={query} />
                      </p>
                    </div>
                    {res.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        <Highlight text={res.description} query={query} />
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{res.author} · {ago(res.created_at)}</div>
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

function SearchAllResults({ query, clearSearch }: { query: string; clearSearch: () => void }) {
  const { goToDetail } = useBoardStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch("/api/posts").then((r) => r.json()),
      fetch("/api/resources").then((r) => r.json()),
    ])
      .then(([postsData, resourcesData]) => {
        setPosts(postsData.posts ?? [])
        setResources(resourcesData.resources ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const q = query.toLowerCase()
  const filteredPosts = posts.filter((p) => p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q))
  const filteredResources = resources.filter((r) => r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
  const total = filteredPosts.length + filteredResources.length

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        &ldquo;{query}&rdquo; 전체 {total}개 검색됨
        {total > 0 && ` (게시글 ${filteredPosts.length}개, 자료실 ${filteredResources.length}개)`}
      </p>

      {total === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <Search className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground text-sm text-center">검색 결과가 없습니다.</p>
          <button onClick={clearSearch} className="mt-2 text-xs text-primary hover:underline">검색어 초기화</button>
        </CardContent></Card>
      ) : (
        <>
          {filteredPosts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />게시글 ({filteredPosts.length})
              </p>
              <div className="space-y-2">
                {filteredPosts.map((p) => (
                  <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => goToDetail(p.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {p.image_url && <img src={p.image_url} alt="" className="w-14 rounded-lg object-contain bg-secondary flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm line-clamp-2">
                            <Highlight text={p.title} query={query} />
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span><Highlight text={p.author} query={query} /></span>
                            <span>{ago(p.created_at)}</span>
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredResources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />자료실 ({filteredResources.length})
              </p>
              <div className="space-y-2">
                {filteredResources.map((res) => (
                  <Card
                    key={res.id}
                    className="hover:border-primary/50 transition-all"
                    onClick={() => res.url && window.open(res.url, "_blank")}
                    style={{ cursor: res.url ? "pointer" : "default" }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium flex-shrink-0">
                              {TYPE_LABELS[res.resource_type] ?? res.resource_type}
                            </span>
                            <p className="font-medium text-sm text-foreground truncate">
                              <Highlight text={res.title} query={query} />
                            </p>
                          </div>
                          {res.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              <Highlight text={res.description} query={query} />
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">{res.author} · {ago(res.created_at)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function List({ listKey, debouncedQuery, clearSearch }: {
  listKey: number
  debouncedQuery: string
  clearSearch: () => void
}) {
  const { goToDetail, goToWrite } = useBoardStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setPosts(d.posts || []); setLoading(false) })
      .catch(() => { setError("게시글 불러오기 실패"); setLoading(false) })
  }, [listKey])

  const isSearching = debouncedQuery.length >= 2
  const filteredPosts = isSearching
    ? posts.filter((p) => {
        const q = debouncedQuery.toLowerCase()
        return p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)
      })
    : posts

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="text-center py-8 text-destructive text-sm">{error}</div>
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">게시판</h2>
        <Button size="sm" onClick={() => { trackButtonClick("write_post"); goToWrite() }} className="gap-1.5 h-8"><Plus className="h-3.5 w-3.5" />글쓰기</Button>
      </div>

      {isSearching && (
        <p className="text-xs text-muted-foreground mb-3">
          게시판에서 &ldquo;{debouncedQuery}&rdquo; {filteredPosts.length}개 검색됨
        </p>
      )}

      {filteredPosts.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          {isSearching ? (
            <>
              <Search className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground text-sm text-center">게시판에서 검색 결과가 없습니다.</p>
              <button onClick={clearSearch} className="mt-2 text-xs text-primary hover:underline">검색어 초기화</button>
            </>
          ) : (
            <>
              <MessageCircle className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">첫 번째 글을 작성해보세요!</p>
            </>
          )}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-all" onClick={() => goToDetail(p.id)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {p.image_url && <img src={p.image_url} alt="" className="w-14 rounded-lg object-contain bg-secondary flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm line-clamp-2">
                      <Highlight text={p.title} query={debouncedQuery} />
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span><Highlight text={p.author} query={debouncedQuery} /></span>
                      <span>{ago(p.created_at)}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p.view_count}</span>
                    </div>
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

function Detail({ postId, defaultAuthor }: { postId: number; defaultAuthor?: string }) {
  const { goToList, goToEdit, afterDelete } = useBoardStore()
  const [post, setPost] = useState<PostDetail | null>(null)
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

function Write({ defaultAuthor }: { defaultAuthor?: string }) {
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

function Edit({ post }: { post: PostDetail }) {
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

interface CurrentUser {
  userName: string
  email?: string
  userId?: string
}

export function Board({ currentUser }: { currentUser?: CurrentUser }) {
  const { view, postId, editPost, listKey, goToList } = useBoardStore()
  const [boardTab, setBoardTab] = useState<BoardTab>("posts")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value.trim()), 500)
  }

  const clearSearch = () => {
    setSearchQuery("")
    setDebouncedQuery("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  const isSearching = debouncedQuery.length >= 2

  const handleTabChange = (tab: BoardTab) => {
    setBoardTab(tab)
    if (tab !== "posts") goToList()
  }

  return (
    <div>
      {boardTab === "notices" && (
        <div>
          <button onClick={() => handleTabChange("posts")} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />게시판으로
          </button>
          <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
          {isSearching ? (
            <SearchableNoticeList query={debouncedQuery} />
          ) : (
            <NoticeBoard />
          )}
        </div>
      )}

      {boardTab === "resources" && (
        <div>
          <button onClick={() => handleTabChange("posts")} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />게시판으로
          </button>
          <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
          {isSearching ? (
            <SearchableResourceList query={debouncedQuery} />
          ) : (
            <ResourceRoom />
          )}
        </div>
      )}

      {boardTab === "posts" && (
        <>
          {view === "list" && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => handleTabChange("notices")}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-all text-left"
              >
                <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">공지사항</span>
              </button>
              <button
                onClick={() => handleTabChange("resources")}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-all text-left"
              >
                <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">자료실</span>
              </button>
            </div>
          )}
          {view === "list" && (
            <>
              <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
              {isSearching ? (
                <SearchAllResults query={debouncedQuery} clearSearch={clearSearch} />
              ) : (
                <List listKey={listKey} debouncedQuery="" clearSearch={clearSearch} />
              )}
            </>
          )}
          {view === "detail" && postId !== null && <Detail postId={postId} defaultAuthor={currentUser?.userName} />}
          {view === "write" && <Write defaultAuthor={currentUser?.userName} />}
          {view === "edit" && editPost && <Edit post={editPost} />}
        </>
      )}
    </div>
  )
}

"use client"
import { useState, useEffect } from "react"
import { Loader2, Plus, Eye, MessageCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBoardStore } from "@/stores/boardStore"
import { Highlight } from "./Highlight"
import { ago } from "@/lib/date-utils"
import { trackButtonClick } from "@/lib/analytics"
import type { Post } from "@/types/board"

interface PostListProps {
  listKey: number
  debouncedQuery: string
  clearSearch: () => void
}

export function PostList({ listKey, debouncedQuery, clearSearch }: PostListProps) {
  const { goToDetail, goToWrite } = useBoardStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError("게시글을 불러오지 못했습니다."); else setPosts(d.posts || []); setLoading(false) })
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

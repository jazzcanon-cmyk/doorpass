"use client"
import { useState, useEffect } from "react"
import { Loader2, Search, Eye, MessageCircle, FolderOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useBoardStore } from "@/stores/boardStore"
import { Highlight } from "./Highlight"
import { ago } from "@/lib/date-utils"
import { RESOURCE_TYPE_LABELS, type Post, type Resource } from "@/types/board"

export function SearchAllResults({ query, clearSearch }: { query: string; clearSearch: () => void }) {
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
                              {RESOURCE_TYPE_LABELS[res.resource_type] ?? res.resource_type}
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

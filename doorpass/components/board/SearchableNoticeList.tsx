"use client"
import { useState, useEffect } from "react"
import { Loader2, Search, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Highlight } from "./Highlight"
import { ago } from "@/lib/date-utils"
import type { Notice } from "@/types/board"

export function SearchableNoticeList({ query }: { query: string }) {
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
                    aria-label={expandedId === n.id ? "공지 접기" : "공지 펼치기"}
                    aria-expanded={expandedId === n.id}
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

"use client"
import { useState, useEffect } from "react"
import { Loader2, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Highlight } from "./Highlight"
import { ago } from "@/lib/date-utils"
import { RESOURCE_TYPE_LABELS, type Resource } from "@/types/board"

export function SearchableResourceList({ query }: { query: string }) {
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
      )}
    </div>
  )
}

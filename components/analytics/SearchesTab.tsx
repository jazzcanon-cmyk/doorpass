"use client"
import { Card, CardContent } from "@/components/ui/card"
import type { PopularSearch } from "@/types/analytics"

export function SearchesTab({ searches }: { searches: PopularSearch[] }) {
  if (searches.length === 0) {
    return <p className="text-center py-8 text-muted-foreground text-sm">검색 데이터 없음</p>
  }
  const max = searches[0]?.search_count ?? 1
  return (
    <div className="space-y-2">
      {searches.map((s, i) => (
        <Card key={s.query}>
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{s.query}</p>
              <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.round((s.search_count / max) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{s.search_count}회</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

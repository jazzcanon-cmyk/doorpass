"use client"
import { Card, CardContent } from "@/components/ui/card"
import type { BuildingRank } from "@/types/analytics"

export function BuildingsTab({ buildings }: { buildings: BuildingRank[] }) {
  if (buildings.length === 0) {
    return <p className="text-center py-8 text-muted-foreground text-sm">건물 조회 데이터 없음</p>
  }
  const max = buildings[0]?.view_count ?? 1
  return (
    <div className="space-y-2">
      {buildings.map((b, i) => (
        <Card key={b.building_id ?? i}>
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{b.building_name || b.building_id || "-"}</p>
              <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.round((b.view_count / max) * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">{b.view_count}회</p>
              {b.unique_users > 0 && (
                <p className="text-[10px] text-muted-foreground/60">{b.unique_users}명</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

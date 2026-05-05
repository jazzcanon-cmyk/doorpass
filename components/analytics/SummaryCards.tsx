"use client"
import { Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL, type TypeCount } from "@/types/analytics"

export function SummaryCards({ activityByType }: { activityByType: TypeCount[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {activityByType.slice(0, 3).map(({ type, count }) => {
        const Icon = ACTIVITY_TYPE_ICON[type] ?? Activity
        return (
          <Card key={type}>
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-base font-bold">{count}</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {ACTIVITY_TYPE_LABEL[type] ?? type}
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

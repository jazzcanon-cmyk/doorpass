"use client"
import { Activity } from "lucide-react"
import { ago } from "@/lib/date-utils"
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL, type RecentActivity } from "@/types/analytics"

function getDetail(a: RecentActivity): string {
  if (a.action_type === "search") return `"${a.metadata?.query ?? ""}"`
  if (a.action_type === "building_view") return String(a.metadata?.buildingName ?? "")
  if (a.action_type === "post_view") return String(a.metadata?.postTitle ?? "")
  if (a.action_type === "button_click") return String(a.metadata?.buttonName ?? "")
  return String(a.metadata?.pagePath ?? "")
}

export function RecentTab({ activities }: { activities: RecentActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-center py-8 text-muted-foreground text-sm">활동 없음</p>
  }
  return (
    <div className="space-y-0">
      {activities.map((a) => {
        const Icon = ACTIVITY_TYPE_ICON[a.action_type] ?? Activity
        const detail = getDetail(a)
        return (
          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground">{ACTIVITY_TYPE_LABEL[a.action_type] ?? a.action_type}</span>
              {detail && <span className="text-xs text-muted-foreground ml-1.5 truncate">{detail}</span>}
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{ago(a.created_at)}</span>
          </div>
        )
      })}
    </div>
  )
}

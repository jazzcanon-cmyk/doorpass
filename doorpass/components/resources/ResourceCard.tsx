"use client"
import { Trash2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ago } from "@/lib/date-utils"
import { RESOURCE_TYPE_CONFIG, type ResourceItem, type ResourceType } from "@/types/resource"

interface ResourceCardProps {
  res: ResourceItem
  expanded: boolean
  canDelete?: boolean
  onToggleExpand: () => void
  onDelete: () => void
}

export function ResourceCard({ res, expanded, canDelete = false, onToggleExpand, onDelete }: ResourceCardProps) {
  const cfg = RESOURCE_TYPE_CONFIG[res.resource_type as ResourceType] ?? RESOURCE_TYPE_CONFIG.link
  const isText = res.resource_type === "text"

  return (
    <Card
      className="hover:border-primary/50 transition-all"
      onClick={() => {
        if (isText) onToggleExpand()
        else if (res.url) window.open(res.url, "_blank")
      }}
      style={{ cursor: isText || res.url ? "pointer" : "default" }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center`}>
            <cfg.Icon className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium flex-shrink-0`}>
                {cfg.label}
              </span>
              <p className="font-medium text-sm text-foreground truncate">{res.title}</p>
              {!isText && res.url && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              {isText && (
                expanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            {isText ? (
              expanded && res.description && (
                <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{res.description}</p>
              )
            ) : (
              res.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{res.description}</p>
              )
            )}
            {res.resource_type === "image" && res.url && (
              <img
                src={res.url}
                alt={res.title}
                className="mt-2 w-full rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="text-xs text-muted-foreground mt-1">{res.author} · {ago(res.created_at)}</div>
          </div>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

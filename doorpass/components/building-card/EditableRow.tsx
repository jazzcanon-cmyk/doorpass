"use client"

import { useState } from "react"
import { Pencil, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface EditableRowProps {
  label: string
  value: string
  onSave: (val: string) => Promise<void>
  saving: boolean
  canEdit: boolean
}

export function EditableRow({ label, value, onSave, saving, canEdit }: EditableRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return }
    await onSave(draft)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 text-sm bg-secondary border-primary/50 flex-1"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
          />
          <Button variant="default" size="icon" onClick={handleSave} disabled={saving}
            className="h-9 w-9 flex-shrink-0 bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => { setEditing(false); setDraft(value) }}
            className="h-9 w-9 flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className={`text-sm flex-1 ${label === "비밀번호" ? "font-mono font-bold text-yellow-400" : "text-foreground"}`}>
            {value || <span className="text-muted-foreground italic">미입력</span>}
          </span>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => { setEditing(true); setDraft(value) }}
              className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

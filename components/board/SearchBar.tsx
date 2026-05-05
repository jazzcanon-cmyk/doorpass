"use client"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  onClear: () => void
}

export function SearchBar({ searchQuery, onSearchChange, onClear }: SearchBarProps) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="제목, 내용으로 검색..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9 pr-9 bg-secondary border-0 h-9 text-sm"
      />
      {searchQuery && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="검색어 초기화"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

"use client"
import { useState } from "react"
import { X, Lock } from "lucide-react"
import { calendarInputStyle } from "@/lib/calendar-utils"
import type { Memo } from "@/types/calendar"

interface SearchModalProps {
  memos: Memo[]
  kakaoId?: string
  onClose: () => void
}

export function SearchModal({ memos, kakaoId, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Memo[]>([])

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    setSearchResults(
      memos.filter(m =>
        m.content.includes(searchQuery) &&
        (!m.is_private || m.kakao_id === kakaoId)
      )
    )
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: "white", borderRadius: 20, padding: 18, width: "90%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>🔍 메모 검색</h3>
          <button onClick={onClose}
            style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: 7, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            placeholder="내용 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            style={{ ...calendarInputStyle, flex: 1, border: "1px solid #e2e8f0" }}
          />
          <button onClick={handleSearch}
            style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            검색
          </button>
        </div>

        {searchResults.length === 0 && searchQuery && (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 14 }}>검색 결과가 없어요</p>
        )}
        {searchResults.map(m => (
          <div key={m.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "11px 14px", marginBottom: 9, borderLeft: `4px solid ${m.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              {m.is_private && <Lock size={11} color="#94a3b8" />}
              <span style={{ fontSize: 11, color: "#94a3b8" }}>📅 {m.date} · {m.author}</span>
            </div>
            <p style={{ fontSize: 13, color: "#1e293b", margin: 0 }}>{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

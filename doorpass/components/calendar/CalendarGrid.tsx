"use client"
import { useState, useEffect } from "react"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { DAYS, MONTHS, formatCalendarDate } from "@/lib/calendar-utils"
import type { Memo } from "@/types/calendar"

interface CalendarGridProps {
  currentYear: number
  currentMonth: number
  memos: Memo[]
  kakaoId?: string
  onPrevMonth: () => void
  onNextMonth: () => void
  onSearchOpen: () => void
  onDateClick: (day: number) => void
}

export function CalendarGrid({
  currentYear,
  currentMonth,
  memos,
  kakaoId,
  onPrevMonth,
  onNextMonth,
  onSearchOpen,
  onDateClick,
}: CalendarGridProps) {
  const [todayStr, setTodayStr] = useState("")
  useEffect(() => {
    const t = new Date()
    setTodayStr(formatCalendarDate(t.getFullYear(), t.getMonth(), t.getDate()))
  }, [])
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  const getDateMemos = (dateStr: string) =>
    memos.filter(m => m.date === dateStr && (!m.is_private || m.kakao_id === kakaoId))

  return (
    <>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2744)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onPrevMonth}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "5px 9px", color: "white", cursor: "pointer" }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
            {currentYear}년 {MONTHS[currentMonth]}
          </span>
          <button onClick={onNextMonth}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "5px 9px", color: "white", cursor: "pointer" }}>
            <ChevronRight size={15} />
          </button>
        </div>
        <button onClick={onSearchOpen}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
          <Search size={14} /> 검색
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#f8fafc" }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: "center", padding: "6px 0", fontSize: 11, fontWeight: 700, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#64748b" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "3px" }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = formatCalendarDate(currentYear, currentMonth, day)
          const dayMemos = getDateMemos(dateStr)
          const isToday = dateStr === todayStr
          const isSun = (firstDay + i) % 7 === 0
          const isSat = (firstDay + i) % 7 === 6
          return (
            <div key={day} onClick={() => onDateClick(day)}
              style={{ minHeight: 60, padding: "4px 5px", cursor: "pointer", borderRadius: 7, margin: 2, background: isToday ? "#eff6ff" : "transparent", border: isToday ? "2px solid #3b82f6" : "1px solid transparent", transition: "background 0.15s" }}>
              <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#3b82f6" : isSun ? "#ef4444" : isSat ? "#3b82f6" : "#1e293b", marginBottom: 2 }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayMemos.slice(0, 2).map(m => (
                  <div key={m.id} style={{ background: m.color, color: "white", fontSize: 10, padding: "1px 4px", borderRadius: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 2 }}>
                    {m.is_private && "🔒"}{m.content.slice(0, 8)}
                  </div>
                ))}
                {dayMemos.length > 2 && <div style={{ fontSize: 10, color: "#94a3b8" }}>+{dayMemos.length - 2}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

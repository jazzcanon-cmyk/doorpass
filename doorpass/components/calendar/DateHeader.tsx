"use client"
import { DAYS, getLunarDate } from "@/lib/calendar-utils"

export function DateHeader({ onCalendarOpen }: { onCalendarOpen: () => void }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const dayName = DAYS[today.getDay()]
  const lunar = getLunarDate(today)
  const isSun = today.getDay() === 0
  const isSat = today.getDay() === 6

  return (
    <button
      onClick={onCalendarOpen}
      style={{
        width: "100%",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "8px 14px",
        marginBottom: 10,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>📅</span>
        <span style={{ color: "white", fontSize: 14, fontWeight: 600 }}>
          {year}.{String(month).padStart(2, "0")}.{String(day).padStart(2, "0")}
        </span>
        <span style={{ color: isSun ? "#ff6b6b" : isSat ? "#74b9ff" : "#94a3b8", fontSize: 13 }}>
          {dayName}
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{lunar}</span>
      </div>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>달력 ›</span>
    </button>
  )
}

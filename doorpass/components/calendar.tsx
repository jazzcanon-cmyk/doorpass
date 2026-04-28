"use client"
import { useState } from "react"
import { X } from "lucide-react"
import { useCalendarMemos } from "@/hooks/useCalendarMemos"
import { formatCalendarDate } from "@/lib/calendar-utils"
import { DateHeader } from "@/components/calendar/DateHeader"
import { CalendarGrid } from "@/components/calendar/CalendarGrid"
import { MemoModal } from "@/components/calendar/MemoModal"
import { SearchModal } from "@/components/calendar/SearchModal"
import type { CalendarProps } from "@/types/calendar"

export { DateHeader }

export function Calendar({ kakaoId, userName = "익명" }: CalendarProps) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  const { memos, fetchError, fetchMemos, deleteMemo } = useCalendarMemos()

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  const handleDateClick = (day: number) => {
    setSelectedDate(formatCalendarDate(currentYear, currentMonth, day))
    setShowMemoModal(true)
  }

  return (
    <>
      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
        {fetchError && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 16px", fontSize: 13 }}>
            ⚠️ {fetchError}
          </div>
        )}
        <CalendarGrid
          currentYear={currentYear}
          currentMonth={currentMonth}
          memos={memos}
          kakaoId={kakaoId}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onSearchOpen={() => setShowSearchModal(true)}
          onDateClick={handleDateClick}
        />
      </div>

      {showMemoModal && selectedDate && (
        <MemoModal
          selectedDate={selectedDate}
          memos={memos}
          kakaoId={kakaoId}
          userName={userName}
          onClose={() => setShowMemoModal(false)}
          onRefresh={fetchMemos}
          onDelete={deleteMemo}
        />
      )}

      {showSearchModal && (
        <SearchModal
          memos={memos}
          kakaoId={kakaoId}
          onClose={() => setShowSearchModal(false)}
        />
      )}
    </>
  )
}

export function CalendarModal({ kakaoId, userName }: CalendarProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <DateHeader onCalendarOpen={() => setOpen(true)} />
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", overflowY: "auto", padding: "20px 0" }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button onClick={() => setOpen(false)}
                style={{ background: "white", border: "none", borderRadius: 9, padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5, color: "#1e293b" }}>
                <X size={14} /> 닫기
              </button>
            </div>
            <Calendar kakaoId={kakaoId} userName={userName} />
          </div>
        </div>
      )}
    </>
  )
}

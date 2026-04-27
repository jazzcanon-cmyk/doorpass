"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { X, Search, Edit2, Trash2, Lock, Globe, ChevronLeft, ChevronRight } from "lucide-react"
import KoreanLunarCalendar from "korean-lunar-calendar"

function getLunarDate(date: Date): string {
  try {
    const calendar = new KoreanLunarCalendar()
    calendar.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    const lunar = calendar.getLunarCalendar()
    return `음력 ${lunar.month}/${lunar.day}`
  } catch {
    return ""
  }
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"]

interface Memo {
  id: number
  date: string
  content: string
  is_private: boolean
  kakao_id: string | null
  author: string
  color: string
}

interface CalendarProps {
  kakaoId?: string
  userName?: string
}

// ── 날짜 헤더 (심플 버전) ─────────────────────────────
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

// ── 메인 캘린더 컴포넌트 ──────────────────────────────
export function Calendar({ kakaoId, userName = "익명" }: CalendarProps) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [memos, setMemos] = useState<Memo[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Memo[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 메모 폼 (제목 없음 — content만 사용)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [memoPrivate, setMemoPrivate] = useState(false)
  const [memoColor, setMemoColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchMemos = useCallback(async () => {
    setFetchError(null)
    try {
      const res = await fetch("/api/calendar")
      const data = await res.json()
      if (!res.ok) { setFetchError(data.error ?? "메모를 불러오지 못했습니다."); return }
      setMemos(data.memos ?? [])
    } catch {
      setFetchError("네트워크 오류로 메모를 불러오지 못했습니다.")
    }
  }, [])

  useEffect(() => { fetchMemos() }, [fetchMemos])

  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const formatDate = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  const getDateMemos = (dateStr: string) =>
    memos.filter(m => m.date === dateStr && (!m.is_private || m.kakao_id === kakaoId))

  const handleDateClick = (day: number) => {
    setSelectedDate(formatDate(currentYear, currentMonth, day))
    resetForm()
    setShowMemoModal(true)
  }

  const resetForm = () => {
    setEditingMemo(null)
    if (textareaRef.current) textareaRef.current.value = ""
    setMemoPrivate(false)
    setMemoColor(COLORS[0])
    setSaveError(null)
  }

  const saveMemo = async () => {
    const content = textareaRef.current?.value ?? ""
    if (!content.trim()) {
      setSaveError("내용을 입력해주세요.")
      return
    }
    setSaving(true)
    setSaveError(null)

    try {
      const payload = editingMemo
        ? { action: "update", id: editingMemo.id, content, is_private: memoPrivate, color: memoColor }
        : { action: "insert", date: selectedDate, content, is_private: memoPrivate, kakao_id: memoPrivate ? (kakaoId ?? null) : null, author: userName, color: memoColor }

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? "저장에 실패했습니다."); return }

      await fetchMemos()
      resetForm()
    } catch {
      setSaveError("네트워크 오류로 저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const deleteMemo = async (id: number) => {
    if (!confirm("삭제하시겠어요?")) return
    try {
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      await fetchMemos()
    } catch {
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const startEdit = (memo: Memo) => {
    setEditingMemo(memo)
    setTimeout(() => { if (textareaRef.current) textareaRef.current.value = memo.content }, 0)
    setMemoPrivate(memo.is_private)
    setMemoColor(memo.color)
    setSaveError(null)
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    setSearchResults(
      memos.filter(m =>
        m.content.includes(searchQuery) &&
        (!m.is_private || m.kakao_id === kakaoId)
      )
    )
  }

  // 공통 입력 스타일 (다크모드에서도 텍스트 보이도록 색상 명시)
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#1e293b",
    WebkitTextFillColor: "#1e293b",
    caretColor: "#1e293b",
  }

  return (
    <>
      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>

        {fetchError && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 16px", fontSize: 13 }}>
            ⚠️ {fetchError}
          </div>
        )}

        {/* 달력 헤더 */}
        <div style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2744)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else setCurrentMonth(m => m - 1) }}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "5px 9px", color: "white", cursor: "pointer" }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
              {currentYear}년 {MONTHS[currentMonth]}
            </span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else setCurrentMonth(m => m + 1) }}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "5px 9px", color: "white", cursor: "pointer" }}>
              <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={() => { setShowSearchModal(true); setSearchQuery(""); setSearchResults([]) }}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <Search size={14} /> 검색
          </button>
        </div>

        {/* 요일 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#f8fafc" }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{ textAlign: "center", padding: "6px 0", fontSize: 11, fontWeight: 700, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#64748b" }}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "3px" }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDate(currentYear, currentMonth, day)
            const dayMemos = getDateMemos(dateStr)
            const isToday = dateStr === todayStr
            const isSun = (firstDay + i) % 7 === 0
            const isSat = (firstDay + i) % 7 === 6
            return (
              <div key={day} onClick={() => handleDateClick(day)}
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
      </div>

      {/* 메모 모달 */}
      {showMemoModal && selectedDate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowMemoModal(false); resetForm() } }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "20px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                📅 {selectedDate.replace(/-/g, ".")}
              </h3>
              <button onClick={() => { setShowMemoModal(false); resetForm() }}
                style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: 7, cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            {/* 기존 메모 목록 */}
            {getDateMemos(selectedDate).length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 7 }}>등록된 메모</p>
                {getDateMemos(selectedDate).map(m => (
                  <div key={m.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 7, borderLeft: `4px solid ${m.color}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                          {m.is_private && <Lock size={11} color="#94a3b8" />}
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.author}</span>
                        </div>
                        <p style={{ fontSize: 14, color: "#1e293b", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</p>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button onClick={() => startEdit(m)}
                          style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "#3b82f6" }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteMemo(m.id)}
                          style={{ background: "#fef2f2", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "#ef4444" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 메모 작성/수정 폼 */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                {editingMemo ? "✏️ 수정" : "➕ 새 메모"}
              </p>

              {saveError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 10px", marginBottom: 10, color: "#b91c1c", fontSize: 13 }}>
                  ⚠️ {saveError}
                </div>
              )}

              {/* 색상 선택 */}
              <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setMemoColor(c)}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: memoColor === c ? "3px solid #1e293b" : "3px solid transparent", cursor: "pointer", flexShrink: 0 }} />
                ))}
              </div>

              {/* 본문 (제목 없음) */}
              <textarea
                ref={textareaRef}
                placeholder="메모 내용을 입력하세요"
                defaultValue=""
                onChange={() => setSaveError(null)}
                rows={4}
                autoFocus
                style={{ ...inputStyle, border: saveError ? "1px solid #ef4444" : "1px solid #e2e8f0", marginBottom: 10, resize: "none", lineHeight: 1.6 }}
              />

              {/* 개인/공개 토글 */}
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setMemoPrivate(!memoPrivate)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: memoPrivate ? "#eff6ff" : "#f1f5f9", border: "none", borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: memoPrivate ? "#3b82f6" : "#64748b", fontWeight: 600, fontSize: 13 }}>
                  {memoPrivate ? <Lock size={13} /> : <Globe size={13} />}
                  {memoPrivate ? "개인 메모" : "공개 메모"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {editingMemo && (
                  <button onClick={resetForm}
                    style={{ flex: 1, background: "#f1f5f9", color: "#64748b", fontWeight: 600, fontSize: 14, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer" }}>
                    취소
                  </button>
                )}
                <button onClick={saveMemo} disabled={saving}
                  style={{ flex: 2, background: saving ? "#94a3b8" : memoColor, color: "white", fontWeight: 700, fontSize: 14, padding: "10px 0", borderRadius: 8, border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "저장 중..." : editingMemo ? "수정 완료" : "메모 저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검색 모달 */}
      {showSearchModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60 }}
          onClick={e => { if (e.target === e.currentTarget) setShowSearchModal(false) }}>
          <div style={{ background: "white", borderRadius: 20, padding: 18, width: "90%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>🔍 메모 검색</h3>
              <button onClick={() => setShowSearchModal(false)}
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
                style={{ ...inputStyle, flex: 1, border: "1px solid #e2e8f0" }}
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
      )}
    </>
  )
}

// ── 캘린더 전체 래퍼 (모달형) ─────────────────────────
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

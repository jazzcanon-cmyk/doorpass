import KoreanLunarCalendar from "korean-lunar-calendar"

export const DAYS = ["일", "월", "화", "수", "목", "금", "토"]
export const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]
export const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"]

export function getLunarDate(date: Date): string {
  try {
    const calendar = new KoreanLunarCalendar()
    calendar.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    const lunar = calendar.getLunarCalendar()
    return `음력 ${lunar.month}/${lunar.day}`
  } catch {
    return ""
  }
}

export function formatCalendarDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export const calendarInputStyle: React.CSSProperties = {
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

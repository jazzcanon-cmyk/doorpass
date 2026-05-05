export function formatHour(iso: string) {
  const d = new Date(iso + ":00:00Z")
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
}

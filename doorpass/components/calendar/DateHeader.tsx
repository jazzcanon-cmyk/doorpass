"use client"
import { useState, useEffect } from "react"
import { ExternalLink } from "lucide-react"
import { DAYS, getLunarDate } from "@/lib/calendar-utils"

interface WeatherInfo {
  temp: number
  desc: string
  icon: string
}

function getWeatherInfo(code: number): { desc: string; icon: string } {
  if (code === 0) return { desc: '맑음', icon: '☀️' }
  if (code <= 3) return { desc: '구름조금', icon: '⛅' }
  if (code <= 48) return { desc: '안개', icon: '🌫️' }
  if (code <= 67) return { desc: '비', icon: '🌧️' }
  if (code <= 77) return { desc: '눈', icon: '❄️' }
  if (code <= 82) return { desc: '소나기', icon: '🌦️' }
  if (code <= 99) return { desc: '천둥번개', icon: '⛈️' }
  return { desc: '흐림', icon: '☁️' }
}

export function DateHeader({ onCalendarOpen }: { onCalendarOpen: () => void }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const dayName = DAYS[today.getDay()]
  const lunar = getLunarDate(today)
  const isSun = today.getDay() === 0
  const isSat = today.getDay() === 6

  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords
        setCoords({ lat, lon })
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
          '&current=temperature_2m,weathercode,windspeed_10m&timezone=Asia%2FSeoul'
        )
        const data = await res.json() as {
          current: { temperature_2m: number; weathercode: number; windspeed_10m: number }
        }
        const code = data.current.weathercode
        const temp = Math.round(data.current.temperature_2m)
        const wind = Math.round(data.current.windspeed_10m)
        const info = getWeatherInfo(code)
        setWeather({ temp, desc: info.desc + ' 💨 ' + wind + 'm/s', icon: info.icon })
      } catch {
        // 날씨 로딩 실패 시 무시
      }
    }, () => {})
  }, [])

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
        flexDirection: "column",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
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
      </div>

      {weather && (
        <div
          onClick={async (e) => {
            e.stopPropagation()
            let query = '날씨'
            if (coords) {
              try {
                const r = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json&accept-language=ko`
                )
                const d = await r.json() as { address: Record<string, string> }
                const area = d.address.city || d.address.county || d.address.town
                if (area) query = area + ' 날씨'
              } catch {
                // 역지오코딩 실패 시 기본 쿼리 유지
              }
            }
            window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, '_blank')
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14 }}>{weather.icon}</span>
          <span style={{ color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>{weather.temp}°C</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{weather.desc}</span>
          <ExternalLink style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        </div>
      )}
    </button>
  )
}

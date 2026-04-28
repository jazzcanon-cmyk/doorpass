"use client"
import { useState, useCallback } from "react"

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getLocation = useCallback(
    (onPosition?: (lat: number, lng: number) => Promise<void> | void, onFallback?: () => Promise<void> | void) => {
      setLoading(true)
      setError(null)
      if (!navigator.geolocation) {
        setError("위치 서비스를 지원하지 않는 브라우저입니다.")
        setLoading(false)
        return
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ lat: latitude, lng: longitude })
          if (onPosition) await onPosition(latitude, longitude)
          setLoading(false)
        },
        (geoErr: GeolocationPositionError) => {
          console.warn("[geolocation]", geoErr.code, geoErr.message)
          const code = geoErr?.code
          const msg =
            code === 1
              ? "위치 권한이 거부되었습니다. 주소창의 자물쇠 아이콘에서 이 사이트의 위치를 허용한 뒤 다시 시도해 주세요."
              : code === 2
                ? "기기에서 위치를 확인할 수 없습니다. (실내·PC에서는 자주 발생합니다) 검색 탭으로 전체 목록을 이용할 수 있습니다."
                : code === 3
                  ? "위치 요청이 시간 초과되었습니다. GPS/Wi‑Fi 위치를 켠 뒤 다시 시도하거나 검색 탭을 이용해 주세요."
                  : "위치를 가져오는데 실패했습니다."
          setError(msg)
          setLoading(false)
          if (onFallback) void onFallback()
        },
        {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 120_000,
        }
      )
    },
    []
  )

  return { location, getLocation, loading, error }
}

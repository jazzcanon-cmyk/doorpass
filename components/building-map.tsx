"use client"

import { useEffect, useRef, useState } from "react"

interface Building {
  id: string
  name: string
  address: string
  password: string
  latitude: number
  longitude: number
  distance?: number
  memo?: string
}

interface BuildingMapProps {
  userLocation: { lat: number; lng: number } | null
  buildings: Building[]
  onBuildingSelect: (building: Building | null) => void
  selectedBuilding: Building | null
}

function makeIcon(L: typeof import("leaflet"), isSelected: boolean) {
  const size = isSelected ? 16 : 12
  const anchor = isSelected ? 8 : 6
  return L.divIcon({
    className: "building-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${isSelected ? '#facc15' : '#22c55e'};
        border: 2px solid ${isSelected ? '#fef08a' : 'white'};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: all 0.2s;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  })
}

export function BuildingMap({
  userLocation,
  buildings,
  onBuildingSelect,
  selectedBuilding
}: BuildingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map())
  const userMarkerRef = useRef<L.Marker | null>(null)
  const onBuildingSelectRef = useRef(onBuildingSelect)
  const selectedBuildingRef = useRef(selectedBuilding)
  const [mapReady, setMapReady] = useState(false)
  const [L, setL] = useState<typeof import("leaflet") | null>(null)

  // refs 최신값 유지 (effect 의존성 없이 항상 최신 값 접근)
  useEffect(() => { onBuildingSelectRef.current = onBuildingSelect }, [onBuildingSelect])
  useEffect(() => { selectedBuildingRef.current = selectedBuilding }, [selectedBuilding])

  // Leaflet 동적 로드
  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setL(leaflet.default as unknown as typeof import("leaflet"))
    })
  }, [])

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !L) return

    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      document.head.appendChild(link)
    }

    const defaultCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [35.54, 129.34]

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 17,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    mapInstanceRef.current = map
    setMapReady(true)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      setMapReady(false)
    }
  }, [L, userLocation])

  // 사용자 위치 마커 업데이트
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation || !L || !mapReady) return

    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
    }

    const userIcon = L.divIcon({
      className: "user-location-marker",
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
        "></div>
        <div style="
          position: absolute;
          top: -2px;
          left: -2px;
          width: 24px;
          height: 24px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

    const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup("현재 위치")

    userMarkerRef.current = marker
    mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 17)
  }, [userLocation, mapReady, L])

  // 건물 마커 생성 — buildings/mapReady/L 변경 시에만 전체 재생성
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !L) return

    markersMapRef.current.forEach((marker) => marker.remove())
    markersMapRef.current.clear()

    buildings.forEach((building) => {
      const isSelected = selectedBuildingRef.current?.id === building.id
      const marker = L.marker([building.latitude, building.longitude], { icon: makeIcon(L, isSelected) })
        .addTo(mapInstanceRef.current!)

      marker.on("click", () => {
        onBuildingSelectRef.current(building)
      })

      markersMapRef.current.set(building.id, marker)
    })
  }, [buildings, mapReady, L])

  // 선택 변경 시 아이콘만 교체 — 마커 전체 재생성 없음
  useEffect(() => {
    if (!mapReady || !L) return

    markersMapRef.current.forEach((marker) => {
      marker.setIcon(makeIcon(L, false))
    })

    if (selectedBuilding) {
      const marker = markersMapRef.current.get(selectedBuilding.id)
      if (marker) marker.setIcon(makeIcon(L, true))
    }
  }, [selectedBuilding, mapReady, L])

  if (!L) {
    return (
      <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
        <div className="text-muted-foreground">지도 로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-border">
      <div ref={mapRef} className="w-full h-full z-0" />
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .leaflet-container {
          background: #1a1a1a;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          background: #262626;
          color: #fafafa;
          border-radius: 8px;
        }
        .leaflet-popup-tip {
          background: #262626;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}

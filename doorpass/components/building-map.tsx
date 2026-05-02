"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface Building {
  id: string
  name: string
  address: string
  password: string
  lat: number
  lng: number
  distance?: number
  memo?: string
}

interface LatLngBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

interface BuildingMapProps {
  userLocation: { lat: number; lng: number } | null
  buildings: Building[]
  onBuildingSelect: (building: Building | null) => void
  selectedBuilding: Building | null
  onBoundsChange?: (bounds: LatLngBounds) => void
  onLocateMe?: () => Promise<boolean>
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
  selectedBuilding,
  onBoundsChange,
  onLocateMe,
}: BuildingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterGroupRef = useRef<any>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const locateButtonRef = useRef<HTMLButtonElement | null>(null)
  const isLocatingRef = useRef(false)
  const onBuildingSelectRef = useRef(onBuildingSelect)
  const selectedBuildingRef = useRef(selectedBuilding)
  const onBoundsChangeRef = useRef(onBoundsChange)
  const onLocateMeRef = useRef(onLocateMe)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [L, setL] = useState<typeof import("leaflet") | null>(null)

  useEffect(() => { onBuildingSelectRef.current = onBuildingSelect }, [onBuildingSelect])
  useEffect(() => { selectedBuildingRef.current = selectedBuilding }, [selectedBuilding])
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange }, [onBoundsChange])
  useEffect(() => { onLocateMeRef.current = onLocateMe }, [onLocateMe])

  // Leaflet + markercluster 동적 로드
  useEffect(() => {
    import("leaflet").then(async (leafletModule) => {
      const leaflet = leafletModule.default as unknown as typeof import("leaflet")
      await import("leaflet.markercluster")
      setL(leaflet)
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
    if (!document.querySelector('link[href*="MarkerCluster"]')) {
      for (const file of ["MarkerCluster.css", "MarkerCluster.Default.css"]) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = `https://unpkg.com/leaflet.markercluster@1.5.3/dist/${file}`
        document.head.appendChild(link)
      }
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      animate: true,
    })
    map.addLayer(clusterGroup)
    clusterGroupRef.current = clusterGroup

    // 뷰포트 변경 → 500ms debounce 후 콜백
    const fireBoundsChange = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        const bounds = map.getBounds()
        onBoundsChangeRef.current?.({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        })
      }, 500)
    }

    map.on("moveend", fireBoundsChange)
    map.on("zoomend", fireBoundsChange)

    // 내 위치 버튼 (Leaflet 커스텀 컨트롤) — 좌측 상단 zoom 컨트롤 아래
    const LocateControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control locate-me-control")
        const button = L.DomUtil.create("button", "locate-me-btn", container) as HTMLButtonElement
        button.type = "button"
        button.setAttribute("aria-label", "내 위치로 이동")
        button.title = "내 위치로 이동"
        button.innerHTML = "<span class=\"locate-me-icon\">📍</span>"
        L.DomEvent.disableClickPropagation(container)
        L.DomEvent.disableScrollPropagation(container)
        L.DomEvent.on(button, "click", async (e) => {
          L.DomEvent.stop(e)
          if (isLocatingRef.current) return
          const handler = onLocateMeRef.current
          if (!handler) return
          isLocatingRef.current = true
          button.classList.add("is-loading")
          button.innerHTML = "<span class=\"locate-me-spinner\"></span>"
          const toastId = toast.loading("위치 확인 중...")
          try {
            const ok = await handler()
            if (ok) toast.success("위치 업데이트됨", { id: toastId })
            else toast.error("위치를 가져올 수 없습니다", { id: toastId })
          } catch {
            toast.error("위치를 가져올 수 없습니다", { id: toastId })
          } finally {
            isLocatingRef.current = false
            button.classList.remove("is-loading")
            button.innerHTML = "<span class=\"locate-me-icon\">📍</span>"
          }
        })
        locateButtonRef.current = button
        return container
      },
      onRemove: () => {
        locateButtonRef.current = null
      },
    })
    new LocateControl({ position: "topleft" }).addTo(map)

    mapInstanceRef.current = map
    setMapReady(true)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      map.remove()
      mapInstanceRef.current = null
      clusterGroupRef.current = null
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

  // 건물 마커 생성 — 클러스터 그룹에 추가
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !L || !clusterGroupRef.current) return

    const cluster = clusterGroupRef.current
    cluster.clearLayers()
    markersMapRef.current.clear()

    buildings.forEach((building) => {
      const isSelected = selectedBuildingRef.current?.id === building.id
      const marker = L.marker([building.lat, building.lng], {
        icon: makeIcon(L, isSelected),
      })
      marker.on("click", () => onBuildingSelectRef.current(building))
      markersMapRef.current.set(building.id, marker)
      cluster.addLayer(marker)
    })
  }, [buildings, mapReady, L])

  // 선택 변경 시 아이콘만 교체
  useEffect(() => {
    if (!mapReady || !L) return

    markersMapRef.current.forEach((marker) => marker.setIcon(makeIcon(L, false)))
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
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
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
        .leaflet-popup-tip { background: #262626; }
        .leaflet-popup-content { margin: 8px 12px; font-size: 14px; }
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background-color: rgba(34, 197, 94, 0.2) !important;
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background-color: rgba(34, 197, 94, 0.7) !important;
          color: white !important;
          font-weight: 600 !important;
        }
        .locate-me-control {
          margin-top: 6px !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .locate-me-btn {
          width: 32px;
          height: 32px;
          background: white;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          font-size: 16px;
          line-height: 1;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          transition: background-color 0.15s ease;
        }
        .locate-me-btn:hover {
          background: #f0f0f0;
        }
        .locate-me-btn:active {
          background: #e4e4e4;
        }
        .locate-me-btn.is-loading {
          cursor: wait;
          background: #f4f4f4;
        }
        .locate-me-icon {
          display: inline-block;
          line-height: 1;
        }
        .locate-me-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #cbd5e1;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: locate-me-spin 0.8s linear infinite;
        }
        @keyframes locate-me-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

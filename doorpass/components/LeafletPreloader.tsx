"use client"

import { useEffect } from "react"

function LeafletPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      import("leaflet")
        .then(async (mod) => {
          await import("leaflet.markercluster")
          const L = mod.default
          // 더미 div로 지도 인스턴스 미리 초기화 (CSS 강제 로드)
          const div = document.createElement("div")
          div.style.cssText =
            "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
          document.body.appendChild(div)
          const map = L.map(div, { center: [35.54, 129.34], zoom: 15 })
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)
          // 1초 후 제거 (CSS만 캐시에 남김)
          setTimeout(() => {
            map.remove()
            document.body.removeChild(div)
          }, 1000)
        })
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return null
}

export default LeafletPreloader

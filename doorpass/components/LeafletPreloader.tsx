"use client"

import { useEffect } from "react"

function LeafletPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      import("leaflet")
        .then(async (mod) => {
          await import("leaflet.markercluster")
          const L = mod.default
          // 더미 div로 지도 CSS 강제 로드 (타일 요청 없이 JS/CSS만 캐시)
          const div = document.createElement("div")
          div.style.cssText =
            "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"
          document.body.appendChild(div)
          const map = L.map(div, { center: [35.54, 129.34], zoom: 15 })
          setTimeout(() => {
            map.remove()
            document.body.removeChild(div)
          }, 500)
        })
        .catch(() => {})
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  return null
}

export default LeafletPreloader

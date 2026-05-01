export function normalizeAddress(address: string): string {
  if (!address) return ""
  return address
    .replace("울산광역시", "울산")
    .replace("부산광역시", "부산")
    .replace("대구광역시", "대구")
    .replace("서울특별시", "서울")
    .replace("인천광역시", "인천")
    .replace("광주광역시", "광주")
    .replace("대전광역시", "대전")
    .replace("세종특별자치시", "세종")
    .replace("제주특별자치도", "제주")
    .replace("강원특별자치도", "강원")
    .replace("전북특별자치도", "전북")
    .replace(/\s+/g, " ")
    .trim()
}

// 광역시/도/구/동을 제외한 도로명 + 번지 부분만 추출
// 예: "울산광역시 남구 남중로94번길 3" → "남중로94번길 3"
export function extractRoadAddress(address: string): string {
  if (!address) return ""
  const normalized = normalizeAddress(address)
  const tokens = normalized.split(" ")
  const roadIdx = tokens.findIndex((t) => /(로|길)\d*(번길)?$/.test(t) || /\d+(번길|로|길)/.test(t))
  if (roadIdx === -1) return normalized
  return tokens.slice(roadIdx).join(" ")
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const rad = Math.PI / 180
  const a1 = lat1 * rad
  const a2 = lat2 * rad
  const da = (lat2 - lat1) * rad
  const db = (lng2 - lng1) * rad
  const a =
    Math.sin(da / 2) * Math.sin(da / 2) +
    Math.cos(a1) * Math.cos(a2) * Math.sin(db / 2) * Math.sin(db / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

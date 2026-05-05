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

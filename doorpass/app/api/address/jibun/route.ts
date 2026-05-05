import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat, lng 파라미터 필요" }, { status: 400 })
  }

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "카카오 키 미설정" }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${apiKey}` } }
    )
    if (!res.ok) {
      return NextResponse.json({ jibun: null })
    }
    const data = await res.json() as {
      documents?: Array<{
        address?: {
          address_name?: string
          region_3depth_name?: string
          main_address_no?: string
          sub_address_no?: string
        }
      }>
    }
    const addr = data.documents?.[0]?.address
    let jibun: string | null = null
    if (addr) {
      const dong = addr.region_3depth_name ?? ""
      const main = addr.main_address_no ?? ""
      const sub = addr.sub_address_no ?? ""
      if (dong && main) {
        jibun = sub ? `${dong} ${main}-${sub}` : `${dong} ${main}`
      } else if (addr.address_name) {
        const tokens = addr.address_name.split(" ")
        jibun = tokens.length > 2 ? tokens.slice(2).join(" ") : addr.address_name
      }
    }
    return NextResponse.json(
      { jibun },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    )
  } catch {
    return NextResponse.json({ jibun: null })
  }
}

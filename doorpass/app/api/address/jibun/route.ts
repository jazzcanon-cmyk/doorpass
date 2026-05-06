import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

// 도로명 주소 텍스트로 카카오 검색 API를 호출해 정확한 지번 주소를 얻는다.
// 좌표 기반(coord2address)은 좌표가 옆 필지로 약간만 어긋나도 다른 번지를 반환하는 문제가 있어
// 도로명 텍스트 기반(search/address)으로 변경.
export async function GET(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")?.trim()

  if (!address) {
    return NextResponse.json({ error: "address 파라미터 필요" }, { status: 400 })
  }

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "카카오 키 미설정" }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}&analyze_type=exact`,
      { headers: { Authorization: `KakaoAK ${apiKey}` } }
    )
    if (!res.ok) {
      return NextResponse.json({ jibun: null })
    }
    const data = (await res.json()) as {
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
        jibun = sub && sub !== "0" ? `${dong} ${main}-${sub}` : `${dong} ${main}`
      } else if (addr.address_name) {
        const tokens = addr.address_name.split(" ")
        jibun = tokens.length > 2 ? tokens.slice(2).join(" ") : addr.address_name
      }
    }
    return NextResponse.json(
      { jibun },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    )
  } catch {
    return NextResponse.json({ jibun: null })
  }
}

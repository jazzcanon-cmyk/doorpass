/**
 * 카카오 로컬 API를 이용한 주소 변환 유틸리티.
 *
 * 사용 시나리오: 사용자가 지번 주소(예: "삼산동 123")로 검색했는데
 * DB에는 도로명 주소만 저장되어 있어 결과가 비었을 때, 카카오 API로
 * 지번 → 도로명 변환을 시도해 fallback 검색에 활용한다.
 *
 * - KAKAO_REST_API_KEY 환경변수가 없으면 변환을 시도하지 않고 null 반환
 * - 네트워크/응답 오류는 모두 swallow → 호출 측은 null 처리만 하면 됨
 * - 무료 한도: 일 30만건
 */

const KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/address.json"
const TIMEOUT_MS = 3000

type KakaoDocument = {
  address_name: string
  address_type: "REGION" | "ROAD" | "REGION_ADDR" | "ROAD_ADDR"
  road_address: { address_name: string } | null
  address: { address_name: string } | null
}

type KakaoResponse = {
  documents: KakaoDocument[]
}

/**
 * 카카오 로컬 API로 지번 주소를 도로명 주소로 변환.
 *
 * @returns 변환된 도로명 주소 문자열 또는 null (실패/키 없음/매칭 없음)
 */
export async function convertJibunToRoadAddress(query: string): Promise<string | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) return null

  const trimmed = query.trim()
  if (!trimmed) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${KAKAO_LOCAL_URL}?query=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) return null

    const data = (await res.json()) as KakaoResponse
    const doc = data.documents?.[0]
    if (!doc) return null

    const roadName = doc.road_address?.address_name?.trim()
    if (roadName) return roadName

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

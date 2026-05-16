/**
 * 카카오 로컬 API를 이용한 주소 변환 유틸리티 (울산 지역 특화).
 *
 * 검색어에서 다음 정보를 추출해 단계별 fallback 검색에 활용한다:
 *   - 도로명 풀버전     (예: "울산 남구 남중로94번길 3")
 *   - 도로명 코어         (예: "남중로94번길 3")
 *   - 도로명 이름만      (예: "남중로94번길")
 *   - 동 이름             (예: "삼산동")  — API 실패해도 추출됨
 *
 * 동작 규칙:
 *   - 검색어에 "울산"이 없으면 "울산 " 접두사를 자동 추가하여 카카오 API 호출
 *   - analyze_type=similar 파라미터로 유사 검색 활성화
 *   - documents 전체를 순회해 road_address.address_name이 있는 첫 항목 채택
 *   - KAKAO_REST_API_KEY 미설정/네트워크 오류 시에도 동 이름은 항상 추출 시도
 */

const KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/address.json"
const TIMEOUT_MS = 3000
const ULSAN_PREFIX = "울산"

type KakaoDocument = {
  address_name?: string
  address_type?: string
  road_address?: { address_name?: string } | null
  address?: { address_name?: string } | null
}

type KakaoResponse = {
  documents?: KakaoDocument[]
  meta?: { total_count?: number }
}

export type AddressLookup = {
  /** 카카오에 실제 보낸 쿼리 (울산 prefix 포함될 수 있음) */
  expandedQuery: string
  /** 카카오가 반환한 도로명 풀버전 (예: "울산 남구 남중로94번길 3") */
  roadFull: string | null
  /** 시·구 제외한 도로명 + 번호 (예: "남중로94번길 3") */
  roadCore: string | null
  /** 도로명만 (예: "남중로94번길") */
  roadName: string | null
  /** 검색어에서 추출한 동 이름 (예: "삼산동") */
  dongName: string | null
}

function ensureUlsanPrefix(q: string): string {
  if (q.includes(ULSAN_PREFIX)) return q
  return `${ULSAN_PREFIX} ${q}`
}

/** 검색어에서 "...동" 패턴 추출. */
function extractDong(q: string): string | null {
  const m = q.match(/[가-힣]+동(?=\s|$|[^가-힣])/)
  return m ? m[0] : null
}

/**
 * 도로명 풀버전에서 시·구를 떼고 도로명+번호 부분만 추출.
 * "울산 남구 남중로94번길 3"  → core="남중로94번길 3", name="남중로94번길"
 * "남중로94번길 3"             → core="남중로94번길 3", name="남중로94번길"
 */
function extractRoadParts(full: string): { core: string | null; name: string | null } {
  const tokens = full.trim().split(/\s+/)
  if (tokens.length === 0) return { core: null, name: null }

  // 도로명 토큰 식별 — "...로", "...길", "...대로", "...로N번길" 등
  const roadTokenRe = /^[가-힣\d]+(?:로|길|대로)(?:\d+번길)?$/
  let roadIdx = -1
  for (let i = 0; i < tokens.length; i++) {
    if (roadTokenRe.test(tokens[i])) {
      roadIdx = i
      break
    }
  }

  if (roadIdx === -1) {
    return { core: full, name: null }
  }

  const name = tokens[roadIdx]
  const core = tokens.slice(roadIdx).join(" ")
  return { core, name }
}

/**
 * 카카오 로컬 API + 패턴 추출로 검색어를 다양한 형태로 풀어냄.
 * 호출 측은 우선순위대로 후보를 사용해 DB ilike 검색을 시도하면 됨.
 */
export async function lookupAddress(query: string): Promise<AddressLookup> {
  const trimmed = query.trim()
  const expandedQuery = ensureUlsanPrefix(trimmed)
  const dongName = extractDong(trimmed)

  const empty: AddressLookup = {
    expandedQuery,
    roadFull: null,
    roadCore: null,
    roadName: null,
    dongName,
  }

  if (!trimmed) return empty

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    console.warn("[address-convert] KAKAO_REST_API_KEY 미설정 — API 변환 스킵 (동 이름 fallback만 사용)")
    return empty
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${KAKAO_LOCAL_URL}?query=${encodeURIComponent(expandedQuery)}&analyze_type=similar`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(`[address-convert] 카카오 HTTP ${res.status}: ${await res.text().catch(() => "")}`)
      return empty
    }

    const data = (await res.json()) as KakaoResponse
    const docs = data.documents ?? []

    let roadFull: string | null = null
    for (const doc of docs) {
      const rn = doc.road_address?.address_name?.trim()
      if (rn) {
        roadFull = rn
        break
      }
    }

    if (!roadFull) {
      return empty
    }

    const { core, name } = extractRoadParts(roadFull)
    return {
      expandedQuery,
      roadFull,
      roadCore: core,
      roadName: name,
      dongName,
    }
  } catch (err) {
    console.warn("[address-convert] 호출 실패", err)
    return empty
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @deprecated `lookupAddress`로 마이그레이션 권장. 단일 도로명 풀버전만 반환.
 */
export async function convertJibunToRoadAddress(query: string): Promise<string | null> {
  const r = await lookupAddress(query)
  return r.roadFull
}

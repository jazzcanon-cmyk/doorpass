import { NextRequest, NextResponse } from "next/server"

// 국세청 사업자 상태 조회 API 응답 단건
interface NtsBusinessItem {
  b_no: string
  b_stt: string       // 사업자 상태 텍스트 (계속사업자 / 휴업자 / 폐업자)
  b_stt_cd: string    // "01" 계속 / "02" 휴업 / "03" 폐업
  tax_type: string    // 과세유형 텍스트
  tax_type_cd: string // "01" 일반 / "02" 간이 / "03" 면세
  end_dt: string      // 폐업일 (폐업자만)
}

interface NtsResponse {
  status_code: string
  data: NtsBusinessItem[]
}

export interface CheckedBusiness {
  b_no: string
  tax_type: string        // 일반과세자 / 간이과세자 / 면세사업자 / 확인필요
  is_deductible: boolean | null
  is_active: boolean
  status: string          // 계속사업자 / 휴업자 / 폐업자 / 확인필요
}

// 사업자등록번호 배열을 받아 국세청 상태를 조회하는 API
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { b_no: string[] }

    if (!body.b_no || body.b_no.length === 0) {
      return NextResponse.json({ error: "b_no 배열이 필요합니다" }, { status: 400 })
    }
    if (body.b_no.length > 100) {
      return NextResponse.json({ error: "최대 100개까지 조회 가능합니다" }, { status: 400 })
    }

    const serviceKey = process.env.NTS_API_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: "NTS_API_KEY 미설정" }, { status: 500 })
    }

    // 번호에서 하이픈 제거 (000-00-00000 → 0000000000)
    const normalized = body.b_no.map((n) => n.replace(/-/g, ""))

    const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(serviceKey)}`
    const ntsRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ b_no: normalized }),
    })

    if (!ntsRes.ok) {
      const text = await ntsRes.text()
      console.error("국세청 API 오류:", ntsRes.status, text)
      return NextResponse.json({ error: "국세청 API 호출 실패" }, { status: 502 })
    }

    const ntsJson = (await ntsRes.json()) as NtsResponse

    // 결과 파싱 — tax_type_cd / b_stt_cd 기준으로 공제 가능 여부 결정
    const results: CheckedBusiness[] = (ntsJson.data ?? []).map((item) => {
      const isActive = item.b_stt_cd === "01"          // 계속사업자만 활성
      const isGeneral = item.tax_type_cd === "01"       // 일반과세자만 공제 가능

      let taxType = "확인필요"
      if (item.tax_type_cd === "01") taxType = "일반과세자"
      else if (item.tax_type_cd === "02") taxType = "간이과세자"
      else if (item.tax_type_cd === "03") taxType = "면세사업자"

      let status = "확인필요"
      if (item.b_stt_cd === "01") status = "계속사업자"
      else if (item.b_stt_cd === "02") status = "휴업자"
      else if (item.b_stt_cd === "03") status = "폐업자"

      // 공제 가능: 일반과세자 + 계속사업자일 때만 true
      // 휴업/폐업이면 불가, 간이/면세이면 불가
      const isDeductible =
        item.tax_type_cd === "" ? null      // 조회 불가
        : isGeneral && isActive ? true
        : false

      return {
        b_no: item.b_no,
        tax_type: taxType,
        is_deductible: isDeductible,
        is_active: isActive,
        status,
      }
    })

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    console.error("사업자 조회 오류:", err)
    return NextResponse.json({ error: "사업자 조회 중 오류 발생" }, { status: 500 })
  }
}

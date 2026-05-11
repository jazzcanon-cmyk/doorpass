import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 서비스 롤 키로 직접 DB 업데이트 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExpenseOcrResult {
  receipt_date: string
  amount: number
  vendor_name: string
  category: string
  is_deductible: boolean   // 부가세 매입세액 공제 가능 여부
  is_expense: boolean      // 사업 관련 경비처리 가능 여부
  deduction_reason: string // 판단 이유 한 문장
}

interface IncomeOcrResult {
  income_date: string
  delivery_fee: number
  pickup_fee: number
  incentive: number
  vat_amount: number
  total_amount: number
}

interface BusinessOcrResult {
  business_number: string
  business_name: string
  owner_name: string
  open_date: string
  business_type: string
  business_item: string
  tax_type: string
}

// 이미지 URL → base64 변환 (공개 URL 또는 외부 URL용)
async function fetchImageBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("이미지 다운로드 실패")
  const buf = await res.arrayBuffer()
  return {
    base64: Buffer.from(buf).toString("base64"),
    mediaType: res.headers.get("content-type") ?? "image/jpeg",
  }
}

// 비공개 Storage 버킷에서 admin 권한으로 이미지 다운로드
async function downloadFromStorage(storagePath: string): Promise<{ base64: string; mediaType: string }> {
  const { data, error } = await supabaseAdmin.storage.from("receipts").download(storagePath)
  if (error || !data) throw new Error("Storage 이미지 다운로드 실패")
  const buf = await data.arrayBuffer()
  return { base64: Buffer.from(buf).toString("base64"), mediaType: data.type || "image/jpeg" }
}

// 공개 URL에서 receipts 버킷 이하 경로 추출 (구형 데이터 호환용)
function extractReceiptsPath(url: string): string | null {
  const marker = "/object/public/receipts/"
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imageUrl?: string    // 공개 URL 또는 외부 URL (income/business)
      storagePath?: string // 비공개 버킷 경로 (expense)
      expenseId?: string
      incomeId?: string
      businessId?: string
      type?: "expense" | "income" | "business"
    }

    const { imageUrl, storagePath, type = "expense" } = body
    const recordId =
      type === "income"   ? body.incomeId   :
      type === "business" ? body.businessId :
      body.expenseId

    if ((!imageUrl && !storagePath) || !recordId) {
      return NextResponse.json({ error: "imageUrl 또는 storagePath와 id 필수" }, { status: 400 })
    }

    // 1) 이미지 다운로드 → base64 (비공개 버킷은 admin download, 공개 URL은 fetch)
    let base64: string
    let mediaType: string
    if (storagePath) {
      // expense: Storage 경로 직접 전달 (비공개 버킷)
      const r = await downloadFromStorage(storagePath)
      base64 = r.base64; mediaType = r.mediaType
    } else {
      // income/business: URL 전달 — receipts 버킷 URL이면 admin download, 아니면 fetch
      const path = extractReceiptsPath(imageUrl!)
      if (path) {
        const r = await downloadFromStorage(path)
        base64 = r.base64; mediaType = r.mediaType
      } else {
        const r = await fetchImageBase64(imageUrl!)
        base64 = r.base64; mediaType = r.mediaType
      }
    }

    const today = new Date().toISOString().split("T")[0]
    const thisMonth = today.slice(0, 7) + "-01" // YYYY-MM-01

    // 2) 타입별 프롬프트 설정
    const systemPrompt =
      type === "income"   ? "한국 택배 정산명세서 분석 전문가입니다. JSON만 반환하세요."
    : type === "business" ? "한국 사업자등록증 분석 전문가입니다. JSON만 반환하세요."
    : "당신은 한국 영수증 분석 전문가입니다. 영수증 이미지에서 정보를 추출해 JSON만 반환하세요. 다른 말은 하지 마세요."

    const userPrompt =
      type === "income"
        ? `이 정산명세서에서 추출해 JSON으로만 답해:
{
  "income_date": "정산월 (YYYY-MM-DD, 해당월 1일로, 없으면 ${thisMonth})",
  "delivery_fee": 배송수수료 숫자만,
  "pickup_fee": 집하수수료 숫자만 (없으면 0),
  "incentive": 인센티브 숫자만 (없으면 0),
  "vat_amount": 부가세액 숫자만 (없으면 0),
  "total_amount": 합계금액 숫자만
}`
      : type === "business"
        ? `이 사업자등록증에서 추출해 JSON으로만 답해:
{
  "business_number": "사업자등록번호 (000-00-00000 형식)",
  "business_name": "상호명",
  "owner_name": "대표자명",
  "open_date": "개업일 (YYYY-MM-DD)",
  "business_type": "업태",
  "business_item": "종목",
  "tax_type": "과세유형 (문서에 간이과세자 명시되면 간이과세자, 아니면 일반과세자)"
}`
      : `이 영수증에서 다음을 추출해 JSON으로만 답해:
{
  "receipt_date": "날짜 (YYYY-MM-DD, 없으면 ${today})",
  "amount": 합계금액 숫자만 (원 단위),
  "vendor_name": "업체명",
  "category": "유류비|수리비|식비|통신비|기타 중 하나",
  "is_deductible": 부가세 매입세액 공제 가능하면 true (세금계산서/카드매출전표 발행 사업자의 사업용 지출만 true),
  "is_expense": 사업 관련 경비처리 가능하면 true (사업과 관련된 지출이면 대부분 true),
  "deduction_reason": "판단이유 한 문장 (예: 사업용 차량 유류비로 부가세공제 및 경비처리 가능)"
}`

    // 3) Claude Haiku Vision 호출
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024, // deduction_reason 문장 포함으로 여유 확보
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    })

    // 4) 응답에서 JSON 추출
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "JSON 파싱 실패", raw: rawText }, { status: 422 })
    }

    // 5) 타입별 테이블 업데이트
    if (type === "business") {
      const parsed = JSON.parse(jsonMatch[0]) as BusinessOcrResult
      const { error } = await supabaseAdmin
        .from("business_info")
        .update({
          business_number: parsed.business_number ?? null,
          business_name:   parsed.business_name   ?? null,
          owner_name:      parsed.owner_name       ?? null,
          open_date:       parsed.open_date        ?? null,
          business_type:   parsed.business_type    ?? null,
          business_item:   parsed.business_item    ?? null,
          tax_type:        parsed.tax_type         ?? "일반과세자",
          is_verified:     true,
        })
        .eq("id", recordId)
      if (error) throw error
      return NextResponse.json({ success: true, data: parsed })
    } else if (type === "income") {
      const parsed = JSON.parse(jsonMatch[0]) as IncomeOcrResult
      const { error } = await supabaseAdmin
        .from("income")
        .update({
          income_date: parsed.income_date ?? thisMonth,
          delivery_fee: typeof parsed.delivery_fee === "number" ? parsed.delivery_fee : 0,
          pickup_fee: typeof parsed.pickup_fee === "number" ? parsed.pickup_fee : 0,
          incentive: typeof parsed.incentive === "number" ? parsed.incentive : 0,
          vat_amount: typeof parsed.vat_amount === "number" ? parsed.vat_amount : 0,
          total_amount: typeof parsed.total_amount === "number" ? parsed.total_amount : 0,
        })
        .eq("id", recordId)
      if (error) throw error
      return NextResponse.json({ success: true, data: parsed })
    } else {
      const parsed = JSON.parse(jsonMatch[0]) as ExpenseOcrResult
      const { error } = await supabaseAdmin
        .from("expenses")
        .update({
          receipt_date:     parsed.receipt_date ?? today,
          amount:           typeof parsed.amount === "number" ? parsed.amount : 0,
          vendor_name:      parsed.vendor_name ?? null,
          category:         parsed.category ?? "기타",
          is_deductible:    parsed.is_deductible === true,
          is_expense:       parsed.is_expense !== false, // 명시적 false만 false로 처리
          deduction_reason: parsed.deduction_reason ?? null,
        })
        .eq("id", recordId)
      if (error) throw error
      return NextResponse.json({ success: true, data: parsed })
    }
  } catch (err) {
    console.error("OCR 오류:", err)
    return NextResponse.json({ error: "OCR 처리 중 오류 발생" }, { status: 500 })
  }
}

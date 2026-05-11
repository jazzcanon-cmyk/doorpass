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
  is_deductible: boolean
}

interface IncomeOcrResult {
  income_date: string
  delivery_fee: number
  pickup_fee: number
  incentive: number
  vat_amount: number
  total_amount: number
}

// 이미지 URL → base64 변환
async function fetchImageBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("이미지 다운로드 실패")
  const buf = await res.arrayBuffer()
  return {
    base64: Buffer.from(buf).toString("base64"),
    mediaType: res.headers.get("content-type") ?? "image/jpeg",
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imageUrl: string
      expenseId?: string
      incomeId?: string
      type?: "expense" | "income"
    }

    const { imageUrl, type = "expense" } = body
    const recordId = type === "income" ? body.incomeId : body.expenseId

    if (!imageUrl || !recordId) {
      return NextResponse.json({ error: "imageUrl과 id 필수" }, { status: 400 })
    }

    // 1) 이미지 다운로드 → base64
    const { base64, mediaType } = await fetchImageBase64(imageUrl)

    const today = new Date().toISOString().split("T")[0]
    const thisMonth = today.slice(0, 7) + "-01" // YYYY-MM-01

    // 2) 타입별 프롬프트 설정
    const systemPrompt =
      type === "income"
        ? "한국 택배 정산명세서 분석 전문가입니다. JSON만 반환하세요."
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
        : `이 영수증에서 다음을 추출해 JSON으로만 답해:
{
  "receipt_date": "날짜 (YYYY-MM-DD, 없으면 ${today})",
  "amount": 합계금액 숫자만 (원 단위),
  "vendor_name": "업체명",
  "category": "유류비|수리비|식비|통신비|기타 중 하나",
  "is_deductible": 사업용 경비면 true 아니면 false
}`

    // 3) Claude Haiku Vision 호출
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
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
    if (type === "income") {
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
          receipt_date: parsed.receipt_date ?? today,
          amount: typeof parsed.amount === "number" ? parsed.amount : 0,
          vendor_name: parsed.vendor_name ?? null,
          category: parsed.category ?? "기타",
          is_deductible: parsed.is_deductible === true,
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

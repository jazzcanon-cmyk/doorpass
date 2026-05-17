import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAuth } from "@/lib/auth"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface SmsOcrResult {
  receipt_date: string
  amount: number
  vendor_name: string
  card_company: string
  approval_number: string | null
  category: string
  is_deductible: boolean
  is_expense: boolean
  deduction_reason: string
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = (await req.json()) as { smsText: string }
    const { smsText } = body

    if (!smsText?.trim()) {
      return NextResponse.json({ error: "smsText 필수" }, { status: 400 })
    }
    if (smsText.length > 10000) {
      return NextResponse.json({ error: "텍스트가 너무 깁니다 (최대 10,000자)" }, { status: 400 })
    }

    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: "한국 카드결제 문자 분석 전문가입니다. JSON만 반환하세요. 다른 말은 하지 마세요.",
      messages: [{
        role: "user",
        content: `다음은 한국 카드결제 문자 내용입니다:

---
${smsText}
---

카드결제 문자를 모두 찾아 추출하세요.
카드결제 문자의 일반적인 형식:
[카드사명] 승인/결제
가맹점명: OOO
금액: OO,OOO원
일시: YYYY.MM.DD HH:MM

반드시 다음 규칙으로 추출하세요:
1. vendor_name: 가맹점명만 추출 (매우 중요)
   - 반드시 실제 가맹점/상호명만 추출
   - 절대 포함하면 안 되는 단어: 카드, 승인, 결제, 취소, 알림, 안내, 원, 번호, 일시, 잔액, 포인트, 적립
   - 카드사명(BC카드/신한카드/우리카드/국민카드/삼성카드/현대카드/롯데카드/하나카드/농협카드) 제외
   - 금액 숫자 제외
   - 상호명을 찾을 수 없으면 '알수없음' 반환
2. amount: 숫자만 (콤마 없이, 원 제외)
3. receipt_date: YYYY-MM-DD 형식 (연도 없으면 ${today.slice(0, 4)} 기준)
4. card_company: 카드사명만
5. approval_number: 승인번호 (없으면 null)
6. category: 아래 기준으로 분류
   - 주유소/충전소/칼텍스/GS/SK에너지 → 유류비
   - 정비/카센터/자동차 → 수리비
   - 식당/카페/맥도날드/편의점 → 식비
   - 통신사/SKT/KT/LG → 통신비
   - 그 외 → 기타
7. is_deductible: 유류비·수리비·통신비면 true
8. is_expense: 업무 관련이면 true
9. deduction_reason: 한국어로 판단 이유 한 문장

카드결제 문자가 여러 개면 배열로:
{"results": [{"vendor_name": "...", "amount": 숫자, "receipt_date": "YYYY-MM-DD", "card_company": "...", "approval_number": null, "category": "...", "is_deductible": true, "is_expense": true, "deduction_reason": "..."}]}

카드결제 문자가 전혀 없으면:
{"error": "카드결제 문자가 없습니다"}`,
      }],
    })

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ results: [] })

    const parsed = JSON.parse(jsonMatch[0]) as { results?: SmsOcrResult[]; error?: string }
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 })
    }

    const validResults = (parsed.results ?? []).filter(
      (r) => r.receipt_date && typeof r.amount === "number" && r.vendor_name
    )
    return NextResponse.json({ results: validResults })
  } catch (err) {
    console.error("SMS 텍스트 분석 오류:", err)
    return NextResponse.json({ error: "분석 중 오류 발생" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Transaction {
  receipt_date: string
  amount: number
  vendor_name: string
  category: string
  is_deductible: boolean
  is_expense: boolean
  deduction_reason: string
}

// 중복 판정 수준: 확실한 중복 / 의심 중복 / 신규
type DuplicateLevel = "확실" | "의심" | "none"

// ─── 스마트 중복 감지 (3단계) ──────────────────────────────────────────────────
// 1단계: 금액 완전 일치 확인 (다르면 즉시 제외)
// 2단계: 날짜 ±3일 범위 확인 (범위 밖이면 제외)
// 3단계: 업체명 유사도 확인 (포함 관계 or 앞 2글자 일치)
function checkDuplicate(
  newTx: Transaction,
  existing: { receipt_date: string; amount: number; vendor_name: string | null }[]
): DuplicateLevel {
  for (const ex of existing) {
    // 1단계: 금액 불일치 → 즉시 다음 항목으로
    if (newTx.amount !== ex.amount) continue

    // 2단계: 날짜 차이 계산 (일 단위)
    const diffDays = Math.abs(
      (new Date(newTx.receipt_date).getTime() - new Date(ex.receipt_date).getTime()) /
        86_400_000
    )
    if (diffDays > 3) continue // ±3일 초과 → 중복 아님

    // 3단계: 업체명 유사도
    const newName  = (newTx.vendor_name ?? "").trim()
    const existName = (ex.vendor_name ?? "").trim()

    // 업체명 둘 다 없으면 날짜+금액만으로 판단
    if (!newName || !existName) {
      return diffDays <= 1 ? "확실" : "의심"
    }

    // 한쪽이 다른 쪽을 포함하거나 앞 2글자 이상 일치 → 유사 업체명
    const nameContained = newName.includes(existName) || existName.includes(newName)
    const prefixMatch   =
      newName.length >= 2 && existName.length >= 2 &&
      newName.slice(0, 2) === existName.slice(0, 2)

    if (nameContained || prefixMatch) {
      // 업체명 유사: ±1일이면 확실한 중복, ±3일이면 의심 중복
      return diffDays <= 1 ? "확실" : "의심"
    }

    // 업체명 다름: ±1일이면 의심, 그 이상이면 다음 기존 항목 확인
    if (diffDays <= 1) return "의심"
  }

  return "none"
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file   = formData.get("file")    as File | null
    const userId = formData.get("user_id") as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: "file, user_id 필수" }, { status: 400 })
    }

    // 1) 파일 버퍼 + base64 변환
    const arrayBuf  = await file.arrayBuffer()
    const buffer    = Buffer.from(arrayBuf)
    const base64    = buffer.toString("base64")
    const mediaType = (file.type || "image/jpeg") as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    // 2) Storage에 명세서 이미지 보관 (영문 경로)
    const timestamp   = Date.now()
    const ext         = file.name.split(".").pop() ?? "jpg"
    const storagePath = `${userId}/statement/statement_${timestamp}.${ext}`
    await supabaseAdmin.storage
      .from("receipts")
      .upload(storagePath, buffer, { contentType: file.type, upsert: true })

    // 3) Claude Vision으로 전체 거래내역 추출
    const message = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system:     "한국 신용카드 명세서 분석 전문가입니다. JSON만 반환하세요. 다른 말은 하지 마세요.",
      messages: [
        {
          role: "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `이 카드명세서의 모든 거래내역을 추출해 JSON으로만 답해:
{
  "transactions": [
    {
      "receipt_date": "날짜 (YYYY-MM-DD)",
      "amount": 금액 숫자만,
      "vendor_name": "업체명",
      "category": "유류비|수리비|식비|통신비|기타 중 하나",
      "is_deductible": 사업용이면 true,
      "is_expense": 경비처리 가능하면 true,
      "deduction_reason": "판단이유 한 문장"
    }
  ]
}`,
            },
          ],
        },
      ],
    })

    // 4) JSON 파싱
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "명세서 분석 실패 — 거래내역을 찾을 수 없습니다." },
        { status: 422 }
      )
    }

    const parsed       = JSON.parse(jsonMatch[0]) as { transactions?: Transaction[] }
    const transactions = parsed.transactions ?? []

    if (transactions.length === 0) {
      return NextResponse.json({ error: "거래내역을 찾을 수 없습니다." }, { status: 422 })
    }

    // 5) 스마트 중복 감지 — 날짜 범위 ±3일 확장 후 기존 expenses 조회
    const allDates = transactions.map((t) => t.receipt_date)
    const minDate  = allDates.reduce((a, b) => (a < b ? a : b))
    const maxDate  = allDates.reduce((a, b) => (a > b ? a : b))

    // ±3일 버퍼를 더해 날짜 범위 계산 (날짜 경계 스캔용)
    const bufferMs        = 3 * 86_400_000
    const minDateExpanded = new Date(new Date(minDate).getTime() - bufferMs)
      .toISOString().split("T")[0]
    const maxDateExpanded = new Date(new Date(maxDate).getTime() + bufferMs)
      .toISOString().split("T")[0]

    const { data: existing } = await supabaseAdmin
      .from("expenses")
      .select("receipt_date, amount, vendor_name")
      .eq("user_id", userId)
      .gte("receipt_date", minDateExpanded)
      .lte("receipt_date", maxDateExpanded)

    // 3단계 판정으로 분류
    const confirmed: Transaction[] = [] // 확실한 중복 (자동 제외)
    const suspected: Transaction[] = [] // 의심 중복 (사용자 확인 필요)
    const newItems:  Transaction[] = [] // 신규 항목

    for (const t of transactions) {
      const level = checkDuplicate(t, existing ?? [])
      if (level === "확실")    confirmed.push(t)
      else if (level === "의심") suspected.push(t)
      else                      newItems.push(t)
    }

    return NextResponse.json({
      total: transactions.length,
      confirmed,  // 확실한 중복 (자동 제외)
      suspected,  // 의심 중복 (사용자 확인 필요)
      newItems,   // 신규 항목
    })
  } catch (err) {
    console.error("카드명세서 분석 오류:", err)
    return NextResponse.json({ error: "카드명세서 분석 중 오류" }, { status: 500 })
  }
}

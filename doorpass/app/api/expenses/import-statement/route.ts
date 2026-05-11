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
      return NextResponse.json({ error: "명세서 분석 실패 — 거래내역을 찾을 수 없습니다." }, { status: 422 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { transactions?: Transaction[] }
    const transactions: Transaction[] = parsed.transactions ?? []

    if (transactions.length === 0) {
      return NextResponse.json({ error: "거래내역을 찾을 수 없습니다." }, { status: 422 })
    }

    // 5) 중복 확인 — 같은 user_id + receipt_date + amount 기준
    const dates = [...new Set(transactions.map((t) => t.receipt_date))]
    const { data: existing } = await supabaseAdmin
      .from("expenses")
      .select("receipt_date, amount")
      .eq("user_id", userId)
      .in("receipt_date", dates)

    const existingSet = new Set(
      (existing ?? []).map((e) => `${e.receipt_date}_${e.amount}`)
    )

    const duplicates: Transaction[] = []
    const newItems:   Transaction[] = []

    for (const t of transactions) {
      if (existingSet.has(`${t.receipt_date}_${t.amount}`)) {
        duplicates.push(t)
      } else {
        newItems.push(t)
      }
    }

    return NextResponse.json({
      total: transactions.length,
      duplicates,
      newItems,
    })
  } catch (err) {
    console.error("카드명세서 분석 오류:", err)
    return NextResponse.json({ error: "카드명세서 분석 중 오류" }, { status: 500 })
  }
}

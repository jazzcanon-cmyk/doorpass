import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExpenseItem {
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
    const body = (await req.json()) as { user_id: string; items: ExpenseItem[] }
    const { user_id, items } = body

    if (!user_id || !items?.length) {
      return NextResponse.json({ error: "user_id, items 필수" }, { status: 400 })
    }

    // 승인된 신규 항목을 expenses에 일괄 INSERT
    const rows = items.map((item) => ({
      user_id:          Number(user_id),
      receipt_date:     item.receipt_date,
      amount:           item.amount,
      vendor_name:      item.vendor_name ?? null,
      category:         item.category   ?? "기타",
      is_deductible:    item.is_deductible === true,
      is_expense:       item.is_expense  !== false,
      deduction_reason: item.deduction_reason ?? null,
      receipt_image_url: null,
      import_source:    "statement",  // 카드명세서 일괄 추가 출처 표시
    }))

    const { error } = await supabaseAdmin.from("expenses").insert(rows)
    if (error) throw error

    return NextResponse.json({ inserted: rows.length })
  } catch (err) {
    console.error("일괄 추가 오류:", err)
    return NextResponse.json({ error: "일괄 추가 중 오류" }, { status: 500 })
  }
}

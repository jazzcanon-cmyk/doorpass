import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth } from "@/lib/auth"

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
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = (await req.json()) as { user_id: string; items: ExpenseItem[]; import_source?: string }
    const { user_id, items, import_source = "statement" } = body

    if (!user_id || !items?.length) {
      return NextResponse.json({ error: "user_id, items 필수" }, { status: 400 })
    }

    // 승인된 신규 항목을 expenses에 일괄 INSERT
    // user_id는 string으로 유지 (Number() 변환 시 UUID나 대형 Kakao ID에서 NaN/정밀도 손실 위험)
    const rows = items.map((item) => ({
      user_id:          user_id,
      receipt_date:     item.receipt_date,
      amount:           Number(item.amount),
      vendor_name:      item.vendor_name ?? null,
      category:         item.category   ?? "기타",
      is_deductible:    item.is_deductible === true,
      is_expense:       item.is_expense  !== false,
      deduction_reason: item.deduction_reason ?? null,
      receipt_image_url: null,
      import_source:    import_source,
    }))

    const { error } = await supabaseAdmin.from("expenses").insert(rows)
    if (error) throw error

    return NextResponse.json({ inserted: rows.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("일괄 추가 오류:", msg)
    return NextResponse.json({ error: msg || "일괄 추가 중 오류" }, { status: 500 })
  }
}

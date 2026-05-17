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
    const body = (await req.json()) as {
      user_id: string
      items: ExpenseItem[]
      import_source?: string
      image_hash?: string
    }
    const { user_id, items, import_source = "statement", image_hash } = body

    if (!user_id || !items?.length) {
      return NextResponse.json({ error: "user_id, items 필수" }, { status: 400 })
    }

    // 중복 체크: N+1 방지 — 해당 날짜 범위의 기존 항목을 1회 조회 후 인메모리 비교
    const dates = [...new Set(items.map((i) => i.receipt_date))]
    const { data: existingRows } = await supabaseAdmin
      .from("expenses")
      .select("receipt_date, amount, vendor_name")
      .eq("user_id", user_id)
      .in("receipt_date", dates)

    const existingSet = new Set(
      (existingRows ?? []).map((e) => `${e.receipt_date}|${e.amount}|${e.vendor_name ?? ""}`)
    )

    const toInsert: ExpenseItem[] = []
    const skipped: string[] = []

    for (const item of items) {
      const key = `${item.receipt_date}|${Number(item.amount)}|${item.vendor_name ?? ""}`
      if (existingSet.has(key)) {
        skipped.push(item.vendor_name ?? "알수없음")
      } else {
        toInsert.push(item)
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        inserted: 0,
        skipped,
        message: `모두 이미 등록된 내역입니다 (${skipped.length}건 건너뜀)`,
      })
    }

    // user_id는 string으로 유지 (Number() 변환 시 UUID나 대형 Kakao ID에서 NaN/정밀도 손실 위험)
    const rows = toInsert.map((item) => ({
      user_id:           user_id,
      receipt_date:      item.receipt_date,
      amount:            Number(item.amount),
      vendor_name:       item.vendor_name ?? null,
      category:          item.category ?? "기타",
      is_deductible:     item.is_deductible === true,
      is_expense:        item.is_expense !== false,
      deduction_reason:  item.deduction_reason ?? null,
      receipt_image_url: null,
      import_source:     import_source,
      image_hash:        image_hash ?? null,
    }))

    const { error } = await supabaseAdmin.from("expenses").insert(rows)
    if (error) {
      console.error("Supabase insert 오류:", JSON.stringify(error))
      return NextResponse.json({
        error:   error.message || error.details || "저장 실패",
        code:    error.code,
        details: error.details,
        hint:    error.hint,
      }, { status: 500 })
    }

    const message = skipped.length > 0
      ? `${toInsert.length}건 추가, ${skipped.length}건 중복 건너뜀`
      : `${toInsert.length}건 추가 완료`

    return NextResponse.json({ inserted: toInsert.length, skipped, message })
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error("일괄 추가 오류:", msg)
    return NextResponse.json({ error: msg || "일괄 추가 중 오류" }, { status: 500 })
  }
}

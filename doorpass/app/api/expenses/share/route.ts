import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateExpensePdf, getRange } from "../_pdf-generator"

// 서비스 롤 키로 Storage 업로드 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")
    const year   = searchParams.get("year")   ?? String(new Date().getFullYear())
    const period = searchParams.get("period") ?? "all"

    if (!userId) {
      return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    }

    // PDF 생성 (_pdf-generator.ts 재사용)
    const { buffer, filename, periodLabel, totalAmount, deductibleAmount } =
      await generateExpensePdf(userId, year, period)

    // receipts 버킷에 임시 업로드 (24시간 공유용)
    const timestamp   = Date.now()
    const storagePath = `${userId}/share/지출내역_${year}_${period}_${timestamp}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true })
    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage
      .from("receipts")
      .getPublicUrl(storagePath)

    return NextResponse.json({
      url: urlData.publicUrl,
      filename,
      periodLabel,
      totalAmount,
      deductibleAmount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "공유 링크 생성 중 오류"
    if (msg === "데이터 없음") {
      return NextResponse.json({ error: "공유할 지출 내역이 없습니다." }, { status: 404 })
    }
    console.error("공유 링크 생성 오류:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

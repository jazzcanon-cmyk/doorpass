import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateExpensePdf } from "../_pdf-generator"

export async function GET(req: NextRequest) {
  // 빌드 시 환경변수 미확정 문제 방지 — 함수 안에서 초기화
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

    // period → 영문 키 변환 (한글 파일명은 Supabase Storage Invalid key 오류 발생)
    const periodKey =
      Number(period) >= 1 && Number(period) <= 12
        ? `month${String(Number(period)).padStart(2, "0")}`
        : period  // all / q1~q4 / h1~h2 는 그대로 사용

    // receipts 버킷에 임시 업로드 (24시간 공유용), 영문/숫자 파일명만 사용
    const timestamp   = Date.now()
    const storagePath = `${userId}/share/expense_report_${year}_${periodKey}_${timestamp}.pdf`

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

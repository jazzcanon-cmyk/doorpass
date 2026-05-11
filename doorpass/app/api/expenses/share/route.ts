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

    const timestamp = Date.now()
    // 공유용 파일 경로 — 영문/숫자/언더스코어만 사용 (shares 버킷은 public)
    const shareId     = `expense_report_${userId}_${year}_${periodKey}_${timestamp}`
    const storagePath = `${shareId}.pdf`

    // 7일 이상 된 같은 사용자의 기존 공유 파일 정리
    const sevenDaysAgo = timestamp - 7 * 24 * 60 * 60 * 1000
    try {
      const { data: existingFiles } = await supabaseAdmin.storage
        .from("shares")
        .list("", { search: `expense_report_${userId}_` })
      if (existingFiles && existingFiles.length > 0) {
        // 파일명 끝의 timestamp 추출: expense_report_{id}_{year}_{period}_{ts}.pdf
        const staleFiles = existingFiles
          .filter((f) => {
            const match = f.name.match(/_(\d+)\.pdf$/)
            return match ? Number(match[1]) < sevenDaysAgo : false
          })
          .map((f) => f.name)
        if (staleFiles.length > 0) {
          await supabaseAdmin.storage.from("shares").remove(staleFiles)
        }
      }
    } catch {
      // 정리 실패는 무시하고 업로드 계속 진행
    }

    // shares 버킷에 업로드 (public 버킷 — 누구나 URL로 접근 가능)
    const { error: uploadError } = await supabaseAdmin.storage
      .from("shares")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false })
    if (uploadError) throw uploadError

    // public 버킷이므로 서명 없이 공개 URL 발급
    const { data: urlData } = supabaseAdmin.storage
      .from("shares")
      .getPublicUrl(storagePath)

    // 만료 예정일 문자열 (7일 후, 한국어 형식)
    const expiresAt = new Date(timestamp + 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })

    return NextResponse.json({
      url:              urlData.publicUrl,
      shareId,          // .pdf 제외 파일명 — 카카오 공유 리다이렉트 경로에 사용
      filename,
      periodLabel,
      totalAmount,
      deductibleAmount,
      expiresAt,        // "2026년 5월 19일" 형태
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

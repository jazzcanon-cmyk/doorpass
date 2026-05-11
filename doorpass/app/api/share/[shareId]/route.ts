import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Next.js 16 App Router: params는 Promise 타입
type Params = Promise<{ shareId: string }>

// 로그인 없이 누구나 접근 가능한 공유 리다이렉트 엔드포인트.
// shareId = shares 버킷 파일명에서 .pdf를 제외한 값
// 예: expense_report_3_2026_h1_1778514115308
export async function GET(_req: Request, { params }: { params: Params }) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { shareId } = await params

  if (!shareId) {
    return NextResponse.json({ error: "shareId 필수" }, { status: 400 })
  }

  // shares 버킷은 public — 파일명에 .pdf 복원 후 공개 URL 생성
  const { data } = supabaseAdmin.storage
    .from("shares")
    .getPublicUrl(`${shareId}.pdf`)

  // 301 영구 리다이렉트 (PDF 공개 URL로 이동)
  return NextResponse.redirect(data.publicUrl, 301)
}

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAuth } from "@/lib/auth"

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    // FormData로 이미지 파일 + 두 가지 ID 수신:
    //   userId       = approved_users.id (소형 정수) → income.user_id 외래키
    //   storagePrefix = 카카오 ID (큰 숫자) → Storage 폴더 이름용
    const formData = await req.formData()
    const file          = formData.get("file")          as File | null
    const userId        = formData.get("userId")        as string | null
    const storagePrefix = formData.get("storagePrefix") as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: "file, userId 필수" }, { status: 400 })
    }

    // Storage 폴더: storagePrefix(카카오 ID)가 있으면 사용, 없으면 userId로 폴백
    const folder = storagePrefix ?? userId
    const ext = file.name.split(".").pop() ?? "jpg"
    const filename = `${folder}/income_${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    // 1) Supabase Storage "receipts" 버킷에 업로드
    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(filename, arrayBuffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage
      .from("receipts")
      .getPublicUrl(filename)

    // 2) income 테이블에 임시 행 추가
    //    user_id는 approved_users.id(소형 정수) 사용 — 카카오 ID 아님
    const thisMonth = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7) + "-01"
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("income")
      .insert({
        user_id: Number(userId),  // int8 컬럼에 맞게 숫자로 변환
        statement_image_url: urlData.publicUrl,  // income 테이블 실제 컬럼명
        income_date: thisMonth,
        delivery_fee: 0,
        pickup_fee: 0,
        incentive: 0,
        vat_amount: 0,
        total_amount: 0,
      })
      .select("id")
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      incomeId: insertData.id as string,
      imageUrl: urlData.publicUrl,
    })
  } catch (err) {
    console.error("수입 업로드 오류:", err)
    return NextResponse.json({ error: "업로드 중 오류 발생" }, { status: 500 })
  }
}

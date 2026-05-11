import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // FormData로 이미지 파일 + userId 수신
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const userId = formData.get("userId") as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: "file, userId 필수" }, { status: 400 })
    }

    // 1) Supabase Storage "receipts" 버킷에 업로드
    const ext = file.name.split(".").pop() ?? "jpg"
    const filename = `${userId}/income_${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(filename, arrayBuffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage
      .from("receipts")
      .getPublicUrl(filename)

    // 2) income 테이블에 임시 행 추가 (OCR가 채우기 전 기본값)
    const thisMonth = new Date().toISOString().slice(0, 7) + "-01"
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("income")
      .insert({
        user_id: userId,
        receipt_image_url: urlData.publicUrl,
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

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// 서비스 롤 키로 RLS 우회
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file   = formData.get("file")   as File | null
    const userId = formData.get("userId") as string | null  // approved_users.id

    if (!file || !userId) {
      return NextResponse.json({ error: "file, userId 필수" }, { status: 400 })
    }

    // Storage 업로드: {userId}/business_{timestamp}.{ext}
    const ext      = file.name.split(".").pop() ?? "jpg"
    const filename = `${userId}/business_${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(filename, arrayBuffer, { contentType: file.type })
    if (uploadError) throw uploadError

    const { data: urlData } = supabaseAdmin.storage
      .from("receipts")
      .getPublicUrl(filename)

    // business_info UPSERT — user_id 기준으로 1개만 유지
    // OCR 실행 전이므로 텍스트 필드는 null, 이미지 URL만 먼저 저장
    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from("business_info")
      .upsert(
        {
          user_id:                Number(userId),
          registration_image_url: urlData.publicUrl,
          business_number:        null,
          business_name:          null,
          owner_name:             null,
          open_date:              null,
          business_type:          null,
          business_item:          null,
          tax_type:               null,
          is_verified:            false,
        },
        { onConflict: "user_id" }  // 같은 user_id면 덮어쓰기
      )
      .select("id")
      .single()

    if (upsertError) throw upsertError

    return NextResponse.json({
      success:    true,
      businessId: upsertData.id as string,
      imageUrl:   urlData.publicUrl,
    })
  } catch (err) {
    console.error("사업자등록증 업로드 오류:", err)
    return NextResponse.json({ error: "업로드 중 오류 발생" }, { status: 500 })
  }
}

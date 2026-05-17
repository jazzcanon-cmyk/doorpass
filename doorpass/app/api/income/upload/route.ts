import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    // FormData로 이미지 파일 + 두 가지 ID 수신:
    //   userId       = approved_users.id (소형 정수) → income.user_id 외래키
    //   storagePrefix = 카카오 ID (큰 숫자) → Storage 폴더 이름용
    //   force        = "1" → 이번 달 중복이 있어도 강제 추가
    const formData = await req.formData()
    const file          = formData.get("file")          as File | null
    const userId        = formData.get("userId")        as string | null
    const storagePrefix = formData.get("storagePrefix") as string | null
    const force         = formData.get("force") === "1"

    if (!file || !userId) {
      return NextResponse.json({ error: "file, userId 필수" }, { status: 400 })
    }

    const nowKst = new Date(Date.now() + 9 * 3600000)
    const thisMonth = nowKst.toISOString().slice(0, 7) + "-01"

    // 이번 달 이미 수입 내역이 있으면 클라이언트에 알려 확인받도록 함 (Storage 업로드 전 체크)
    if (!force) {
      const nextMonthFirst = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth() + 1, 1))
      const nextMonthStr = nextMonthFirst.toISOString().slice(0, 7) + "-01"
      const { count } = await supabaseAdmin
        .from("income")
        .select("id", { count: "exact", head: true })
        .eq("user_id", Number(userId))
        .gte("income_date", thisMonth)
        .lt("income_date", nextMonthStr)
      if ((count ?? 0) > 0) {
        return NextResponse.json({ isDuplicate: true }, { status: 409 })
      }
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
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("income")
      .insert({
        user_id: Number(userId),
        statement_image_url: urlData.publicUrl,
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

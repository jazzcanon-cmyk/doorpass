import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const HIDE_THRESHOLD = 3

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id: buildingId, photoId } = await params

  const { data: photo, error: fetchErr } = await supabaseAdmin
    .from("building_photos")
    .select("id, building_id, report_count, is_active")
    .eq("id", photoId)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!photo) return NextResponse.json({ error: "사진 없음" }, { status: 404 })
  if (String(photo.building_id) !== String(buildingId)) {
    return NextResponse.json({ error: "건물 불일치" }, { status: 400 })
  }

  const newCount = (photo.report_count ?? 0) + 1
  const shouldHide = newCount >= HIDE_THRESHOLD

  const { error: updateErr } = await supabaseAdmin
    .from("building_photos")
    .update({
      report_count: newCount,
      is_active: shouldHide ? false : photo.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    reportCount: newCount,
    hidden: shouldHide,
  })
}

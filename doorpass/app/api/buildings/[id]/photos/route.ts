import { NextRequest, NextResponse } from "next/server"
import { requireAuth, resolveUserEmail, lookupApprovedUser } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { addPoints } from "@/lib/points"

const BUCKET = "building-photos"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const PHOTO_TYPES = ["entrance", "keypad", "parking", "elevator", "other"] as const
type PhotoType = (typeof PHOTO_TYPES)[number]

function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp"
  return null
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params
    const { data, error } = await supabaseAdmin
      .from("building_photos")
      .select("id, building_id, uploader_email, photo_url, photo_type, caption, created_at")
      .eq("building_id", buildingId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ photos: data ?? [] })
  } catch (error) {
    console.error("[buildings/photos:list] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const { id: buildingId } = await params
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const photoTypeRaw = String(formData.get("photo_type") ?? "entrance")
    const caption = (formData.get("caption") as string | null) ?? null

    const photoType: PhotoType = (PHOTO_TYPES as readonly string[]).includes(photoTypeRaw)
      ? (photoTypeRaw as PhotoType)
      : "entrance"

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const detectedMime = detectMimeType(bytes)
    if (!detectedMime) {
      return NextResponse.json(
        { error: "허용되지 않는 파일 형식입니다. (JPEG, PNG, WebP만 가능)" },
        { status: 400 }
      )
    }
    const ext = MIME_TO_EXT[detectedMime]
    const fileName = `${buildingId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: detectedMime, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName)
    const photoUrl = pub.publicUrl

    const { data: building } = await supabaseAdmin
      .from("buildings")
      .select("name")
      .eq("id", buildingId)
      .maybeSingle()

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("building_photos")
      .insert({
        building_id: Number(buildingId),
        uploader_email: resolveUserEmail(user!),
        photo_url: photoUrl,
        photo_type: photoType,
        caption,
      })
      .select()
      .single()

    if (insertError) {
      await supabaseAdmin.storage.from(BUCKET).remove([fileName]).catch(() => {})
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    let pointResult: { success: boolean; points?: number; newTotal?: number; reason?: string } = {
      success: false,
    }
    if (user) {
      const r = await addPoints({
        email: resolveUserEmail(user!),
        action: "building_photo",
        buildingId: Number(buildingId),
        buildingName: (building as { name?: string } | null)?.name ?? undefined,
      })
      pointResult = r as typeof pointResult
    }

    return NextResponse.json({ photo: inserted, point: pointResult }, { status: 201 })
  } catch (error) {
    console.error("[buildings/photos:create] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const { id: buildingId } = await params
    const url = new URL(request.url)
    const photoIdParam = url.searchParams.get("photoId")
    if (!photoIdParam) {
      return NextResponse.json({ error: "photoId 필요" }, { status: 400 })
    }
    const photoId = Number(photoIdParam)

    const { data: photo, error: fetchErr } = await supabaseAdmin
      .from("building_photos")
      .select("id, uploader_email, photo_url, building_id")
      .eq("id", photoId)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!photo) return NextResponse.json({ error: "사진 없음" }, { status: 404 })
    if (String(photo.building_id) !== String(buildingId)) {
      return NextResponse.json({ error: "건물 불일치" }, { status: 400 })
    }

    const me = await lookupApprovedUser<{ role: string | null }>(user!, "role")
    const role = me?.role
    const isManager = role === "admin" || role === "sub_admin"

    if (!isManager) {
      return NextResponse.json(
        { error: "사진 삭제는 관리자와 부관리자만 가능합니다." },
        { status: 403 }
      )
    }

    const { error: delErr } = await supabaseAdmin
      .from("building_photos")
      .delete()
      .eq("id", photoId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Storage 파일도 best-effort 삭제 (URL → 경로 추출)
    const marker = `/${BUCKET}/`
    const idx = photo.photo_url.indexOf(marker)
    if (idx >= 0) {
      const path = photo.photo_url.slice(idx + marker.length)
      supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[buildings/photos:delete] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

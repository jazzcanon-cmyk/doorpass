import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth, getUserName } from "@/lib/auth"

const RESOURCE_TYPES = new Set(["link", "file", "image", "document", "text"])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, isAdmin, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id } = await params
  const resourceId = Number(id)
  if (!Number.isFinite(resourceId)) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 })
  }

  const userName = getUserName(user!)
  const canEdit = isAdmin || existing.author === userName
  if (!canEdit) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    description?: string | null
    resource_type?: string
    url?: string | null
  }

  const title = String(body.title ?? "").trim()
  const description = body.description != null ? String(body.description).trim() : ""
  const resource_type = String(body.resource_type ?? "")
  const url = body.url != null ? String(body.url).trim() : ""

  if (!title) {
    return NextResponse.json({ error: "title이 필요합니다." }, { status: 400 })
  }
  if (!resource_type || !RESOURCE_TYPES.has(resource_type)) {
    return NextResponse.json({ error: "지원하지 않는 resource_type 입니다." }, { status: 400 })
  }

  if (resource_type === "text") {
    if (!description) {
      return NextResponse.json({ error: "내용(description)을 입력해주세요." }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from("resources")
      .update({
        title,
        description,
        resource_type,
        url: null,
      })
      .eq("id", resourceId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // text 외: url(기존 유지 또는 입력)이 필요
  const nextUrl = url || existing.url || null
  if (!nextUrl) {
    return NextResponse.json({ error: "첨부/URL이 필요합니다." }, { status: 400 })
  }

  const nextDescription = description ? description : null

  const { error: updateError } = await supabaseAdmin
    .from("resources")
    .update({
      title,
      description: nextDescription,
      resource_type,
      url: nextUrl,
    })
    .eq("id", resourceId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}


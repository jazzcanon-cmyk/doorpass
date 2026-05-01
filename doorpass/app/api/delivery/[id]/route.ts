import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params

    const { data: req, error } = await supabaseAdmin
      .from("delivery_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) throw error
    if (!req) return NextResponse.json({ error: "요청 없음" }, { status: 404 })

    const branchId = (req as { branch_id: string | null }).branch_id
    let branch_name: string | null = null
    if (branchId) {
      const { data: b } = await supabaseAdmin
        .from("branches")
        .select("name")
        .eq("id", branchId)
        .maybeSingle()
      branch_name = (b as { name?: string } | null)?.name ?? null
    }

    const isOwner = (req as { requester_email: string }).requester_email === user!.email!
    let applications: Array<Record<string, unknown>> = []

    if (isOwner) {
      const { data } = await supabaseAdmin
        .from("delivery_applications")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: true })
      applications = (data ?? []) as Array<Record<string, unknown>>
    } else {
      const { data } = await supabaseAdmin
        .from("delivery_applications")
        .select("*")
        .eq("request_id", id)
        .eq("applicant_email", user!.email!)
        .maybeSingle()
      if (data) applications = [data as Record<string, unknown>]
    }

    const matchedEmail = (req as { matched_email: string | null }).matched_email
    const canSeeContact = isOwner || (matchedEmail && matchedEmail === user!.email!)

    const responseRequest = {
      ...(req as Record<string, unknown>),
      branch_name,
      contact: canSeeContact ? (req as { contact: string | null }).contact : null,
    }

    return NextResponse.json({
      request: responseRequest,
      applications,
      isOwner,
    })
  } catch (error) {
    console.error("[Delivery GET id] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params
    const body = await request.json()

    const { data: existing } = await supabaseAdmin
      .from("delivery_requests")
      .select("requester_email, status")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "요청 없음" }, { status: 404 })
    if ((existing as { requester_email: string }).requester_email !== user!.email!) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const update: Record<string, unknown> = {}
    if (typeof body.status === "string") update.status = body.status
    if (typeof body.memo === "string") update.memo = body.memo
    if (typeof body.area === "string") update.area = body.area
    if (typeof body.contact === "string") update.contact = body.contact

    const { data, error } = await supabaseAdmin
      .from("delivery_requests")
      .update(update)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ request: data })
  } catch (error) {
    console.error("[Delivery PUT] 오류:", error)
    return NextResponse.json({ error: "수정 실패" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params

    const { data: existing } = await supabaseAdmin
      .from("delivery_requests")
      .select("requester_email")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "요청 없음" }, { status: 404 })
    if ((existing as { requester_email: string }).requester_email !== user!.email!) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    await supabaseAdmin.from("delivery_applications").delete().eq("request_id", id)
    const { error } = await supabaseAdmin.from("delivery_requests").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Delivery DELETE] 오류:", error)
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

type Params = Promise<{ id: string }>

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { id } = await params
  const numericId = /^\d+$/.test(id) ? Number(id) : null
  if (!numericId) return NextResponse.json({ error: "유효하지 않은 id" }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as { branch_id?: string | null }
  const branch_id = body.branch_id ?? null

  const { data: updated, error } = await supabaseAdmin
    .from("approved_users")
    .update({ branch_id })
    .eq("id", numericId)
    .select("id, branch_id")

  if (error) {
    console.error("[branch PATCH] DB 오류:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    console.error("[branch PATCH] 업데이트된 행 없음 — userId:", numericId)
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

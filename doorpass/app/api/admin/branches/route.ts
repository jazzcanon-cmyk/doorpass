import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

function normalizeBranchId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string
      name?: string
      region?: string
      manager_email?: string
    }

    const id = normalizeBranchId(String(body.id ?? ""))
    const name = String(body.name ?? "").trim()
    const region = String(body.region ?? "").trim()
    const managerEmail = String(body.manager_email ?? "").trim() || null

    if (!id || !name || !region) {
      return NextResponse.json({ error: "필수 항목(id, name, region)을 입력해주세요." }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("id", id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "이미 존재하는 대리점 ID입니다" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from("branches").insert({
      id,
      name,
      region,
      manager_email: managerEmail,
    })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/branches:create] 추가 실패:", (error as Error).message)
    return NextResponse.json({ error: "추가 실패" }, { status: 500 })
  }
}

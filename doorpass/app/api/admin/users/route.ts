import { NextResponse } from "next/server"
import { requireManagerApi } from "@/lib/auth"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route"

type Role = "admin" | "driver"

export async function POST(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  const body = (await request.json()) as { name?: string; phone?: string | null; email?: string | null }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 })

  const supabase = await createSupabaseRouteHandlerClient()
  const row: Record<string, unknown> = {
    name,
    phone: body.phone?.toString().trim() || null,
    role: "driver" as const,
    is_active: false,
  }
  if (body.email?.toString().trim()) row.email = body.email.toString().trim()
  if (role === "sub_admin" && user?.email) {
    const { data: current } = await supabase
      .from("approved_users")
      .select("branch_id")
      .eq("email", user.email)
      .maybeSingle()
    row.branch_id = current?.branch_id ?? null
  }

  const { error } = await supabase.from("approved_users").insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const { user, role, unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const excludeAdmin = searchParams.get("excludeAdmin") === "true"
  const search = searchParams.get("search")?.trim().toLowerCase() ?? ""

  const supabase = await createSupabaseRouteHandlerClient()
  let query = supabase
    .from("approved_users")
    .select(`
      *,
      branches (
        id,
        name,
        region
      )
    `)
    .order("created_at", { ascending: false })

  if (role === "sub_admin" && user?.email) {
    const { data: current } = await supabase
      .from("approved_users")
      .select("branch_id")
      .eq("email", user.email)
      .maybeSingle()
    if (!current?.branch_id) {
      return NextResponse.json({ users: [] })
    }
    query = query.eq("branch_id", current.branch_id)
  }

  if (excludeAdmin) {
    query = query.neq("role", "admin")
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let users = data ?? []
  if (search) {
    users = users.filter((u) => {
      const name = String(u.name ?? "").toLowerCase()
      const email = String(u.email ?? "").toLowerCase()
      return name.includes(search) || email.includes(search)
    })
  }

  return NextResponse.json({ users })
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  const body = (await request.json()) as {
    id?: number
    action?: "approve" | "reject" | "set_role"
    role?: string
  }
  const id = body.id
  if (id == null || typeof id !== "number") {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
  }

  const supabase = await createSupabaseRouteHandlerClient()

  if (body.action === "approve") {
    const { error } = await supabase.from("approved_users").update({ is_active: true }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "reject") {
    const { error } = await supabase.from("approved_users").update({ is_active: false }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_role") {
    const r = body.role
    if (r !== "admin" && r !== "user" && r !== "driver") {
      return NextResponse.json({ error: "role은 admin 또는 user 입니다." }, { status: 400 })
    }
    const nextRole: Role = r === "admin" ? "admin" : "driver"
    const { data: row } = await supabase.from("approved_users").select("id, role").eq("id", id).single()
    if (!row) return NextResponse.json({ error: "사용자 없음" }, { status: 404 })

    if (row.role === "admin" && nextRole === "driver") {
      const { data: admins } = await supabase.from("approved_users").select("id").eq("role", "admin")
      if ((admins?.length ?? 0) === 1 && admins![0].id === id) {
        return NextResponse.json(
          { error: "마지막 관리자는 일반으로 변경할 수 없습니다." },
          { status: 400 }
        )
      }
    }

    const { error } = await supabase.from("approved_users").update({ role: nextRole }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, role: nextRole })
  }

  return NextResponse.json({ error: "action이 필요합니다 (approve | reject | set_role)." }, { status: 400 })
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireManagerApi()
  if (unauthorized) return unauthorized

  const idParam = new URL(request.url).searchParams.get("id")
  const id = idParam ? Number(idParam) : NaN
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id 쿼리가 필요합니다." }, { status: 400 })
  }

  const supabase = await createSupabaseRouteHandlerClient()
  const { data: row } = await supabase.from("approved_users").select("id, role").eq("id", id).single()
  if (!row) return NextResponse.json({ error: "사용자 없음" }, { status: 404 })
  if (row.role === "admin") {
    const { data: admins } = await supabase.from("approved_users").select("id").eq("role", "admin")
    if ((admins?.length ?? 0) === 1 && admins![0].id === id) {
      return NextResponse.json({ error: "마지막 관리자는 삭제할 수 없습니다." }, { status: 400 })
    }
  }

  const { error } = await supabase.from("approved_users").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

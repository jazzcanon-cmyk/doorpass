import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

const supabase = supabaseAdmin

const ALLOWED_STATUS = new Set(["pending", "approved", "rejected"])

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status") ?? "pending"
  const status = ALLOWED_STATUS.has(statusParam) ? statusParam : "pending"

  const { data, error } = await supabase
    .from("role_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

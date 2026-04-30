import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAuth } from "@/lib/auth"

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")?.trim()

  if (!address) {
    return NextResponse.json({ error: "address 파라미터가 필요합니다." }, { status: 400 })
  }

  const pattern = `%${escapeIlikePattern(address)}%`

  const { data, error } = await supabaseAdmin
    .from("buildings")
    .select("id, name, address, created_at")
    .ilike("address", pattern)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data && data.length > 0) {
    const b = data[0] as { id: number; name: string | null; address: string | null; created_at: string }
    return NextResponse.json({
      exists: true,
      building: {
        id: String(b.id),
        name: b.name || b.address || "이름 없음",
        address: b.address || "",
        created_at: b.created_at,
      },
    })
  }

  return NextResponse.json({ exists: false })
}

import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const supabase = await createSupabaseRouteHandlerClient()
  const { data, error } = await supabase
    .from("user_activities")
    .select("id, metadata, created_at")
    .eq("action_type", "slack_test")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ items: [], error: error.message })
  }

  const items = (data ?? []).map((row) => {
    const meta = row.metadata as Record<string, unknown>
    return {
      id: row.id,
      scenario: String(meta?.scenario ?? "basic"),
      ok: meta?.ok === true,
      created_at: row.created_at,
    }
  })

  return NextResponse.json({ items })
}

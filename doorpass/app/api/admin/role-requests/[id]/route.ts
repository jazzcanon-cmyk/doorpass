import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const supabase = supabaseAdmin

type Params = Promise<{ id: string }>

export async function POST(request: Request, { params }: { params: Params }) {
  const { user, unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  const action = body.action
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const { data: roleRequest, error: fetchErr } = await supabase
    .from("role_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchErr) {
    console.error("[Role Approval] Failed to fetch request:", fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!roleRequest) return NextResponse.json({ error: "Request not found" }, { status: 404 })
  if (roleRequest.status !== "pending") {
    return NextResponse.json({ error: "Request already processed" }, { status: 400 })
  }

  const newStatus = action === "approve" ? "approved" : "rejected"

  if (action === "approve") {
    console.log("[Role Approval] Updating role for:", roleRequest.user_email)

    const { data: updateData, error: updateError } = await supabase
      .from("approved_users")
      .update({ role: "editor" })
      .eq("email", roleRequest.user_email)
      .select()

    console.log("[Role Approval] Update result:", { updateData, updateError })

    if (updateError) {
      console.error("[Role Approval] Failed to update role:", updateError)
      return NextResponse.json(
        { error: "Failed to update user role: " + updateError.message },
        { status: 500 }
      )
    }

    if (!updateData || updateData.length === 0) {
      console.error("[Role Approval] User not found in approved_users:", roleRequest.user_email)
      return NextResponse.json(
        { error: "User not found in approved_users table" },
        { status: 404 }
      )
    }

    console.log("[Role Approval] Successfully updated role to editor")
  }

  const { error: statusUpdateError } = await supabase
    .from("role_requests")
    .update({
      status: newStatus,
      reviewed_by: user!.email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (statusUpdateError) {
    console.error("[Role Approval] Failed to update request status:", statusUpdateError)
  }

  const message =
    action === "approve"
      ? `✅ 편집자 권한 승인\n👤 ${roleRequest.user_name} (${roleRequest.user_email})\n이제 건물 정보를 수정할 수 있습니다.`
      : `❌ 편집자 권한 거부\n👤 ${roleRequest.user_name} (${roleRequest.user_email})`
  sendTelegramMessage(message).catch(console.error)

  return NextResponse.json({
    success: true,
    status: newStatus,
    message: action === "approve" ? "User role updated to editor" : "Request rejected",
  })
}

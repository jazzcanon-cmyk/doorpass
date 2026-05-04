import { supabaseAdmin } from "@/lib/supabase-admin"

export type PendingApprovalRow = {
  id: number
  user_email: string
  user_name: string | null
  selected_branch_id: string
  status: string
}

export type ExecuteApprovalResult =
  | { ok: true; approval: PendingApprovalRow }
  | { ok: false; error: string; httpStatus: number }

/**
 * pending_approvals 한 건에 대해 승인/거부 DB 반영 (서비스 롤).
 * 호출 전에 manager 권한·지점 일치 등은 라우트에서 검증할 것.
 */
export async function executePendingApprovalById(
  approvalId: number,
  action: "approve" | "reject",
  reviewedBy: string,
  role?: "driver" | "editor"
): Promise<ExecuteApprovalResult> {
  const { data: approval, error: fetchErr } = await supabaseAdmin
    .from("pending_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle()

  if (fetchErr || !approval) {
    return { ok: false, error: "요청을 찾을 수 없습니다.", httpStatus: 404 }
  }

  const row = approval as PendingApprovalRow
  if (row.status !== "pending") {
    return { ok: false, error: "이미 처리된 요청입니다.", httpStatus: 400 }
  }

  if (action === "approve") {
    const assignedRole = role ?? "driver"

    const { data: existing } = await supabaseAdmin
      .from("approved_users")
      .select("id, role")
      .eq("email", row.user_email)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("approved_users")
        .update({
          branch_id: row.selected_branch_id,
          first_login_at: new Date().toISOString(),
          role: assignedRole,
        })
        .eq("id", existing.id)
      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabaseAdmin.from("approved_users").insert({
        email: row.user_email,
        name: row.user_name,
        role: assignedRole,
        branch_id: row.selected_branch_id,
        first_login_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
    }
  }

  const { error: statusError } = await supabaseAdmin
    .from("pending_approvals")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)

  if (statusError) throw statusError

  return { ok: true, approval: row }
}

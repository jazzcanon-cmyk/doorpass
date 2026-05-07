import { supabaseAdmin } from "@/lib/supabase-admin"

export type PendingApprovalRow = {
  id: number
  user_email: string
  user_name: string | null
  selected_branch_id: string
  status: string
  phone?: string | null
}

export type ExecuteApprovalResult =
  | { ok: true; approval: PendingApprovalRow }
  | { ok: false; error: string; httpStatus: number }

/**
 * pending_approvals 한 건에 대해 승인/거부 DB 반영 (서비스 롤).
 * 호출 전에 manager 권한·지점 일치 등은 라우트에서 검증할 것.
 *
 * 동시성: pending_approvals 상태 전이를 단일 조건부 update로 atomic하게 처리한다.
 * 두 관리자가 동시에 같은 건을 승인해도 한 명만 성공하고 나머지는 409를 받는다.
 */
export async function executePendingApprovalById(
  approvalId: number,
  action: "approve" | "reject",
  reviewedBy: string,
  role?: "driver" | "editor",
  branchIdOverride?: string | null
): Promise<ExecuteApprovalResult> {
  const newStatus = action === "approve" ? "approved" : "rejected"

  const { data: gated, error: gateErr } = await supabaseAdmin
    .from("pending_approvals")
    .update({
      status: newStatus,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()

  if (gateErr) throw gateErr

  if (!gated) {
    const { data: existing } = await supabaseAdmin
      .from("pending_approvals")
      .select("id")
      .eq("id", approvalId)
      .maybeSingle()
    if (!existing) {
      return { ok: false, error: "요청을 찾을 수 없습니다.", httpStatus: 404 }
    }
    return {
      ok: false,
      error: "이미 처리된 승인 요청입니다. 화면을 새로고침해주세요.",
      httpStatus: 409,
    }
  }

  const row = gated as PendingApprovalRow

  if (action === "approve") {
    const assignedRole = role ?? "driver"
    const assignedBranchId = branchIdOverride !== undefined
      ? branchIdOverride
      : row.selected_branch_id

    try {
      const { data: existing } = await supabaseAdmin
        .from("approved_users")
        .select("id, role")
        .eq("email", row.user_email)
        .maybeSingle()

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from("approved_users")
          .update({
            branch_id: assignedBranchId,
            first_login_at: new Date().toISOString(),
            role: assignedRole,
            ...(row.user_name ? { name: row.user_name } : {}),
            ...(row.phone ? { phone: row.phone } : {}),
          })
          .eq("id", existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabaseAdmin.from("approved_users").insert({
          email: row.user_email,
          name: row.user_name,
          role: assignedRole,
          branch_id: assignedBranchId,
          first_login_at: new Date().toISOString(),
          phone: row.phone ?? null,
        })
        if (insertError) throw insertError
      }
    } catch (e) {
      await supabaseAdmin
        .from("pending_approvals")
        .update({ status: "pending", reviewed_by: null, reviewed_at: null })
        .eq("id", approvalId)
        .eq("status", newStatus)
      throw e
    }
  }

  return { ok: true, approval: row }
}

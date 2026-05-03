import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { executePendingApprovalById } from "@/lib/pending-approval-actions"
import { sendTelegramMessage } from "@/lib/telegram"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f4f5; color: #18181b; }
    main { text-align: center; padding: 2rem; max-width: 28rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
    p { margin: 0; font-size: 0.95rem; color: #52525b; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </main>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 이메일 링크용 승인/거부 (GET, 로그인 불필요). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""
  const actionRaw = url.searchParams.get("action") ?? ""
  const action = actionRaw === "approve" ? "approve" : actionRaw === "reject" ? "reject" : null

  if (!token || !action) {
    return htmlPage("안내", "링크가 올바르지 않습니다.")
  }

  if (!UUID_RE.test(token)) {
    return htmlPage("안내", "유효하지 않은 링크입니다.")
  }

  try {
    const { data: row, error: qErr } = await supabaseAdmin
      .from("pending_approvals")
      .select("id, status")
      .eq("token", token)
      .maybeSingle()

    if (qErr) throw qErr

    if (!row) {
      return htmlPage("안내", "유효하지 않은 링크이거나 만료되었습니다.")
    }

    if (row.status !== "pending") {
      return htmlPage("안내", "이미 처리된 요청입니다.")
    }

    const approvalId = Number(row.id)
    const result = await executePendingApprovalById(approvalId, action, "email-link")

    if (!result.ok) {
      if (result.httpStatus === 400) {
        return htmlPage("안내", "이미 처리된 요청입니다.")
      }
      return htmlPage("오류", "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    }

    const { approval } = result

    await sendTelegramMessage(
      action === "approve"
        ? `✅ 회원 승인 완료 (이메일 링크)\n📧 이메일: ${approval.user_email}\n👤 이름: ${approval.user_name ?? "-"}\n📅 처리: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
        : `❌ 회원 승인 거부 (이메일 링크)\n📧 이메일: ${approval.user_email}\n👤 이름: ${approval.user_name ?? "-"}`,
    ).catch(console.error)

    if (action === "approve") {
      return htmlPage("승인 완료", "승인이 완료되었습니다.")
    }
    return htmlPage("거부 완료", "거부 처리되었습니다.")
  } catch (e) {
    console.error("[GET /api/approve]", e)
    return htmlPage("오류", "처리 중 문제가 발생했습니다.")
  }
}

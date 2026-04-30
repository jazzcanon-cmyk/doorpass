import { Resend } from "resend"

const resendClient = () => {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  return new Resend(key)
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev"
}

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://doorpass.kr"
  return raw.replace(/\/$/, "")
}

function buttonHtml(href: string, label: string, bg: string): string {
  return `
  <a href="${href}" style="display:inline-block;padding:12px 24px;margin:8px 8px 8px 0;background:${bg};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
    ${label}
  </a>`
}

export async function sendApprovalRequestEmail(params: {
  toEmails: string[]
  branchName: string
  requesterName: string
  requesterEmail: string
  requestedAtLabel: string
  token: string
}): Promise<void> {
  const client = resendClient()
  if (!client) {
    console.warn("[email] RESEND_API_KEY 없음 — 승인 요청 메일 생략")
    return
  }
  const { toEmails, branchName, requesterName, requesterEmail, requestedAtLabel, token } = params
  if (toEmails.length === 0) {
    console.warn("[email] 수신 부관리자 이메일 없음 — 승인 요청 메일 생략")
    return
  }

  const base = appBaseUrl()
  const approveUrl = `${base}/api/approve?token=${encodeURIComponent(token)}&action=approve`
  const rejectUrl = `${base}/api/approve?token=${encodeURIComponent(token)}&action=reject`

  const subject = `[DoorPass] 새 회원 승인 요청 — ${branchName}`
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;padding:16px;">
  <h1 style="font-size:18px;margin:0 0 12px;">새 회원 승인 요청</h1>
  <p style="margin:0 0 8px;"><strong>대리점</strong> ${escapeHtml(branchName)}</p>
  <p style="margin:0 0 8px;"><strong>요청자</strong> ${escapeHtml(requesterName)}</p>
  <p style="margin:0 0 8px;"><strong>이메일</strong> ${escapeHtml(requesterEmail)}</p>
  <p style="margin:0 0 20px;"><strong>요청 일시</strong> ${escapeHtml(requestedAtLabel)}</p>
  <p style="margin:0 0 12px;">아래 버튼으로 바로 처리할 수 있습니다.</p>
  <div style="margin:16px 0;">
    ${buttonHtml(approveUrl, "승인하기", "#2563eb")}
    ${buttonHtml(rejectUrl, "거부하기", "#dc2626")}
  </div>
  <p style="margin-top:24px;font-size:12px;color:#666;">본 메일은 DoorPass 시스템에서 발송되었습니다.</p>
</body>
</html>`

  for (const to of toEmails) {
    const email = to.trim()
    if (!email) continue
    try {
      await client.emails.send({ from: fromAddress(), to: email, subject, html })
    } catch (e) {
      console.error("[email] 승인 요청 메일 실패:", email, e)
    }
  }
}

export async function sendApprovalResultEmail(params: {
  toEmail: string
  approved: boolean
}): Promise<void> {
  const client = resendClient()
  if (!client) {
    console.warn("[email] RESEND_API_KEY 없음 — 결과 메일 생략")
    return
  }
  const { toEmail, approved } = params
  const email = toEmail.trim()
  if (!email) return

  const subject = approved ? "[DoorPass] 회원 승인이 완료되었습니다" : "[DoorPass] 회원 승인 안내"
  const bodyApproved =
    "<p>승인되었습니다. 지금 바로 비밀번호를 확인하세요!</p><p><a href=\"" +
    appBaseUrl() +
    "/\">DoorPass 열기</a></p>"
  const bodyRejected = "<p>아쉽게도 승인이 거부되었습니다.</p>"
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;padding:16px;">
  ${approved ? bodyApproved : bodyRejected}
  <p style="margin-top:24px;font-size:12px;color:#666;">DoorPass</p>
</body>
</html>`

  try {
    await client.emails.send({ from: fromAddress(), to: email, subject, html })
  } catch (e) {
    console.error("[email] 결과 메일 실패:", email, e)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

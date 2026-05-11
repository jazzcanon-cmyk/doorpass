import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { generateExpensePdf } from "../_pdf-generator"

export async function POST(req: NextRequest) {
  // 빌드 시 환경변수 미확정 문제 방지 — 함수 안에서 초기화
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const body = (await req.json()) as {
      user_id:         string
      year:            string
      period:          string
      recipient_email: string
      recipient_name:  string
    }

    const { user_id, year, period, recipient_email, recipient_name } = body

    if (!user_id || !recipient_email) {
      return NextResponse.json({ error: "user_id, recipient_email 필수" }, { status: 400 })
    }

    // PDF 생성 (pdf/route.ts와 동일 로직 재사용)
    const { buffer, filename, periodLabel, totalAmount, deductibleAmount } =
      await generateExpensePdf(user_id, year, period)

    const subject  = `[TaxPass] ${year}년 ${periodLabel} 지출내역서`
    const nameText = recipient_name || "고객"

    const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
            max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
  <h2 style="font-size: 20px; color: #1a1a2e; margin: 0 0 12px;">
    안녕하세요 ${nameText}님,
  </h2>
  <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
    ${year}년 ${periodLabel} 지출내역서를 첨부합니다.
  </p>

  <div style="background: #f5f7ff; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px; font-size: 14px; color: #333;">
      <strong>총 지출</strong>
    </p>
    <p style="margin: 0 0 14px; font-size: 22px; font-weight: 700; color: #1a1a2e;">
      ${totalAmount.toLocaleString("ko-KR")}원
    </p>
    <p style="margin: 0 0 4px; font-size: 13px; color: #666;">
      부가세공제 가능: <strong>${deductibleAmount.toLocaleString("ko-KR")}원</strong>
    </p>
  </div>

  <p style="font-size: 13px; color: #777; margin: 0 0 24px;">
    첨부파일 <strong>${filename}</strong>을 확인해주세요.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 20px;" />
  <p style="font-size: 12px; color: #aaa; margin: 0;">- TaxPass 드림</p>
</div>
`

    const { error: sendError } = await resend.emails.send({
      from:        "onboarding@resend.dev",
      to:          [recipient_email],
      subject,
      html:        htmlBody,
      attachments: [{ filename, content: buffer }],
    })

    if (sendError) throw new Error(sendError.message)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "이메일 발송 중 오류"
    if (msg === "데이터 없음") {
      return NextResponse.json({ error: "발송할 지출 내역이 없습니다." }, { status: 404 })
    }
    console.error("이메일 발송 오류:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

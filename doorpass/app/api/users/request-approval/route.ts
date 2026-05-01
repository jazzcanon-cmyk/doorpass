import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { branchId, userName } = body

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId 필요' },
        { status: 400 }
      )
    }

    const userEmail = user!.email!

    // 1. pending_approvals에 insert (중복 허용)
    const { error: insertError } = await supabaseAdmin
      .from('pending_approvals')
      .insert({
        user_email: userEmail,
        user_name: userName || '',
        selected_branch_id: branchId,
        status: 'pending'
      })

    if (insertError) {
      console.error('insert 에러:', insertError)
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      )
    }

    // 2. 수신자 이메일 찾기
    console.log('=== 이메일 발송 시작 ===')

    // 부관리자 찾기
    const { data: subAdmin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('branch_id', branchId)
      .eq('role', 'sub_admin')
      .maybeSingle()

    // 대리점 manager_email 찾기
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('manager_email, name')
      .eq('id', branchId)
      .single()

    // 관리자 찾기
    const { data: admin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('role', 'admin')
      .maybeSingle()

    const recipientEmail =
      subAdmin?.email ||
      branch?.manager_email ||
      admin?.email ||
      'jazzcanon@gmail.com'

    console.log('수신자:', recipientEmail)
    console.log('RESEND_API_KEY 존재:', !!process.env.RESEND_API_KEY)

    // 3. Resend로 이메일 발송
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [recipientEmail],
        subject: `[DoorPass] 새 회원 승인 요청 - ${branch?.name || branchId}`,
        html: `
          <h2>새 회원 승인 요청</h2>
          <p><b>이메일:</b> ${userEmail}</p>
          <p><b>이름:</b> ${userName || '미입력'}</p>
          <p><b>대리점:</b> ${branch?.name || branchId}</p>
          <p><b>요청 시각:</b> ${new Date().toLocaleString('ko-KR')}</p>
          <br>
          <a href="https://doorpass.kr/admin/pending-approvals"
             style="background:#4CAF50;color:white;padding:12px 24px;
                    text-decoration:none;border-radius:6px;font-size:16px;">
            승인하러 가기
          </a>
        `
      })

    if (emailError) {
      console.error('Resend 에러:', JSON.stringify(emailError))
    } else {
      console.log('이메일 발송 성공:', JSON.stringify(emailData))
    }

    // 4. Telegram 알림
    try {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN
      const telegramChatId = process.env.TELEGRAM_CHAT_ID
      if (telegramToken && telegramChatId) {
        await fetch(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: `[DoorPass] 새 승인 요청\n이메일: ${userEmail}\n대리점: ${branch?.name || branchId}`
            })
          }
        )
      }
    } catch (telegramError) {
      console.error('텔레그램 에러(무시):', telegramError)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('request-approval 전체 에러:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

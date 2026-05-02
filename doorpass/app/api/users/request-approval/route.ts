import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

    // 2. 수신자 찾기
    const { data: subAdmin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('branch_id', branchId)
      .eq('role', 'sub_admin')
      .maybeSingle()

    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('manager_email, name')
      .eq('id', branchId)
      .single()

    const { data: admin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('role', 'admin')
      .maybeSingle()

    const branchDisplayName = branch?.name || '미지정'

    // 3. 부관리자에게 PWA 푸시 알림 발송
    if (subAdmin?.email) {
      fetch(new URL('/api/push/send', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: subAdmin.email,
          title: '새 회원 승인 요청이 있어요!',
          body: (userName || userEmail) + '님이 ' + branchDisplayName + ' 가입을 요청했습니다.',
          url: '/sub-admin/pending-approvals',
        }),
      }).catch(console.error)
    }

    // 관리자에게도 푸시 알림
    if (admin?.email) {
      fetch(new URL('/api/push/send', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: admin.email,
          title: '새 회원 승인 요청',
          body: (userName || userEmail) + '님 (' + branchDisplayName + ')',
          url: '/admin/pending-approvals',
        }),
      }).catch(console.error)
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
              text: `[DoorPass] 새 승인 요청\n신청자 이메일: ${userEmail}\n신청자 이름: ${userName || '미입력'}\n대리점: ${branchDisplayName}`
            })
          }
        )
      }
    } catch (telegramError) {
      console.error('텔레그램 에러(무시):', telegramError)
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    console.error('request-approval 전체 에러:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '오류 발생' },
      { status: 500 }
    )
  }
}

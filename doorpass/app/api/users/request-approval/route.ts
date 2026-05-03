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
      return NextResponse.json({ success: false, error: 'branchId 필요' }, { status: 400 })
    }

    const userEmail = user!.email ?? ''
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    // 1. pending_approvals insert
    const { error: insertError } = await supabaseAdmin
      .from('pending_approvals')
      .insert({
        user_email: userEmail || userId,
        user_name: userName || '',
        selected_branch_id: branchId,
        status: 'pending',
      })

    if (insertError) {
      console.error('[request-approval] insert 에러:', insertError)
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // 2. 대리점 정보 조회
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single()

    const branchDisplayName = branch?.name || '미지정'

    // 3. 부관리자/관리자 찾기
    const { data: subAdmin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('branch_id', branchId)
      .eq('role', 'sub_admin')
      .maybeSingle()

    const { data: admin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('role', 'admin')
      .maybeSingle()

    // 4. PWA 푸시 알림
    const baseUrl = request.nextUrl.origin
    const notifyTargets = [subAdmin?.email, admin?.email].filter(Boolean) as string[]

    for (const targetEmail of notifyTargets) {
      fetch(baseUrl + '/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: targetEmail,
          title: '🔔 새 회원 승인 요청',
          body: (userName || userEmail || '신규 회원') + '님이 ' + branchDisplayName + ' 가입을 요청했습니다.',
          url: '/sub-admin/pending-approvals',
        }),
      }).catch(console.error)
    }

    // 5. 텔레그램 알림
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID
    if (telegramToken && telegramChatId) {
      fetch('https://api.telegram.org/bot' + telegramToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: '[DoorPass] 새 승인 요청\n신청자: ' + (userName || userEmail || userId) + '\n대리점: ' + branchDisplayName,
        }),
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[request-approval] 전체 에러:', error)
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 })
  }
}

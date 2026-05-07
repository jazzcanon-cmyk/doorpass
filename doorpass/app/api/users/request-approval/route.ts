import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendApprovalRequestEmail } from '@/lib/email'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { branchId, userName, reason, phone } = body as {
      branchId?: string
      userName?: string
      reason?: string
      phone?: string
    }

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branchId 필요' }, { status: 400 })
    }

    // 기타 선택 시 사유 필수
    if (branchId === 'etc-branch' && !reason?.trim()) {
      return NextResponse.json({ success: false, error: '기타 선택 시 사유를 입력해주세요.' }, { status: 400 })
    }

    const userEmail = user!.email ?? ''
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId =
      ((meta?.provider_id as string | undefined) ??
        (meta?.sub as string | undefined) ??
        user!.id) as string

    const kakaoName =
      (meta?.name as string) ||
      (meta?.full_name as string) ||
      (meta?.preferred_username as string) ||
      userName ||
      ''
    const profileImage = (meta?.avatar_url as string) || null

    // 0. 중복 신청 방어: 동일 user_email로 pending/approved 상태가 있으면 차단
    const lookupEmail = userEmail || userId
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('pending_approvals')
      .select('id, status')
      .eq('user_email', lookupEmail)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existingError) {
      console.error('[users/request-approval] 중복 확인 실패:', (existingError as Error).message)
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 가입 신청하셨습니다. 승인 대기 중입니다.' },
        { status: 409 }
      )
    }

    // 1. pending_approvals insert (이메일 링크용 UUID 토큰 생성)
    const token = randomUUID()
    const { error: insertError } = await supabaseAdmin
      .from('pending_approvals')
      .insert({
        user_email: lookupEmail,
        user_name: kakaoName || userName || '',
        kakao_name: kakaoName,
        kakao_nickname: (meta?.preferred_username as string) || null,
        profile_image_url: profileImage,
        selected_branch_id: branchId,
        status: 'pending',
        token,
        reason: branchId === 'etc-branch' ? (reason?.trim() || null) : null,
        phone: phone?.trim() || null,
      })

    if (insertError) {
      console.error('[users/request-approval] insert 실패:', (insertError as Error).message)
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // 2. 대리점 정보 조회
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single()

    const branchDisplayName = branch?.name || '미지정'

    // 3. 부관리자(다중)/관리자 찾기
    const { data: subAdmins } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('branch_id', branchId)
      .eq('role', 'sub_admin')

    const { data: admin } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('role', 'admin')
      .maybeSingle()

    // 4. PWA 푸시 알림 — 기타는 관리자만, 일반 대리점은 부관리자+관리자
    const baseUrl = request.nextUrl.origin
    const subAdminEmails = branchId === 'etc-branch'
      ? []
      : (subAdmins ?? []).map((s) => s.email).filter(Boolean) as string[]
    const notifyTargets = Array.from(
      new Set([...subAdminEmails, admin?.email].filter(Boolean) as string[])
    )

    for (const targetEmail of notifyTargets) {
      fetch(baseUrl + '/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' },
        body: JSON.stringify({
          userEmail: targetEmail,
          title: '🔔 새 회원 승인 요청',
          body: (kakaoName || userName || userEmail || '신규 회원') + '님이 ' + branchDisplayName + ' 가입을 요청했습니다.',
          url: '/sub-admin/pending-approvals',
        }),
      }).catch(console.error)
    }

    // 5-pre. 이메일 승인 요청 (resend) — best effort
    sendApprovalRequestEmail({
      toEmails: notifyTargets,
      branchName: branchDisplayName,
      requesterName: kakaoName || userName || userEmail || '신규 회원',
      requesterEmail: userEmail || userId,
      requestedAtLabel: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      token,
    }).catch(console.error)

    // 5. 텔레그램 알림
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID
    if (telegramToken && telegramChatId) {
      fetchWithTimeout('https://api.telegram.org/bot' + telegramToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: '[DoorPass] 새 승인 요청\n신청자: ' + (kakaoName || userName || userEmail || userId) + '\n대리점: ' + branchDisplayName,
        }),
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[users/request-approval] 처리 실패:', (error as Error).message)
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 })
  }
}

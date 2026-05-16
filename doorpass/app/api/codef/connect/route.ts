import { NextRequest, NextResponse } from 'next/server'
import { getCodefToken, encryptRSA, codefRequest } from '@/lib/codef'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { serviceType, organization, loginId, loginPassword } = await req.json()
    if (!serviceType || !organization || !loginId || !loginPassword)
      return NextResponse.json({ success: false, message: '필수 입력값이 누락되었습니다.' }, { status: 400 })

    // 인증된 사용자의 ID를 사용 (요청 body의 userId는 보안상 무시)
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId = (
      (meta?.provider_id as string | undefined) ??
      (meta?.sub as string | undefined) ??
      user!.id
    ) as string

    const token = await getCodefToken()
    const encryptedId = encryptRSA(loginId)
    const encryptedPw = encryptRSA(loginPassword)
    const businessType = serviceType === 'hometax' ? 'TB' : 'CD'

    const result = await codefRequest<{ data?: { connectedId: string }; result: { code: string; message: string } }>(
      '/v1/account/create',
      { accountList: [{ countryCode: 'KR', businessType, clientType: 'P', organization, loginType: '1', id: encryptedId, password: encryptedPw }] },
      token
    )

    if (!result.data?.connectedId)
      return NextResponse.json({ success: false, message: result.result?.message || '계정 연결 실패. 아이디/비밀번호를 확인해주세요.', code: result.result?.code }, { status: 400 })

    const { error: dbError } = await supabaseAdmin.from('codef_connections').upsert(
      { user_id: userId, service_type: serviceType, organization, connected_id: result.data.connectedId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,service_type' }
    )
    if (dbError) throw dbError

    return NextResponse.json({ success: true, connectedId: result.data.connectedId, message: '계정 연결 완료!' })
  } catch (err) {
    console.error('[codef/connect]', err)
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}

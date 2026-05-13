import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCodefToken, encryptRSA, codefRequest } from '@/lib/codef'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { userId, serviceType, organization, loginId, loginPassword } = await req.json()
    if (!userId || !serviceType || !organization || !loginId || !loginPassword)
      return NextResponse.json({ success: false, message: '필수 입력값이 누락되었습니다.' }, { status: 400 })

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

    const { error: dbError } = await supabase.from('codef_connections').upsert(
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCodefToken, encryptRSA, codefRequest } from '@/lib/codef'
import { requireAuth } from '@/lib/auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { userId, phoneNo, userName, identity, jobId, extraInfo } = await req.json() as {
      userId: number; phoneNo: string; userName: string; identity: string; jobId: string; extraInfo: unknown
    }
    const token = await getCodefToken()

    const result = await codefRequest<{
      data?: { connectedId?: string }
      result: { code: string; message: string }
    }>(
      '/v1/account/create',
      {
        accountList: [{
          countryCode: 'KR',
          businessType: 'TB',
          clientType: 'P',
          organization: '0001',
          loginType: '5',
          loginTypeLevel: '1',
          simpleAuth: '1',
          is2Way: true,
          phoneNo: encryptRSA(phoneNo.replace(/-/g, '')),
          userName: encryptRSA(userName),
          identity: encryptRSA(identity),
          jobId,
          extraInfo,
        }]
      },
      token
    )

    if (result.result?.code === 'CF-03002')
      return NextResponse.json({ success: true, completed: false, message: '아직 승인 대기 중...' })

    if (result.result?.code !== 'CF-00000' || !result.data?.connectedId)
      return NextResponse.json({ success: false, message: result.result?.message || '인증 확인 실패', code: result.result?.code }, { status: 400 })

    await supabase.from('codef_connections').upsert(
      { user_id: userId, service_type: 'hometax', organization: '0001', connected_id: result.data.connectedId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,service_type' }
    )

    return NextResponse.json({ success: true, completed: true, connectedId: result.data.connectedId })
  } catch (err) {
    console.error('[kakao/confirm]', err)
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}

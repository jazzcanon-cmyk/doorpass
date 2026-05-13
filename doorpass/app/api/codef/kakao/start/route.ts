import { NextRequest, NextResponse } from 'next/server'
import { getCodefToken, encryptRSA, codefRequest } from '@/lib/codef'

export async function POST(req: NextRequest) {
  try {
    const { phoneNo, userName, identity } = await req.json() as {
      phoneNo: string; userName: string; identity: string
    }
    if (!phoneNo || !userName || !identity)
      return NextResponse.json({ success: false, message: '모든 항목을 입력해주세요.' }, { status: 400 })

    const token = await getCodefToken()

    const result = await codefRequest<{
      data?: { jobId?: string; extraInfo?: unknown; connectedId?: string; twoWayInfo?: unknown }
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
        }]
      },
      token
    )

    if (result.result?.code === 'CF-00000' && result.data?.connectedId)
      return NextResponse.json({ success: true, completed: true, connectedId: result.data.connectedId })

    if (result.result?.code !== 'CF-03002')
      return NextResponse.json({ success: false, message: result.result?.message || '카카오 인증 요청 실패', code: result.result?.code }, { status: 400 })

    return NextResponse.json({
      success: true, completed: false,
      jobId: result.data?.jobId,
      extraInfo: result.data?.extraInfo ?? result.data?.twoWayInfo,
      message: '카카오톡 앱에서 인증을 승인해주세요!',
    })
  } catch (err) {
    console.error('[kakao/start]', err)
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}

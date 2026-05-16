import { NextRequest, NextResponse } from 'next/server'
import { getCodefToken, codefRequest, guessCategory, fromYYYYMMDD } from '@/lib/codef'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { startDate, endDate } = await req.json()

    // 인증된 사용자의 ID를 사용 (요청 body의 userId는 보안상 무시)
    const meta = user!.user_metadata as Record<string, unknown> | undefined
    const userId = (
      (meta?.provider_id as string | undefined) ??
      (meta?.sub as string | undefined) ??
      user!.id
    ) as string

    const { data: conn } = await supabaseAdmin.from('codef_connections').select('connected_id').eq('user_id', userId).eq('service_type', 'hometax').single()
    if (!conn?.connected_id) return NextResponse.json({ success: false, message: '홈택스 계정이 연결되지 않았습니다.' }, { status: 400 })

    const token = await getCodefToken()
    const result = await codefRequest<{ data?: any[]; result: { code: string; message: string } }>(
      '/v1/kr/public/tax/hometax-incomededucts/b/list',
      { connectedId: conn.connected_id, organization: '0001', startDate, endDate, type: '1' },
      token
    )

    if (result.result?.code !== 'CF-00000' || !result.data)
      return NextResponse.json({ success: false, message: result.result?.message || '홈택스 조회 실패', code: result.result?.code }, { status: 400 })

    let saved = 0, skipped = 0
    for (const r of result.data) {
      const amount = parseInt(r.totalAmount || '0', 10)
      if (!amount) continue
      // approvalNo가 없으면 날짜+금액+업체명으로 고유 키 생성 (null 방지)
      const memoKey = r.approvalNo
        ? `현금영수증_${r.approvalNo}`
        : `현금영수증_${r.approvalDate}_${amount}_${(r.storeName ?? '').slice(0, 10)}`
      const { data: existing } = await supabaseAdmin.from('expenses').select('id').eq('user_id', userId).eq('memo', memoKey).maybeSingle()
      if (existing) { skipped++; continue }
      const { error } = await supabaseAdmin.from('expenses').insert({
        user_id: userId, receipt_date: fromYYYYMMDD(r.approvalDate), amount,
        vendor_name: r.storeName, business_number: r.storeBusinessNo?.replace(/-/g, '') || '',
        category: guessCategory(r.industryCategory || r.storeName),
        is_deductible: false, is_expense: true,
        deduction_reason: '현금영수증 자동 수집 (부가세공제 여부 별도 확인 필요)',
        import_source: 'codef_hometax', memo: memoKey,
      })
      if (!error) saved++
    }
    return NextResponse.json({ success: true, total: result.data.length, saved, skipped, message: `${saved}건 저장 완료! (중복 ${skipped}건 건너뜀)` })
  } catch (err) {
    console.error('[codef/hometax]', err)
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}

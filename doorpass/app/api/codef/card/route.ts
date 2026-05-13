import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCodefToken, codefRequest, guessCategory, fromYYYYMMDD } from '@/lib/codef'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { userId, serviceType, startDate, endDate } = await req.json()
    const organization = serviceType.replace('card_', '')
    const { data: conn } = await supabase.from('codef_connections').select('connected_id').eq('user_id', userId).eq('service_type', serviceType).single()
    if (!conn?.connected_id) return NextResponse.json({ success: false, message: '카드 계정이 연결되지 않았습니다.' }, { status: 400 })

    const token = await getCodefToken()
    const result = await codefRequest<{ data?: any[]; result: { code: string; message: string } }>(
      `/v1/kr/card/${organization}/p/account/approval-list`,
      { connectedId: conn.connected_id, organization, startDate, endDate, orderBy: '0', cardNo: '', memberStoreInfoType: '1' },
      token
    )

    if (result.result?.code !== 'CF-00000' || !result.data)
      return NextResponse.json({ success: false, message: result.result?.message || '카드 조회 실패', code: result.result?.code }, { status: 400 })

    let saved = 0, skipped = 0
    for (const t of result.data) {
      const amount = parseInt(t.useAmount || '0', 10)
      if (!amount) continue
      const memoKey = t.approvalNo ? `카드_${organization}_${t.approvalNo}` : `카드_${organization}_${t.useDate}_${amount}`
      const { data: existing } = await supabase.from('expenses').select('id').eq('user_id', userId).eq('memo', memoKey).maybeSingle()
      if (existing) { skipped++; continue }
      const { error } = await supabase.from('expenses').insert({
        user_id: userId, receipt_date: fromYYYYMMDD(t.useDate), amount,
        vendor_name: t.merchantName, business_number: t.merchantNo?.replace(/-/g, '') || '',
        category: guessCategory(t.merchantName),
        is_deductible: false, is_expense: true,
        deduction_reason: '카드 자동 수집 (부가세공제 여부 별도 확인 필요)',
        import_source: 'codef_card', memo: memoKey,
      })
      if (!error) saved++
    }
    return NextResponse.json({ success: true, total: result.data.length, saved, skipped, message: `${saved}건 저장 완료! (중복 ${skipped}건 건너뜀)` })
  } catch (err) {
    console.error('[codef/card]', err)
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 })
  }
}

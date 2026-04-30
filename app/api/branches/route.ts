import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('id, name, region, manager_email, manager_name')
      .order('name')

    if (error) {
      console.error('[branches] DB 오류:', error)
      return NextResponse.json({ branches: [] }, { status: 500 })
    }

    console.log('[branches] 조회 결과:', data?.length, '개')
    return NextResponse.json({ branches: data ?? [] })
  } catch (e) {
    console.error('[branches] 예외:', e)
    return NextResponse.json({ branches: [] }, { status: 500 })
  }
}

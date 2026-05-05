import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApi } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: admin, unauthorized } = await requireAdminApi()
    if (unauthorized) return unauthorized

    const { id } = await params
    const userId_int = Number(id)
    if (isNaN(userId_int)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = (await request.json()) as { blocked: boolean; reason?: string }
    const { blocked, reason } = body

    if (blocked && !reason?.trim()) {
      return NextResponse.json({ error: '차단 사유를 입력해주세요.' }, { status: 400 })
    }

    const { data: target, error: fetchErr } = await supabaseAdmin
      .from('approved_users')
      .select('id, name, email')
      .eq('id', userId_int)
      .single()

    if (fetchErr || !target) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    const updatePayload = blocked
      ? {
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason!.trim(),
          blocked_by: admin!.id,
        }
      : {
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
          blocked_by: null,
        }

    const { error: updateErr } = await supabaseAdmin
      .from('approved_users')
      .update(updatePayload)
      .eq('id', userId_int)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (blocked) {
      sendTelegramMessage(
        `🚫 사용자 차단\n이메일: ${target.email || target.name || String(userId_int)}\n사유: ${reason}`
      ).catch(console.error)
    }

    return NextResponse.json({ ok: true, blocked })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

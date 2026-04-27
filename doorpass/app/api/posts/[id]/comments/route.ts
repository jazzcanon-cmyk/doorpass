import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendSlackMessage } from '@/lib/slack'

const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { pathname } = new URL(request.url)
    const id = pathname.split('/api/posts/')[1]?.split('/')[0]
    const { content, author } = await request.json()

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })
    if (!id || id === 'undefined') return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: Number(id), content, author: author || '익명' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sendSlackMessage({ text: "💬 새 댓글", color: "#06b6d4", fields: [{ title: "내용", value: String(content || "").slice(0, 50), short: false }] }).catch(console.error)
    return NextResponse.json({ comment: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

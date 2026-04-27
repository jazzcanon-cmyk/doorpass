import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

const supabase = supabaseAdmin

export async function POST(
  _request: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const commentId = Number(params.commentId)
    if (isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 })
    }

    const userId = user!.id

    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle()

    let liked: boolean
    if (existing) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
      liked = false
    } else {
      await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: userId })
      liked = true
    }

    const { count } = await supabase
      .from('comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('comment_id', commentId)

    const like_count = count ?? 0

    await supabase
      .from('comments')
      .update({ like_count })
      .eq('id', commentId)

    return NextResponse.json({ liked, like_count })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

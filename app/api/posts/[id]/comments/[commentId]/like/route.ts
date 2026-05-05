import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'
import { logActivity, getIp } from '@/lib/activity-logger'

const supabase = supabaseAdmin

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const { commentId: commentIdParam } = await params
    const commentId = Number(commentIdParam)
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

    if (liked) {
      ;(async () => {
        const { data: commentData } = await supabase
          .from('comments')
          .select('content, post_id')
          .eq('id', commentId)
          .single()

        const { data: postData } = await supabase
          .from('posts')
          .select('title')
          .eq('id', commentData?.post_id)
          .single()

        await sendTelegramMessage(
          `❤️ 댓글에 좋아요!\n📝 게시글: ${postData?.title || '알 수 없음'}\n💬 댓글: ${String(commentData?.content || '').slice(0, 30)}...\n👤 좋아요 수: ${like_count}개`
        )
      })().catch(console.error)
    }

    logActivity(user!.email!, "like", { comment_id: commentId, liked }, getIp(request))
    return NextResponse.json({ liked, like_count })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

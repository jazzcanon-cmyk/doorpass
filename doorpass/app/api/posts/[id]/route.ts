import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route'

const supabase = supabaseAdmin

type Params = Promise<{ id: string }>

async function getCurrentUserId(): Promise<string | null> {
  try {
    const client = await createSupabaseRouteHandlerClient()
    const { data: { user } } = await client.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const [postResult, currentUserId] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, content, author, image_url, created_at, view_count, comments(id, content, author, created_at, like_count)')
        .eq('id', id)
        .maybeSingle(),
      getCurrentUserId(),
    ])

    const { data, error } = postResult
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const comments = (data.comments ?? []) as { id: number; like_count?: number | null; [key: string]: unknown }[]

    let likedSet = new Set<number>()
    if (currentUserId && comments.length > 0) {
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', comments.map((c) => c.id))
      if (likes) likedSet = new Set(likes.map((l: { comment_id: number }) => l.comment_id))
    }

    const post = {
      ...data,
      comments: comments.map((c) => ({
        ...c,
        like_count: c.like_count ?? 0,
        liked: likedSet.has(c.id),
      })),
    }

    return NextResponse.json({ post })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류 발생' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const { title, content } = await request.json()
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('posts')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류 발생' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    await supabase.from('comments').delete().eq('post_id', id)
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '오류 발생' }, { status: 500 })
  }
}

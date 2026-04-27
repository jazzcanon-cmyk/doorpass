import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabase = supabaseAdmin

type Params = Promise<{ id: string }>

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const { data, error } = await supabase
      .from('posts')
      .select('id, title, content, author, image_url, created_at, view_count, comments(id, content, author, created_at)')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    return NextResponse.json({ post: data })
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

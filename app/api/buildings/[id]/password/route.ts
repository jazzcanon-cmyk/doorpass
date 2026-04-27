// app/api/buildings/[id]/password/route.ts
// ============================================
// POST: 비밀번호 수정 (암호화 + 로깅)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { encryptPassword } from '@/lib/encryption';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const buildingId = params.id;

    // 1. 인증 확인
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 2. 요청 본문 파싱
    const { password } = await request.json();

    if (!password || password.trim() === '') {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 3. 비밀번호 암호화
    const encrypted_password = encryptPassword(password);

    // 4. 데이터베이스 업데이트
    const { data: updatedBuilding, error: updateError } = await supabase
      .from('buildings')
      .update({
        password_encrypted: encrypted_password,
        password_updated_at: new Date(),
      })
      .eq('id', buildingId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '비밀번호 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 5. 성공 응답
    return NextResponse.json({
      success: true,
      message: '✅ 비밀번호가 업데이트되었습니다.',
      building: {
        id: updatedBuilding.id,
        building_name: updatedBuilding.building_name,
        password_updated_at: updatedBuilding.password_updated_at,
      },
    });
  } catch (error) {
    console.error('❌ API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 수정 이력 조회 (지점장용)
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const buildingId = params.id;

    // 인증 확인
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 수정 이력 조회
    const { data: history, error } = await supabase
      .from('password_edit_history')
      .select('*')
      .eq('building_id', buildingId)
      .order('edited_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      history: history || [],
      total: history?.length || 0,
    });
  } catch (error) {
    console.error('❌ 이력 조회 오류:', error);
    return NextResponse.json(
      { error: '이력 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

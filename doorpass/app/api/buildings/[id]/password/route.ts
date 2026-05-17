import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, resolveUserEmail, lookupApprovedUser } from '@/lib/auth';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encryptPassword } from '@/lib/encryption';
import { trackActivity } from '@/lib/activity-tracker';
import { getIp } from '@/lib/activity-logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, unauthorized } = await requireAuth();
    if (unauthorized) return unauthorized;

    const approvedInfo = await lookupApprovedUser<{ role: string | null; branch_id: string | null }>(user!, "role, branch_id");
    const role = approvedInfo?.role as string | null;
    if (!role || !["admin", "sub_admin", "editor"].includes(role)) {
      return NextResponse.json(
        { error: '건물 정보 수정 권한이 없습니다. 설정에서 편집자 권한을 요청하세요.' },
        { status: 403 }
      );
    }
    const isManager = role === 'admin' || role === 'sub_admin';

    const { id: buildingId } = await params;

    // sub_admin은 자신의 대리점 건물만 수정 가능
    if (role === 'sub_admin') {
      const { data: building } = await supabaseAdmin
        .from('buildings')
        .select('branch_id')
        .eq('id', buildingId)
        .maybeSingle();
      if (building?.branch_id !== approvedInfo?.branch_id) {
        return NextResponse.json({ error: '다른 대리점 건물은 수정할 수 없습니다.' }, { status: 403 });
      }
    }

    const { password } = await request.json();

    const isEmpty = !password || password.trim() === '';
    if (!isManager && isEmpty) {
      return NextResponse.json(
        { error: '비밀번호 삭제는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const encrypted_password = isEmpty ? null : encryptPassword(password);
    const supabase = await createSupabaseRouteHandlerClient();

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
      console.error('[buildings/password:update] DB 오류:', (updateError as Error).message);
      return NextResponse.json({ error: '비밀번호 업데이트에 실패했습니다.' }, { status: 500 });
    }

    if (user) {
      void trackActivity({
        userEmail: resolveUserEmail(user!),
        actionType: 'password_update',
        targetInfo: {
          building_id: buildingId,
          building_name: updatedBuilding.name ?? null,
        },
        pageUrl: `/api/buildings/${buildingId}/password`,
        ipAddress: getIp(request),
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: '비밀번호가 업데이트되었습니다.',
      building: {
        id: updatedBuilding.id,
        name: updatedBuilding.name,
        password_updated_at: updatedBuilding.password_updated_at,
      },
    });
  } catch (error) {
    console.error('[buildings/password:update] 처리 실패:', (error as Error).message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { unauthorized } = await requireAuth();
    if (unauthorized) return unauthorized;

    const { id: buildingId } = await params;
    const supabase = await createSupabaseRouteHandlerClient();

    const { data: history, error } = await supabase
      .from('password_edit_history')
      .select('*')
      .eq('building_id', buildingId)
      .order('edited_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      history: history || [],
      total: history?.length || 0,
    });
  } catch (error) {
    console.error('[buildings/password:history] 조회 실패:', (error as Error).message);
    return NextResponse.json({ error: '이력 조회에 실패했습니다.' }, { status: 500 });
  }
}

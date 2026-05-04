import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canEditBuilding } from '@/lib/auth';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
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

    if (!(await canEditBuilding(user!.email))) {
      return NextResponse.json(
        { error: '건물 정보 수정 권한이 없습니다. 설정에서 편집자 권한을 요청하세요.' },
        { status: 403 }
      );
    }

    const { id: buildingId } = await params;
    const { password } = await request.json();

    const encrypted_password = (!password || password.trim() === '')
      ? null
      : encryptPassword(password);
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
      console.error('업데이트 오류:', updateError);
      return NextResponse.json({ error: '비밀번호 업데이트에 실패했습니다.' }, { status: 500 });
    }

    if (user?.email) {
      void trackActivity({
        userEmail: user.email,
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
    console.error('API 오류:', error);
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
    console.error('이력 조회 오류:', error);
    return NextResponse.json({ error: '이력 조회에 실패했습니다.' }, { status: 500 });
  }
}

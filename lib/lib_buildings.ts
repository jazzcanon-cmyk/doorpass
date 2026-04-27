// lib/buildings.ts
// ============================================
// 암호화된 비밀번호 처리 함수
// ============================================

import { supabase } from './supabase';
import { encryptPassword, decryptPassword } from './encryption';

/**
 * 비밀번호와 함께 건물 정보 저장 (암호화)
 */
export async function createBuilding(data: {
  building_name: string;
  address: string;
  latitude: number;
  longitude: number;
  password: string;  // 평문으로 받음
  added_by_user_id?: string;
}) {
  try {
    // 비밀번호 암호화
    const encrypted_password = encryptPassword(data.password);

    const { data: result, error } = await supabase
      .from('buildings')
      .insert([
        {
          building_name: data.building_name,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          password_encrypted: encrypted_password,  // ⚠️ 암호화된 값 저장
          added_by_user_id: data.added_by_user_id,
        },
      ])
      .select();

    if (error) throw error;
    return result?.[0];
  } catch (error) {
    console.error('❌ 건물 생성 오류:', error);
    throw error;
  }
}

/**
 * 비밀번호 수정 (암호화 + 로깅)
 */
export async function updateBuildingPassword(
  buildingId: string,
  newPassword: string,
  userId?: string
) {
  try {
    const encrypted_password = encryptPassword(newPassword);

    const { data: result, error } = await supabase
      .from('buildings')
      .update({
        password_encrypted: encrypted_password,
        password_updated_at: new Date(),
      })
      .eq('id', buildingId)
      .select();

    if (error) throw error;

    // ✅ 자동으로 password_edit_history 테이블에 기록됨 (트리거)
    console.log(`✅ 건물 ${buildingId}의 비밀번호가 변경되었습니다.`);
    
    return result?.[0];
  } catch (error) {
    console.error('❌ 비밀번호 수정 오류:', error);
    throw error;
  }
}

/**
 * 건물 조회 (비밀번호 복호화)
 */
export async function getBuilding(buildingId: string) {
  try {
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .eq('id', buildingId)
      .single();

    if (error) throw error;
    if (!data) return null;

    // 비밀번호 복호화
    if (data.password_encrypted) {
      data.password = decryptPassword(data.password_encrypted);
    }

    return data;
  } catch (error) {
    console.error('❌ 건물 조회 오류:', error);
    throw error;
  }
}

/**
 * 반경 내 건물 조회 (비밀번호 복호화)
 */
export async function getBuildingsNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number = 50
) {
  try {
    const { data, error } = await supabase
      .rpc('nearby_buildings', {
        lat: latitude,
        lon: longitude,
        radius: radiusMeters,
      });

    if (error) throw error;

    // 모든 건물의 비밀번호 복호화
    return (data || []).map((building: any) => {
      if (building.password_encrypted) {
        building.password = decryptPassword(building.password_encrypted);
      }
      return building;
    });
  } catch (error) {
    console.error('❌ 근처 건물 조회 오류:', error);
    throw error;
  }
}

/**
 * 건물 검색 (비밀번호 복호화)
 */
export async function searchBuildings(query: string) {
  try {
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .or(`building_name.ilike.%${query}%,address.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;

    // 모든 건물의 비밀번호 복호화
    return (data || []).map((building: any) => {
      if (building.password_encrypted) {
        building.password = decryptPassword(building.password_encrypted);
      }
      return building;
    });
  } catch (error) {
    console.error('❌ 검색 오류:', error);
    throw error;
  }
}

/**
 * 수정 이력 조회 (지점장용)
 */
export async function getPasswordEditHistory(buildingId: string) {
  try {
    const { data, error } = await supabase
      .from('password_edit_history')
      .select('*')
      .eq('building_id', buildingId)
      .order('edited_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ 이력 조회 오류:', error);
    throw error;
  }
}

/**
 * 모든 수정 이력 조회 (지점장용 - 감시)
 */
export async function getAllPasswordEditHistory() {
  try {
    const { data, error } = await supabase
      .from('password_edit_history')
      .select('*')
      .order('edited_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ 전체 이력 조회 오류:', error);
    throw error;
  }
}

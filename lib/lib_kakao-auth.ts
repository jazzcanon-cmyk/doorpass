// lib/kakao-auth.ts
// ============================================
// Kakao 로그인 & 신규 가입 관리
// ============================================

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface KakaoUser {
  id: string;
  kakao_account?: {
    profile?: {
      nickname: string;
      profile_image_url?: string;
    };
    email?: string;
    phone_number?: string;
  };
}

export interface NewUserSignupData {
  user_id: string;
  username: string;
  email?: string;
  phone_number?: string;
  profile_image_url?: string;
  kakao_id: string;
  signed_up_at: string;
  is_new_user: boolean;
}

/**
 * Kakao 로그인 처리 & 신규 가입 감지
 */
export async function handleKakaoLogin(kakaoUser: KakaoUser) {
  const supabase = createClientComponentClient();

  try {
    // 1. Kakao 사용자 정보 추출
    const kakaoId = kakaoUser.id;
    const username =
      kakaoUser.kakao_account?.profile?.nickname || `User_${kakaoId}`;
    const email = kakaoUser.kakao_account?.email;
    const phoneNumber = kakaoUser.kakao_account?.phone_number;
    const profileImageUrl =
      kakaoUser.kakao_account?.profile?.profile_image_url;

    // 2. Supabase에 사용자 저장 (Kakao 연동)
    const { data: userData, error: userError } = await supabase.auth.signInWithPassword(
      {
        email: email || `kakao_${kakaoId}@example.com`,
        password: `kakao_${kakaoId}_temp_password`, // 임시 비밀번호
      }
    );

    // 3. 신규 사용자 확인
    let isNewUser = false;

    if (userError?.status === 400) {
      // 사용자가 없음 → 신규 가입
      isNewUser = true;

      // 신규 사용자 생성
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: email || `kakao_${kakaoId}@example.com`,
        password: `kakao_${kakaoId}_temp_password`,
        options: {
          data: {
            username,
            kakao_id: kakaoId,
            is_kakao_login: true,
          },
        },
      });

      if (signupError) throw signupError;

      // 신규 사용자 정보 저장
      if (signupData.user) {
        await saveNewUserInfo({
          user_id: signupData.user.id,
          username,
          email: email,
          phone_number: phoneNumber,
          profile_image_url: profileImageUrl,
          kakao_id: kakaoId,
        });
      }
    } else if (!userError) {
      // 기존 사용자
      isNewUser = false;

      // 프로필 정보 업데이트
      if (userData?.user) {
        await updateUserProfile({
          user_id: userData.user.id,
          username,
          profile_image_url: profileImageUrl,
        });
      }
    } else {
      throw userError;
    }

    return {
      success: true,
      isNewUser,
      username,
      email: email || `kakao_${kakaoId}@example.com`,
    };
  } catch (error) {
    console.error('Kakao 로그인 오류:', error);
    throw error;
  }
}

/**
 * 신규 사용자 정보 저장
 */
async function saveNewUserInfo(userData: {
  user_id: string;
  username: string;
  email?: string;
  phone_number?: string;
  profile_image_url?: string;
  kakao_id: string;
}) {
  const supabase = createClientComponentClient();

  try {
    // drivers 테이블에 신규 사용자 저장
    const { error } = await supabase.from('drivers').insert([
      {
        id: userData.user_id,
        name: userData.username,
        email: userData.email,
        phone: userData.phone_number,
        profile_image_url: userData.profile_image_url,
        kakao_id: userData.kakao_id,
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      // 테이블이 없으면 auth.users 메타데이터에만 저장
      console.warn('drivers 테이블 저장 실패, 메타데이터만 저장:', error);
    }

    // 신규 가입 로그 저장
    await logNewSignup({
      user_id: userData.user_id,
      username: userData.username,
      email: userData.email,
      kakao_id: userData.kakao_id,
    });
  } catch (error) {
    console.error('신규 사용자 저장 실패:', error);
    throw error;
  }
}

/**
 * 기존 사용자 프로필 업데이트
 */
async function updateUserProfile(userData: {
  user_id: string;
  username: string;
  profile_image_url?: string;
}) {
  const supabase = createClientComponentClient();

  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        name: userData.username,
        profile_image_url: userData.profile_image_url,
        last_login: new Date().toISOString(),
      })
      .eq('id', userData.user_id);

    if (error) {
      console.warn('프로필 업데이트 실패:', error);
    }
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
  }
}

/**
 * 신규 가입 로그 저장
 */
async function logNewSignup(data: {
  user_id: string;
  username: string;
  email?: string;
  kakao_id: string;
}) {
  const supabase = createClientComponentClient();

  try {
    const { error } = await supabase.from('driver_signup_logs').insert([
      {
        user_id: data.user_id,
        username: data.username,
        email: data.email,
        kakao_id: data.kakao_id,
        signup_method: 'kakao',
        signed_up_at: new Date().toISOString(),
        ip_address: await getClientIp(),
      },
    ]);

    if (error) {
      console.warn('신규 가입 로그 저장 실패:', error);
    }
  } catch (error) {
    console.error('로그 저장 오류:', error);
  }
}

/**
 * 클라이언트 IP 주소 가져오기
 */
async function getClientIp(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

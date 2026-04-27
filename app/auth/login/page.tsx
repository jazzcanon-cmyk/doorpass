// app/auth/login/page.tsx (수정 버전)
// ============================================
// Kakao 로그인 + 신규 가입 알림
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NewSignupModal, NewSignupBanner } from '@/components/NewSignupModal';
import { handleKakaoLogin } from '@/lib/kakao-auth';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignupAlert, setShowSignupAlert] = useState(false);
  const [newUserData, setNewUserData] = useState<{
    username: string;
    email?: string;
  } | null>(null);

  // Kakao SDK 초기화
  useEffect(() => {
    // HTML에 <script> 태그로 Kakao SDK 로드
    // <script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
    if (window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_APP_ID || '');
    }
  }, []);

  // Kakao 로그인 핸들러
  const handleKakaoLoginClick = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!window.Kakao) {
        throw new Error('Kakao SDK가 로드되지 않았습니다.');
      }

      window.Kakao.Auth.login({
        scope: 'profile_image,profile_nickname,account_email,phone_number',
        success: async (authObj: any) => {
          try {
            // 사용자 정보 가져오기
            window.Kakao.API.request({
              url: '/v2/user/me',
              success: async (response: any) => {
                try {
                  // Kakao 로그인 처리
                  const result = await handleKakaoLogin(response);

                  if (result.isNewUser) {
                    // 신규 사용자 → 알림 표시
                    setNewUserData({
                      username: result.username,
                      email: result.email,
                    });
                    setShowSignupAlert(true);

                    // 2초 후 홈페이지로 이동
                    setTimeout(() => {
                      router.push('/');
                    }, 2000);
                  } else {
                    // 기존 사용자 → 바로 이동
                    router.push('/');
                  }
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : '로그인 처리 중 오류 발생'
                  );
                }
                setLoading(false);
              },
              fail: (error: any) => {
                setError('사용자 정보 조회 실패: ' + error.msg);
                setLoading(false);
              },
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : '로그인 처리 중 오류 발생');
            setLoading(false);
          }
        },
        fail: (error: any) => {
          setError('Kakao 로그인 실패: ' + error.msg);
          setLoading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
      {/* 신규 가입 알림 */}
      {showSignupAlert && newUserData && (
        <>
          {/* 모달 버전 (권장) */}
          <NewSignupModal
            isOpen={showSignupAlert}
            username={newUserData.username}
            email={newUserData.email}
            onClose={() => setShowSignupAlert(false)}
          />

          {/* 또는 배너 버전 (선택) */}
          {/* <NewSignupBanner
            isOpen={showSignupAlert}
            username={newUserData.username}
            onClose={() => setShowSignupAlert(false)}
          /> */}
        </>
      )}

      {/* 로그인 폼 */}
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          {/* 로고 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">🔑 DOORPASS</h1>
            <p className="text-muted-foreground text-sm mt-2">
              공동현관 비밀번호 조회 서비스
            </p>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Kakao 로그인 버튼 */}
          <button
            onClick={handleKakaoLoginClick}
            disabled={loading}
            className="w-full bg-[#FEE500] hover:bg-[#FDD835] disabled:opacity-50 disabled:cursor-not-allowed text-[#000000] font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                로그인 중...
              </>
            ) : (
              <>
                <span>🎯</span>
                카카오톡으로 로그인
              </>
            )}
          </button>

          {/* 정보 */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-2">ℹ️ 처음 방문하신가요?</p>
            <p>
              카카오톡으로 로그인하면 자동으로 계정이 생성되며, 신규 가입 축하 알림이 표시됩니다.
            </p>
          </div>

          {/* 보안 안내 */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>🔒 카카오톡 계정으로 안전하게 로그인합니다</p>
            <p className="mt-2">개인정보는 암호화되어 저장됩니다</p>
          </div>
        </div>
      </div>
    </main>
  );
}

// Kakao 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

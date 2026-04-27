// components/ProtectedDashboard.tsx
// ============================================
// 지점장 권한 확인 컴포넌트
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function withDashboardProtection<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // 현재 사용자 확인
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user) {
            router.push('/auth/login');
            return;
          }

          // 지점장 역할 확인 (현재는 모든 로그인 사용자 허용)
          // 나중에 role 기반으로 확인 가능
          setIsAuthorized(true);
        } catch (error) {
          console.error('권한 확인 실패:', error);
          router.push('/auth/login');
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, []);

    if (loading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">권한을 확인하는 중입니다...</p>
          </div>
        </div>
      );
    }

    if (!isAuthorized) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive font-semibold">
              접근 권한이 없습니다.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              지점장 이상의 권한이 필요합니다.
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

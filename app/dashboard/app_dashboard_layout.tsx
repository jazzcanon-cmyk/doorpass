// app/dashboard/layout.tsx
// ============================================
// 대시보드 레이아웃
// ============================================

import { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: '지점장 대시보드 - DOORPASS',
  description: '비밀번호 변경 이력 및 감시 로그 조회',
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* 상단 네비게이션 */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              🔑 DOORPASS
            </Link>
            <div className="flex gap-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                홈
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-foreground"
              >
                대시보드
              </Link>
            </div>
          </div>

          {/* 사용자 정보 (나중에 추가) */}
          <div className="text-sm text-muted-foreground">
            지점장
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      {children}
    </div>
  );
}

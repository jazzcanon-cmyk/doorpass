// components/NewSignupModal.tsx
// ============================================
// 신규 가입 축하 알림 모달
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface NewSignupModalProps {
  isOpen: boolean;
  username: string;
  email?: string;
  onClose: () => void;
}

export function NewSignupModal({
  isOpen,
  username,
  email,
  onClose,
}: NewSignupModalProps) {
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    setIsVisible(isOpen);
    if (isOpen) {
      // 5초 후 자동 닫기
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* 모달 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
          {/* 닫기 버튼 */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
          >
            <X size={20} />
          </button>

          {/* 콘텐츠 */}
          <div className="p-8 text-center">
            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4 animate-bounce">
                <CheckCircle2 size={48} className="text-green-600 dark:text-green-400" />
              </div>
            </div>

            {/* 제목 */}
            <h2 className="text-2xl font-bold mb-2">축하합니다! 🎉</h2>

            {/* 설명 */}
            <p className="text-muted-foreground mb-6">
              <span className="font-semibold text-foreground">{username}</span>님이
              <br />
              DOORPASS에 가입했습니다.
            </p>

            {/* 사용자 정보 */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">📧 이메일</span>
              </div>
              <p className="text-sm text-muted-foreground break-all">
                {email || 'Kakao 로그인'}
              </p>

              <div className="flex items-center gap-2 mb-2 mt-4">
                <span className="text-sm font-semibold">🔐 로그인 방식</span>
              </div>
              <p className="text-sm text-muted-foreground">카카오톡 계정</p>
            </div>

            {/* 팁 */}
            <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex gap-2">
                <AlertCircle size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    팁
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    앱의 모든 기능을 사용할 수 있습니다. 
                    설정에서 프로필을 완성해주세요.
                  </p>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <button
              onClick={handleClose}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 transition"
            >
              시작하기
            </button>

            {/* 하단 안내 */}
            <p className="text-xs text-muted-foreground mt-4">
              5초 후 자동으로 닫힙니다
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 간단한 버전: 알림 배너
 */
export function NewSignupBanner({
  isOpen,
  username,
  onClose,
}: {
  isOpen: boolean;
  username: string;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    setIsVisible(isOpen);
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right duration-200">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex gap-4">
        <div className="flex-shrink-0">
          <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-900 dark:text-green-100">
            축하합니다! 🎉
          </h3>
          <p className="text-sm text-green-800 dark:text-green-200">
            <span className="font-semibold">{username}</span>님이 DOORPASS에 가입했습니다.
          </p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            onClose();
          }}
          className="text-green-600 hover:text-green-700 dark:text-green-400"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

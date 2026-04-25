"use client"

import { useState, useEffect } from "react"
import { X, Download, Share } from "lucide-react"

export function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // 이미 설치된 경우 (standalone 모드)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // iOS 감지
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    setIsIOS(ios)

    // 이미 배너를 닫은 경우 하루 동안 안 보이게
    const dismissed = localStorage.getItem('pwa-banner-dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) return
    }

    if (ios) {
      // iOS는 beforeinstallprompt 없음 → 직접 배너 표시
      setTimeout(() => setShowBanner(true), 2000)
    } else {
      // Android/Chrome: beforeinstallprompt 이벤트 대기
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setTimeout(() => setShowBanner(true), 2000)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowBanner(false)
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString())
  }

  if (!showBanner || isInstalled) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-lg mx-auto bg-card border border-primary/50 rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          {/* 아이콘 */}
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" /><path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" /><path d="M9 9v.01" />
              <path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
            </svg>
          </div>

          {/* 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">도어패스 앱 추가</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              홈화면에 추가하면 앱처럼 바로 실행할 수 있어요!
            </p>

            {isIOS ? (
              // iOS 안내 (수동)
              <div className="mt-2 rounded-lg bg-secondary p-2.5">
                <p className="text-xs text-foreground font-medium mb-1">📱 iPhone 설치 방법</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Share className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span>하단 공유 버튼</span>
                  <span>→</span>
                  <span className="font-medium text-foreground">"홈 화면에 추가"</span>
                  <span>탭</span>
                </div>
              </div>
            ) : (
              // Android 설치 버튼
              <button
                onClick={handleInstall}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                홈화면에 추가
              </button>
            )}
          </div>

          {/* 닫기 */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Download, Share, Smartphone, ChevronRight } from "lucide-react"
import { toast } from "sonner"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type DeviceType = "android-chrome" | "ios-safari" | "samsung" | "other" | "installed" | "unknown"

function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "unknown"
  const ua = navigator.userAgent
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed"
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  if (isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return "ios-safari"
  if (/SamsungBrowser/i.test(ua)) return "samsung"
  if (/Android/i.test(ua) && /Chrome/i.test(ua) && !/Chromium|Edge|OPR|SamsungBrowser/i.test(ua)) return "android-chrome"
  return "other"
}

const DISMISS_KEY = "pwa-install-dismissed"

// ─── iOS 단계별 안내 모달 ─────────────────────────────────────────────────────

function IOSGuideModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: <Share className="h-6 w-6 text-blue-400" />,
      title: "공유 버튼 탭",
      desc: "화면 하단 가운데 공유(□↑) 버튼을 탭하세요",
    },
    {
      icon: <span className="text-2xl leading-none">＋</span>,
      title: "홈 화면에 추가",
      desc: '스크롤을 내려 "홈 화면에 추가"를 탭하세요',
    },
    {
      icon: <span className="text-2xl leading-none">✓</span>,
      title: "추가 탭",
      desc: '오른쪽 위 "추가"를 탭하면 설치 완료!',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-white">iPhone 홈 화면에 추가</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 단계 */}
        <div className="space-y-4 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white font-bold">
                {step.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="text-xs text-white/50 mt-0.5">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-white/20 ml-auto mt-3 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Safari 위치 힌트 */}
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 flex items-center gap-2">
          <Share className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-blue-300">
            Safari 브라우저 하단 중앙의{" "}
            <span className="font-bold text-white">□↑ 공유 버튼</span>을 찾으세요
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function PWAInstallPrompt() {
  const [device, setDevice] = useState<DeviceType>("unknown")
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [pushDismissed, setPushDismissed] = useState(false)

  // 푸시 배너 상태 동기화
  useEffect(() => {
    const sync = () => setPushDismissed(!!localStorage.getItem("push-banner-dismissed"))
    sync()
    const id = setInterval(sync, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const detected = detectDevice()
    setDevice(detected)

    // 이미 설치됐거나 이미 닫은 경우 종료
    if (detected === "installed") return
    if (localStorage.getItem(DISMISS_KEY)) return

    let timer: ReturnType<typeof setTimeout> | null = null

    if (detected === "ios-safari") {
      // iOS는 beforeinstallprompt 없음 → 5초 후 배너 표시
      timer = setTimeout(() => setShowBanner(true), 5000)
    } else if (detected === "android-chrome" || detected === "samsung") {
      // beforeinstallprompt 전역 캡처
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        timer = setTimeout(() => setShowBanner(true), 5000)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => {
        window.removeEventListener("beforeinstallprompt", handler)
        if (timer) clearTimeout(timer)
      }
    }
    // "other" 브라우저는 배너 미표시

    return () => { if (timer) clearTimeout(timer) }
  }, [])

  const handleInstall = useCallback(async () => {
    if (device === "ios-safari") {
      setShowIOSModal(true)
      return
    }
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        toast.success("🎉 설치 완료! 홈 화면에서 바로 실행하세요.")
        setShowBanner(false)
        setDevice("installed")
      }
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }, [device, deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    localStorage.setItem(DISMISS_KEY, "1")
  }, [])

  if (device === "installed" || !showBanner) return null

  const bannerBottom = pushDismissed ? "bottom-4" : "bottom-28"

  return (
    <>
      {/* 하단 배너 */}
      <div className={`fixed left-0 right-0 z-[100] p-3 transition-all duration-300 ${bannerBottom}`}>
        <div className="max-w-lg mx-auto bg-card border border-primary/50 rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            {/* 앱 아이콘 */}
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" /><path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" /><path d="M9 9v.01" />
                <path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" />
              </svg>
            </div>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">도어패스 앱 설치</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                홈 화면에 추가하면 앱처럼 바로 실행!
              </p>

              <div className="mt-2">
                {device === "ios-safari" ? (
                  <button
                    onClick={() => setShowIOSModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Share className="h-3.5 w-3.5" />
                    설치 방법 보기
                  </button>
                ) : device === "other" ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5" />
                    크롬 브라우저로 접속하면 설치할 수 있어요
                  </p>
                ) : (
                  <button
                    onClick={() => void handleInstall()}
                    disabled={installing}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {installing ? "설치 중..." : "홈 화면에 추가"}
                  </button>
                )}
              </div>
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

      {/* iOS 안내 모달 */}
      {showIOSModal && <IOSGuideModal onClose={() => setShowIOSModal(false)} />}
    </>
  )
}

'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface WelcomeDialogProps {
  open: boolean
  userName: string
  onClose: () => void
}

export function WelcomeDialog({ open, userName, onClose }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="bg-slate-900 border-white/10 text-white max-w-sm mx-auto p-0 overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-8 pb-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <DialogTitle className="text-xl font-bold text-white">
            DoorPass 가입을 환영합니다!
          </DialogTitle>
          <DialogDescription className="mt-2 text-blue-100 text-sm">
            안녕하세요, {userName}님!
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-white/70 text-sm leading-relaxed">
            공동현관 비밀번호 공유 서비스에 가입하셨습니다.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">📍 주요 기능</p>
            <ul className="space-y-1.5 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                내 위치 주변 건물 비밀번호 실시간 조회
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                지도에서 건물 검색
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                배달/택배 기사 전용 커뮤니티
              </li>
            </ul>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-400 mb-1">💡 처음 사용하시나요?</p>
            <p className="text-sm text-white/60 leading-relaxed">
              위치 권한을 허용하시면 주변 건물을 자동으로 찾아드립니다!
            </p>
          </div>

          <p className="text-xs text-white/40 text-center">
            문의사항은 게시판에 남겨주세요. 안전한 배달 되세요! 🚚
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            onClick={onClose}
            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-95"
          >
            시작하기 🚀
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

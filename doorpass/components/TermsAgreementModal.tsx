'use client'

import { useState } from 'react'
import { Shield, AlertTriangle, ExternalLink, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface TermsAgreementModalProps {
  onAgreed: () => void
}

export function TermsAgreementModal({ onAgreed }: TermsAgreementModalProps) {
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = termsChecked && purposeChecked

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/users/terms-check', { method: 'POST' })
      if (!res.ok) throw new Error('동의 저장 실패')
      onAgreed()
    } catch {
      toast.error('약관 동의 저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4'>
      <div className='w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl'>

        <div className='flex items-center gap-2 mb-4'>
          <Shield className='h-5 w-5 text-blue-400 shrink-0' />
          <h2 className='text-base font-bold text-white'>이용약관 동의</h2>
        </div>

        <div className='rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2 mb-5'>
          <AlertTriangle className='h-4 w-4 text-red-400 shrink-0 mt-0.5' />
          <p className='text-xs text-red-300 leading-relaxed'>
            서비스 이용 전 이용약관에 동의하셔야 합니다.
            비밀번호 정보는 <strong>배송 업무 목적으로만</strong> 사용해야 하며,
            위반 시 모든 법적 책임은 사용자 본인에게 있습니다.
          </p>
        </div>

        <div className='space-y-3 mb-5'>

          <div
            onClick={() => setTermsChecked((v) => !v)}
            className='flex items-center gap-3 p-3 rounded-xl cursor-pointer active:bg-white/10'
            style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
          >
            <div className={'h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ' +
              (termsChecked ? 'bg-blue-500 border-blue-500' : 'border-white/30 bg-white/5')}>
              {termsChecked && <Check className='h-4 w-4 text-white' strokeWidth={3} />}
            </div>
            <span className='text-sm text-white/80 leading-relaxed flex-1'>
              <a
                href='/terms'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-400 underline underline-offset-2 inline-flex items-center gap-0.5'
                onClick={(e) => e.stopPropagation()}
              >
                이용약관 <ExternalLink className='h-3 w-3' />
              </a>
              에 동의합니다.{' '}
              <span className='text-red-400 font-medium'>(필수)</span>
            </span>
          </div>

          <div
            onClick={() => setPurposeChecked((v) => !v)}
            className='flex items-center gap-3 p-3 rounded-xl cursor-pointer active:bg-white/10'
            style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
          >
            <div className={'h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ' +
              (purposeChecked ? 'bg-blue-500 border-blue-500' : 'border-white/30 bg-white/5')}>
              {purposeChecked && <Check className='h-4 w-4 text-white' strokeWidth={3} />}
            </div>
            <span className='text-sm text-white/80 leading-relaxed flex-1'>
              비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{' '}
              <span className='text-red-400 font-medium'>(필수)</span>
            </span>
          </div>

        </div>

        <button
          type='button'
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isSubmitting}
          style={{ minHeight: '52px', WebkitTapHighlightColor: 'transparent' }}
          className={'w-full rounded-xl text-white font-semibold text-base transition-all flex items-center justify-center gap-2 ' +
            (canSubmit && !isSubmitting
              ? 'bg-blue-600 active:bg-blue-700'
              : 'bg-slate-700 opacity-50 cursor-not-allowed')}
        >
          {isSubmitting
            ? <><Loader2 className='h-4 w-4 animate-spin' /> 처리 중...</>
            : '동의하고 시작하기'}
        </button>

        <p className='text-xs text-white/25 text-center mt-3'>
          동의하지 않으면 서비스를 이용할 수 없습니다.
        </p>

      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface TermsAgreementModalProps {
  onAgreed: () => void
}

export function TermsAgreementModal({ onAgreed }: TermsAgreementModalProps) {
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [loading, setLoading] = useState(false)

  const bothChecked = check1 && check2

  const handleSubmit = async () => {
    if (!bothChecked || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/users/terms-check', { method: 'POST' })
      if (!res.ok) throw new Error('저장 실패')

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { timeout: 5000, maximumAge: 0 }
        )
      }

      onAgreed()
    } catch {
      toast.error('다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* 제목 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>이용약관 동의</span>
        </div>

        {/* 경고 박스 */}
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: '#fca5a5', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
            ⚠️ 서비스 이용 전 약관에 동의하셔야 합니다. 비밀번호 정보는 <strong>배송 업무 목적으로만</strong> 사용해야 하며, 위반 시 법적 책임은 사용자 본인에게 있습니다.
          </p>
        </div>

        {/* 체크박스 1 */}
        <div
          onClick={() => setCheck1(!check1)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px',
            marginBottom: '10px',
            backgroundColor: check1 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
            border: check1 ? '1.5px solid #3b82f6' : '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              minWidth: '22px',
              borderRadius: '6px',
              backgroundColor: check1 ? '#3b82f6' : 'transparent',
              border: check1 ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
            }}
          >
            {check1 && <span style={{ color: 'white', fontSize: '14px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: '1.5' }}>
            <a
              href='/terms'
              target='_blank'
              rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#60a5fa', textDecoration: 'underline' }}
            >
              이용약관
            </a>
            에 동의합니다.{' '}
            <span style={{ color: '#f87171', fontWeight: 600 }}>(필수)</span>
          </span>
        </div>

        {/* 체크박스 2 */}
        <div
          onClick={() => setCheck2(!check2)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px',
            marginBottom: '20px',
            backgroundColor: check2 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
            border: check2 ? '1.5px solid #3b82f6' : '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              minWidth: '22px',
              borderRadius: '6px',
              backgroundColor: check2 ? '#3b82f6' : 'transparent',
              border: check2 ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '1px',
            }}
          >
            {check2 && <span style={{ color: 'white', fontSize: '14px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: '1.5' }}>
            비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{' '}
            <span style={{ color: '#f87171', fontWeight: 600 }}>(필수)</span>
          </span>
        </div>

        {/* 동의 버튼 */}
        <div
          onClick={() => void handleSubmit()}
          style={{
            width: '100%',
            minHeight: '52px',
            backgroundColor: bothChecked ? '#2563eb' : 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: bothChecked ? 'pointer' : 'not-allowed',
            color: bothChecked ? 'white' : 'rgba(255,255,255,0.3)',
            fontSize: '15px',
            fontWeight: 700,
            transition: 'all 0.2s',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {loading ? '✅ 동의 완료! 잠시 후 시작...' : '동의하고 시작하기'}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
          동의하지 않으면 서비스를 이용할 수 없습니다.
        </p>
      </div>
    </div>
  )
}

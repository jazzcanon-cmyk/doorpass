'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('ref')
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'used' | 'expired'>('checking')
  const [referrerName, setReferrerName] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    fetch('/api/users/referral/validate?token=' + token)
      .then((r) => r.json())
      .then((data: { valid: boolean; reason?: string; referrerName?: string }) => {
        if (data.valid) {
          setStatus('valid')
          setReferrerName(data.referrerName ?? '')
          sessionStorage.setItem('referral_token', token)
          setTimeout(() => router.push('/login'), 2000)
        } else if (data.reason === 'used') {
          setStatus('used')
        } else if (data.reason === 'expired') {
          setStatus('expired')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('invalid'))
  }, [token, router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A1628, #0D2144)',
      padding: '24px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '40px 32px',
        textAlign: 'center',
        maxWidth: '380px',
        width: '100%',
      }}>
        {status === 'checking' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>링크 확인 중...</div>
          </>
        )}
        {status === 'valid' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <div style={{ color: 'white', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              {referrerName ? referrerName + '님의 초대장' : '초대장'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
              가입하면 <span style={{ color: '#34d399', fontWeight: 700 }}>300P</span> 를 드려요!<br/>
              잠시 후 로그인 화면으로 이동합니다
            </div>
            <div style={{ color: '#60a5fa', fontSize: '13px' }}>⏳ 2초 후 자동 이동...</div>
          </>
        )}
        {status === 'used' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😅</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>이미 사용된 링크예요</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>추천 링크는 1회만 사용 가능해요</div>
            <div onClick={() => router.push('/login')} style={{ background: '#3b82f6', color: 'white', borderRadius: '12px', padding: '12px', cursor: 'pointer', fontWeight: 600 }}>
              그냥 가입하기
            </div>
          </>
        )}
        {status === 'expired' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>만료된 링크예요</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>추천 링크는 72시간 동안만 유효해요</div>
            <div onClick={() => router.push('/login')} style={{ background: '#3b82f6', color: 'white', borderRadius: '12px', padding: '12px', cursor: 'pointer', fontWeight: 600 }}>
              그냥 가입하기
            </div>
          </>
        )}
        {status === 'invalid' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>유효하지 않은 링크예요</div>
            <div onClick={() => router.push('/login')} style={{ background: '#3b82f6', color: 'white', borderRadius: '12px', padding: '12px', cursor: 'pointer', fontWeight: 600 }}>
              그냥 가입하기
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A1628' }} />}>
      <JoinContent />
    </Suspense>
  )
}

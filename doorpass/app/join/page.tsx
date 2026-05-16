'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('ref')
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'used' | 'expired'>('checking')
  const [referrerName, setReferrerName] = useState('')
  const [isKakaoInApp, setIsKakaoInApp] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsKakaoInApp(/KAKAOTALK|kakaoapp/i.test(ua))
    setIsAndroid(/Android/i.test(ua))
  }, [])

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    let timer: ReturnType<typeof setTimeout>

    fetch('/api/users/referral/validate?token=' + encodeURIComponent(token))
      .then((r) => r.json())
      .then((data: { valid: boolean; reason?: string; referrerName?: string }) => {
        if (data.valid) {
          setStatus('valid')
          setReferrerName(data.referrerName ?? '')
          // sessionStorage + localStorage 이중 저장 (인앱 → 외부 브라우저 전환 대비)
          try { sessionStorage.setItem('referral_token', token) } catch {}
          try { localStorage.setItem('referral_token', token) } catch {}
          timer = setTimeout(() => router.push('/login'), 2000)
        } else if (data.reason === 'used') {
          setStatus('used')
        } else if (data.reason === 'expired') {
          setStatus('expired')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('invalid'))

    return () => clearTimeout(timer)
  }, [token, router])

  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const chromeIntentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`

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
        {/* 카카오톡 인앱 브라우저 감지 배너 */}
        {isKakaoInApp && (
          <div style={{
            background: 'rgba(254,243,199,0.15)',
            border: '1px solid rgba(251,191,36,0.4)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            textAlign: 'left',
          }}>
            <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              ⚠️ 카카오톡 내부 브라우저 감지됨
            </div>
            {isAndroid ? (
              <a
                href={chromeIntentUrl}
                style={{
                  display: 'block',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginTop: '6px',
                }}
              >
                🌐 외부 브라우저로 열기
              </a>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: 1.6 }}>
                오른쪽 하단 <strong style={{ color: 'white' }}>···</strong> 버튼 →<br/>
                <strong style={{ color: 'white' }}>Safari로 열기</strong>를 눌러주세요
              </div>
            )}
          </div>
        )}

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
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '20px' }}>
              추천 링크는 72시간 동안만 유효해요<br/>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>새 링크를 요청해주세요</span>
            </div>
            <div onClick={() => router.push('/login')} style={{ background: '#3b82f6', color: 'white', borderRadius: '12px', padding: '12px', cursor: 'pointer', fontWeight: 600 }}>
              그냥 가입하기
            </div>
          </>
        )}
        {status === 'invalid' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              {!token ? '링크가 손상되었어요' : '유효하지 않은 링크예요'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '20px' }}>
              {!token
                ? '링크를 다시 받아 시도해주세요'
                : isKakaoInApp
                  ? '외부 브라우저에서 링크를 열면 해결될 수 있어요'
                  : '링크가 만료됐거나 잘못된 링크예요'}
            </div>
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

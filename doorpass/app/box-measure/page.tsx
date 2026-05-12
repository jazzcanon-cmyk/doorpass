'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_PRICES: Record<string, number> = {
  A: 4000,
  B: 5500,
  C: 7000,
  D: 8500,
  E: 10000,
  F: 12000,
  G: 15000,
}

const TYPE_RANGES: Record<string, string> = {
  A: '80cm 이하',
  B: '81~100cm',
  C: '101~120cm',
  D: '121~140cm',
  E: '141~160cm',
  F: '161~190cm',
  G: '191~220cm',
}

interface BoxResult {
  width: number
  depth: number
  height: number
  total: number
  type: string
  confidence: string
  note: string
}

async function compressImage(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const maxWidth = 1600
      const ratio = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      URL.revokeObjectURL(url)
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.src = url
  })
}

export default function BoxMeasurePage() {
  const router = useRouter()
  const frontInputRef = useRef<HTMLInputElement>(null)
  const sideInputRef = useRef<HTMLInputElement>(null)

  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [sideFile, setSideFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [sidePreview, setSidePreview] = useState<string | null>(null)
  const [referenceHeight, setReferenceHeight] = useState('')
  const [invoiceType, setInvoiceType] = useState('')
  const [result, setResult] = useState<BoxResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = (
    file: File,
    setter: (f: File) => void,
    previewSetter: (s: string) => void
  ) => {
    setter(file)
    previewSetter(URL.createObjectURL(file))
  }

  const handleMeasure = async () => {
    if (!frontFile || !sideFile) {
      toast.error('정면과 옆면 사진을 모두 선택해주세요')
      return
    }

    setLoading(true)
    try {
      const [front, side] = await Promise.all([
        compressImage(frontFile),
        compressImage(sideFile),
      ])

      const res = await fetch('/api/box-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontImageBase64: front.base64,
          frontMediaType: front.mediaType,
          sideImageBase64: side.base64,
          sideMediaType: side.mediaType,
          referenceHeight: referenceHeight ? Number(referenceHeight) : undefined,
        }),
      })

      const data = (await res.json()) as { data?: BoxResult; error?: string }
      if (!res.ok) {
        toast.error(data.error || '측정 실패')
        return
      }

      setResult(data.data!)
      toast.success('측정 완료!')
    } catch {
      toast.error('측정 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const confidenceColor = (c: string) =>
    c === '높음' ? '#10b981' : c === '보통' ? '#f59e0b' : '#ef4444'

  const typeDiff =
    result && invoiceType && invoiceType !== result.type
      ? (TYPE_PRICES[result.type] ?? 0) - (TYPE_PRICES[invoiceType] ?? 0)
      : null

  return (
    <div className='min-h-screen bg-slate-950 text-white'>
      {/* 헤더 */}
      <div className='flex items-center gap-3 px-4 py-4 border-b border-white/10'>
        <button onClick={() => router.back()} className='p-1 text-white/60 hover:text-white'>
          <ArrowLeft className='h-5 w-5' />
        </button>
        <h1 className='text-base font-bold'>📦 박스 사이즈 측정</h1>
      </div>

      <div className='px-4 py-5 space-y-4 max-w-lg mx-auto pb-12'>
        {/* 정면 사진 */}
        <div>
          <div className='text-xs text-white/50 mb-2 font-medium'>정면 사진 (가로·높이)</div>
          <input
            ref={frontInputRef}
            type='file'
            accept='image/*'
            capture='environment'
            className='hidden'
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f, setFrontFile, setFrontPreview)
            }}
          />
          <button
            onClick={() => frontInputRef.current?.click()}
            style={{
              width: '100%',
              minHeight: frontPreview ? 'auto' : '140px',
              borderRadius: '16px',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {frontPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={frontPreview}
                alt='정면'
                style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
              />
            ) : (
              <>
                <Camera className='h-8 w-8 text-white/30' />
                <span className='text-sm text-white/40'>정면 사진 촬영</span>
              </>
            )}
          </button>
          {frontPreview && (
            <button
              onClick={() => frontInputRef.current?.click()}
              className='mt-1.5 text-xs text-blue-400 hover:text-blue-300'
            >
              다시 찍기
            </button>
          )}
        </div>

        {/* 옆면 사진 */}
        <div>
          <div className='text-xs text-white/50 mb-2 font-medium'>옆면 사진 (세로)</div>
          <input
            ref={sideInputRef}
            type='file'
            accept='image/*'
            capture='environment'
            className='hidden'
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f, setSideFile, setSidePreview)
            }}
          />
          <button
            onClick={() => sideInputRef.current?.click()}
            style={{
              width: '100%',
              minHeight: sidePreview ? 'auto' : '140px',
              borderRadius: '16px',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              overflow: 'hidden',
              padding: 0,
            }}
          >
            {sidePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sidePreview}
                alt='옆면'
                style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
              />
            ) : (
              <>
                <Camera className='h-8 w-8 text-white/30' />
                <span className='text-sm text-white/40'>옆면 사진 촬영</span>
              </>
            )}
          </button>
          {sidePreview && (
            <button
              onClick={() => sideInputRef.current?.click()}
              className='mt-1.5 text-xs text-blue-400 hover:text-blue-300'
            >
              다시 찍기
            </button>
          )}
        </div>

        {/* 기준 높이 (선택) */}
        <div>
          <div className='text-xs text-white/50 mb-2 font-medium'>
            기준 높이 <span className='text-white/30'>(선택 · 입력 시 정확도 향상)</span>
          </div>
          <input
            type='number'
            value={referenceHeight}
            onChange={(e) => setReferenceHeight(e.target.value)}
            placeholder='박스 높이를 알면 입력 (cm)'
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 송장 타입 (선택) */}
        <div>
          <div className='text-xs text-white/50 mb-2 font-medium'>
            송장 타입 <span className='text-white/30'>(선택 · 비교용)</span>
          </div>
          <div className='grid grid-cols-7 gap-1.5'>
            {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setInvoiceType(invoiceType === t ? '' : t)}
                style={{
                  padding: '8px 0',
                  borderRadius: '10px',
                  background: invoiceType === t ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                  border: invoiceType === t
                    ? '1px solid #3b82f6'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: invoiceType === t ? 'white' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {invoiceType && (
            <div className='mt-1.5 text-xs text-white/30'>
              {invoiceType}타입 — {TYPE_RANGES[invoiceType]}
            </div>
          )}
        </div>

        {/* 측정 버튼 */}
        <button
          onClick={() => void handleMeasure()}
          disabled={loading || !frontFile || !sideFile}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            background:
              loading || !frontFile || !sideFile
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(135deg, #6366f1, #3b82f6)',
            border: 'none',
            color:
              loading || !frontFile || !sideFile ? 'rgba(255,255,255,0.3)' : 'white',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading || !frontFile || !sideFile ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow:
              !loading && frontFile && sideFile
                ? '0 4px 20px rgba(99,102,241,0.4)'
                : 'none',
          }}
        >
          {loading ? '🔍 분석 중...' : '📏 측정하기'}
        </button>

        {/* 결과 카드 */}
        {result && (
          <div
            style={{
              borderRadius: '20px',
              background: 'linear-gradient(160deg, #1a2744 0%, #0f172a 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 800,
                marginBottom: '16px',
                color: 'white',
              }}
            >
              📦 측정 결과
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {/* 치수 rows */}
              {(
                [
                  { label: '가로', value: result.width },
                  { label: '세로', value: result.depth },
                  { label: '높이', value: result.height },
                ] as const
              ).map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    {label}
                  </span>
                  <span
                    style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}
                  >
                    {value}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 400,
                        marginLeft: '2px',
                        color: 'rgba(255,255,255,0.5)',
                      }}
                    >
                      cm
                    </span>
                  </span>
                </div>
              ))}

              {/* 합계 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 600,
                  }}
                >
                  합계
                </span>
                <span
                  style={{ fontSize: '18px', fontWeight: 800, color: '#818cf8' }}
                >
                  {result.total}
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 400,
                      marginLeft: '2px',
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    cm
                  </span>
                </span>
              </div>

              {/* 타입 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      fontWeight: 600,
                    }}
                  >
                    CJ대한통운 타입
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: '2px',
                    }}
                  >
                    {TYPE_RANGES[result.type]}
                  </div>
                </div>
                <span
                  style={{ fontSize: '22px', fontWeight: 900, color: '#10b981' }}
                >
                  {result.type}타입 ✅
                </span>
              </div>

              {/* 신뢰도 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  신뢰도
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: confidenceColor(result.confidence),
                  }}
                >
                  {result.confidence}
                </span>
              </div>

              {/* 참고사항 */}
              {result.note && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.6,
                  }}
                >
                  💡 {result.note}
                </div>
              )}
            </div>

            {/* 송장 타입 불일치 경고 */}
            {invoiceType && invoiceType !== result.type && typeDiff !== null && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1.5px solid rgba(239,68,68,0.3)',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#fca5a5',
                    marginBottom: '6px',
                  }}
                >
                  ⚠️ 송장 타입 불일치
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: 1.6,
                  }}
                >
                  송장({invoiceType}타입) ≠ 실제({result.type}타입)
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.45)',
                    marginTop: '4px',
                  }}
                >
                  참고 요금 차액:{' '}
                  <span
                    style={{
                      color: typeDiff > 0 ? '#f87171' : '#34d399',
                      fontWeight: 700,
                    }}
                  >
                    {typeDiff > 0 ? '+' : ''}
                    {typeDiff.toLocaleString()}원
                  </span>
                  <span
                    style={{
                      marginLeft: '4px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    (지역·계약마다 상이)
                  </span>
                </div>
              </div>
            )}

            {/* 송장 타입 일치 */}
            {invoiceType && invoiceType === result.type && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  fontSize: '13px',
                  color: '#6ee7b7',
                  fontWeight: 600,
                }}
              >
                ✅ 송장 타입({invoiceType}타입)과 일치합니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface PointLog {
  id: number
  action: string
  points: number
  building_name: string | null
  created_at: string
}

interface PointData {
  total_points: number
  logs: PointLog[]
}

interface RankData {
  totalRank: number
  totalUsers: number
  branchRank: number
  branchUsers: number
}

const ACTION_LABEL: Record<string, string> = {
  building_name: '🏢 건물명 입력',
  building_password: '🔑 비밀번호 입력',
  building_memo: '📝 메모 입력',
  building_free_access: '🚪 자유출입 입력',
  building_elevator: '🛗 엘리베이터 정보',
  building_new: '✨ 새 건물 등록',
  referral_send: '🔗 친구 초대 보상',
  referral_receive: '🎉 추천 가입 보너스',
  exchange: '🎁 GS상품권 교환',
}

export default function MyPointsPage() {
  const router = useRouter()
  const [data, setData] = useState<PointData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'earn' | 'exchange'>('all')
  const [exchanging, setExchanging] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [remainingInvites, setRemainingInvites] = useState(3)
  const [rank, setRank] = useState<RankData | null>(null)
  const [cachedInviteUrl, setCachedInviteUrl] = useState<string | null>(null)
  const [isPreloading, setIsPreloading] = useState(false)

  useEffect(() => {
    document.title = '🏆 내 포인트 | DoorPass'
  }, [])

  useEffect(() => {
    fetch('/api/users/points')
      .then((r) => r.json())
      .then((d: PointData) => setData(d))
      .catch(() => toast.error('불러오기 실패'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/users/referral/remaining')
      .then((r) => r.json())
      .then((d: { remaining: number }) => setRemainingInvites(d.remaining ?? 3))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/users/points/rank')
      .then((r) => r.json())
      .then((d: RankData) => setRank(d))
      .catch(() => {})
  }, [])

  // 페이지 로드 시 초대 링크 미리 발급 (사용자 제스처 손실 방지)
  useEffect(() => {
    const preloadInviteUrl = async () => {
      if (isPreloading || cachedInviteUrl) return
      setIsPreloading(true)
      try {
        const res = await fetch('/api/users/referral/generate', { method: 'POST' })
        const data = await res.json()
        if (res.ok && data.url) setCachedInviteUrl(data.url as string)
      } catch {}
      finally {
        setIsPreloading(false)
      }
    }
    void preloadInviteUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInvite = async () => {
    if (remainingInvites === 0) {
      toast.error('오늘 초대 한도 완료 (3회)')
      return
    }
    let url = cachedInviteUrl
    if (!url) {
      setInviting(true)
      try {
        const res = await fetch('/api/users/referral/generate', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          toast.error((data as { error?: string }).error ?? '링크 생성 실패')
          return
        }
        url = data.url as string
      } catch {
        toast.error('링크 생성 실패')
        return
      } finally {
        setInviting(false)
      }
    }
    setCachedInviteUrl(null)
    setRemainingInvites((prev) => Math.max(0, prev - 1))
    if (remainingInvites > 1) {
      setTimeout(() => {
        fetch('/api/users/referral/generate', { method: 'POST' })
          .then((r) => r.json())
          .then((d) => {
            if (d.url) setCachedInviteUrl(d.url as string)
          })
          .catch(() => {})
      }, 1000)
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'DoorPass 초대장 🎁',
          text: '공동현관 비밀번호 앱 DoorPass! 가입하면 300P를 드려요 🎁',
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('링크가 복사됐어요! 카카오톡에 붙여넣기 하세요 📋')
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('링크 복사됐어요 📋')
      } catch {
        toast.error('공유 실패')
      }
    }
  }

  const handleExchange = async () => {
    if (!window.confirm('10,000P를 차감하고 GS상품권을 신청하시겠습니까?')) return
    setExchanging(true)
    try {
      const res = await fetch('/api/users/points/exchange', { method: 'POST' })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error || '교환 실패')
      toast.success('🎁 교환 신청 완료! 소장님이 확인 후 상품권을 전달해드려요.')
      const res2 = await fetch('/api/users/points')
      setData(await res2.json() as PointData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '교환 실패')
    } finally {
      setExchanging(false)
    }
  }

  const filteredLogs = (data?.logs ?? []).filter((l) => {
    if (tab === 'earn') return l.action !== 'exchange'
    if (tab === 'exchange') return l.action === 'exchange'
    return true
  })

  const groupByDate = (logs: PointLog[]) => {
    const groups: Record<string, PointLog[]> = {}
    logs.forEach((l) => {
      const date = l.created_at.slice(0, 10)
      if (!groups[date]) groups[date] = []
      groups[date].push(l)
    })
    return groups
  }

  const total = data?.total_points ?? 0
  const progress = Math.min((total / 10000) * 100, 100)
  const canExchange = total >= 10000

  const getRankEmoji = (r: number) => {
    if (r === 1) return '🥇'
    if (r === 2) return '🥈'
    if (r === 3) return '🥉'
    return '🏅'
  }

  if (loading) return (
    <div className='min-h-screen bg-slate-950 flex items-center justify-center'>
      <div className='text-white/50'>로딩 중...</div>
    </div>
  )

  return (
    <div className='min-h-screen bg-slate-950 text-white'>
      {/* 헤더 */}
      <div className='flex items-center gap-3 px-4 py-4 border-b border-white/10'>
        <button onClick={() => router.back()} className='p-1 text-white/60 hover:text-white'>
          <ArrowLeft className='h-5 w-5' />
        </button>
        <h1 className='text-base font-bold flex items-center gap-2'>
          🏆 내 포인트
        </h1>
      </div>

      {/* 포인트 요약 카드 */}
      <div style={{
        margin: '16px',
        borderRadius: '24px',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #1a2744 0%, #0f172a 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* 상단 포인트 + 랭킹 */}
        <div style={{ padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              🏆 누적 포인트
            </div>
            <div style={{
              fontSize: '48px',
              fontWeight: 900,
              color: 'white',
              lineHeight: 1,
              textShadow: '0 2px 20px rgba(245,158,11,0.4)',
              letterSpacing: '-1px',
            }}>
              {total.toLocaleString()}
              <span style={{ fontSize: '20px', fontWeight: 600, marginLeft: '4px', color: 'rgba(255,255,255,0.7)' }}>P</span>
            </div>
          </div>

          {/* 랭킹 뱃지 */}
          {rank && (
            <div style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: '10px 14px',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              minWidth: '80px',
            }}>
              <div style={{ fontSize: '24px', lineHeight: 1, marginBottom: '4px' }}>
                {rank.branchRank > 0 ? getRankEmoji(rank.branchRank) : '🏅'}
              </div>
              {rank.branchRank > 0 && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                  대리점 {rank.branchRank}위
                </div>
              )}
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                전체 {rank.totalRank > 0 ? rank.totalRank + '위' : '-'} / {rank.totalUsers}명
              </div>
            </div>
          )}
        </div>

        {/* 진행도 바 */}
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              borderRadius: '999px',
              height: '100%',
              width: Math.min(progress, 100) + '%',
              transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 0 12px rgba(245,158,11,0.6)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            {[2500, 5000, 7500, 10000].map((m) => (
              <div key={m} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: total >= m ? '#f59e0b' : 'rgba(255,255,255,0.2)' }}>
                  {total >= m ? '★' : '☆'}
                </div>
                <div style={{ fontSize: '9px', color: total >= m ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)', marginTop: '1px' }}>
                  {m >= 10000 ? '1만P' : (m / 1000) + '천P'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 교환 버튼 */}
        <div style={{ padding: '8px 20px 20px' }}>
          <button
            onClick={() => canExchange && void handleExchange()}
            disabled={!canExchange || exchanging}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '14px',
              background: canExchange
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'rgba(255,255,255,0.04)',
              color: canExchange ? 'white' : 'rgba(255,255,255,0.25)',
              border: canExchange ? 'none' : '1px solid rgba(255,255,255,0.08)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: canExchange ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: canExchange ? '0 4px 20px rgba(245,158,11,0.35)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {exchanging
              ? '⏳ 처리 중...'
              : canExchange
              ? '🎁 GS상품권 1만원 교환하기'
              : '🎁 ' + (10000 - total).toLocaleString() + 'P 더 모으면 교환 가능'}
          </button>
        </div>
      </div>

      {/* 친구 초대 */}
      <div className='mx-4 mt-3 bg-white/5 border border-white/10 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-3'>
          <div>
            <div className='text-sm font-bold text-white'>친구 초대하기 🔗</div>
            <div className='text-xs text-white/50 mt-0.5'>
              초대받은 친구 승인 시 나 +500P, 친구 +300P
            </div>
          </div>
          <div className='text-xs text-white/40 shrink-0 ml-3'>
            오늘 {3 - remainingInvites}/3회
          </div>
        </div>
        <button
          onClick={() => void handleInvite()}
          disabled={inviting || remainingInvites === 0}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: remainingInvites === 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
            color: remainingInvites === 0 ? 'rgba(255,255,255,0.3)' : 'white',
            border: 'none',
            fontSize: '15px',
            fontWeight: 700,
            cursor: remainingInvites === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {inviting ? '⏳ 링크 생성 중...' : remainingInvites === 0 ? '오늘 초대 한도 완료 (3/3)' : '🔗 카카오톡으로 초대 링크 보내기'}
        </button>
      </div>

      {/* 탭 */}
      <div className='flex gap-1 mx-4 mt-4 bg-white/5 rounded-xl p-1'>
        {([['all', '전체'], ['earn', '적립'], ['exchange', '교환']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ' +
              (tab === key ? 'bg-blue-500 text-white' : 'text-white/50 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {/* 이력 목록 */}
      <div className='px-4 mt-4 pb-8'>
        {filteredLogs.length === 0 ? (
          <div className='text-center py-12 text-white/30 text-sm'>이력이 없습니다</div>
        ) : (
          Object.entries(groupByDate(filteredLogs))
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, logs]) => (
              <div key={date} className='mb-4'>
                <div className='flex items-center gap-1.5 mb-2'>
                  <Calendar className='h-3 w-3 text-white/30' />
                  <span className='text-xs text-white/40'>{date}</span>
                </div>
                <div className='bg-white/5 rounded-xl overflow-hidden'>
                  {logs.map((log, i) => (
                    <div key={log.id} className={'flex justify-between items-center px-4 py-3 ' + (i < logs.length - 1 ? 'border-b border-white/5' : '')}>
                      <div>
                        <div className='text-sm text-white'>{ACTION_LABEL[log.action] ?? log.action}</div>
                        {log.building_name && <div className='text-xs text-white/40 mt-0.5'>{log.building_name}</div>}
                      </div>
                      <div className={'text-sm font-bold ' + (log.points < 0 ? 'text-red-400' : 'text-emerald-400')}>
                        {log.points > 0 ? '+' : ''}{log.points.toLocaleString()}P
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

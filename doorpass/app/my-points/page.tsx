'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Gift, Trophy, Calendar, Link2 } from 'lucide-react'
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
  const [todayInviteCount, setTodayInviteCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/users/points')
      .then((r) => r.json())
      .then((d: PointData) => setData(d))
      .catch(() => toast.error('불러오기 실패'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/users/referral/count')
      .then((r) => r.json())
      .then((d: { count: number }) => setTodayInviteCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  const handleInvite = async () => {
    setInviting(true)
    try {
      const res = await fetch('/api/users/referral/generate', { method: 'POST' })
      const d = await res.json() as { url?: string; error?: string }
      if (!res.ok) throw new Error(d.error || '링크 생성 실패')
      const referralUrl = d.url!
      setTodayInviteCount((c) => (c ?? 0) + 1)
      if (navigator.share) {
        await navigator.share({
          title: 'DoorPass 초대장',
          text: '공동현관 비밀번호 앱 DoorPass에 초대합니다! 가입하면 300P를 드려요 🎁',
          url: referralUrl,
        })
      } else {
        await navigator.clipboard.writeText(referralUrl)
        toast.success('링크가 복사됐어요! 카카오톡에 붙여넣기 해주세요 📋')
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        toast.error(e.message)
      }
    } finally {
      setInviting(false)
    }
  }

  const handleExchange = async () => {
    if (!window.confirm('10,000P를 차감하고 GS상품권을 신청하시겠습니까?')) return
    setExchanging(true)
    try {
      const res = await fetch('/api/users/points/exchange', { method: 'POST' })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error || '교환 실패')
      toast.success('🎁 GS상품권 교환 신청 완료! 소장님이 곧 전달해드릴게요.')
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
        <h1 className='text-base font-bold'>내 포인트</h1>
      </div>

      {/* 포인트 요약 카드 */}
      <div className='mx-4 mt-4 rounded-2xl p-5' style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
        <div className='flex items-center gap-2 mb-1'>
          <Trophy className='h-5 w-5 text-white' />
          <span className='text-sm text-white/80'>누적 포인트</span>
        </div>
        <div className='text-4xl font-black text-white mb-3'>{total.toLocaleString()}P</div>

        {/* 진행도 바 */}
        <div className='bg-white/20 rounded-full h-2 mb-1 overflow-hidden'>
          <div className='bg-white rounded-full h-2 transition-all duration-500' style={{ width: progress + '%' }} />
        </div>
        <div className='flex justify-between text-xs text-white/70 mb-3'>
          <span>0P</span>
          <span>{total.toLocaleString()} / 10,000P</span>
        </div>

        {/* 교환 버튼 */}
        <button
          onClick={() => void handleExchange()}
          disabled={!canExchange || exchanging}
          className={'w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ' +
            (canExchange ? 'bg-white text-amber-500 active:bg-white/90' : 'bg-white/20 text-white/40 cursor-not-allowed')}
        >
          <Gift className='h-4 w-4' />
          {exchanging ? '처리 중...' : canExchange ? 'GS상품권 교환하기 (10,000P)' : `${(10000 - total).toLocaleString()}P 더 모으면 교환 가능`}
        </button>
      </div>

      {/* 친구 초대 */}
      <div className='mx-4 mt-3 bg-white/5 border border-white/10 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-2'>
          <div>
            <div className='text-sm font-bold text-white'>친구 초대하기 🔗</div>
            <div className='text-xs text-white/50 mt-0.5'>
              초대받은 친구 승인 시 나 +500P, 친구 +300P
            </div>
          </div>
          {todayInviteCount !== null && (
            <div className='text-xs text-white/40 shrink-0 ml-3'>
              오늘 {todayInviteCount}/3회
            </div>
          )}
        </div>
        <button
          onClick={() => void handleInvite()}
          disabled={inviting || (todayInviteCount ?? 0) >= 3}
          className={'w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ' +
            ((todayInviteCount ?? 0) < 3 ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white' : 'bg-white/10 text-white/30 cursor-not-allowed')}
        >
          <Link2 className='h-4 w-4' />
          {inviting ? '생성 중...' : (todayInviteCount ?? 0) >= 3 ? '오늘 초대 한도 초과' : '카카오톡으로 초대 링크 보내기'}
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

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { shareToKakao, isKakaoShareReady } from '@/lib/kakao-share'

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

interface ExchangeRow {
  id: number
  user_email: string
  name: string | null
  points_used: number
  reward_type: string
  reward_name: string
  receive_method: 'visit' | 'mobile'
  status: 'pending' | 'completed' | 'rejected'
  admin_memo: string | null
  requested_at: string
  processed_at: string | null
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
  attendance_common_10: '🎯 출석 룰렛 (보통)',
  attendance_common_20: '🎯 출석 룰렛 (보통)',
  attendance_rare: '🎯 출석 룰렛 (레어)',
  attendance_epic: '🎯 출석 룰렛 (에픽)',
  attendance_jackpot: '🎯 출석 룰렛 (잭팟)',
  attendance_bonus_7day: '🔥 7일 연속 출석 보너스',
  attendance_bonus_30day: '🏆 30일 연속 출석 보너스',
}

interface AttendanceStats {
  consecutiveDays: number
  totalDays: number
  todayChecked: boolean
  monthDates: string[]
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
  const [inviteMemo, setInviteMemo] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [referrerName, setReferrerName] = useState<string>('친구')
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const exchangeMethod = 'mobile' as const
  const [myExchanges, setMyExchanges] = useState<ExchangeRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null)

  const refreshMyExchanges = () => {
    fetch('/api/users/points/exchange', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { exchanges?: ExchangeRow[] }) => setMyExchanges(d.exchanges ?? []))
      .catch(() => {})
  }
  useEffect(() => { refreshMyExchanges() }, [])

  useEffect(() => {
    fetch('/api/users/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { name?: string }) => {
        if (d?.name) setReferrerName(d.name)
      })
      .catch(() => {})
  }, [])

  // 메모 변경 시 기존 생성 링크 무효화 (다음 공유 클릭에서 새로 생성)
  useEffect(() => {
    setGeneratedUrl(null)
  }, [inviteMemo])

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

  useEffect(() => {
    fetch('/api/attendance/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: AttendanceStats) => setAttendance(d))
      .catch(() => {})
  }, [])

  // 초대 링크가 없으면 생성(invite 1회 차감), 있으면 캐시된 URL 반환.
  // 메모 변경 시 useEffect로 캐시가 비워지므로 다음 호출에서 새 메모로 재생성됨.
  const ensureLink = async (): Promise<string | null> => {
    if (generatedUrl) return generatedUrl
    if (remainingInvites === 0) {
      toast.error('오늘 초대 한도 완료 (3회)')
      return null
    }
    setInviting(true)
    try {
      const res = await fetch('/api/users/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: inviteMemo.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('링크 생성 실패')
        return null
      }
      const url = data.url as string
      setGeneratedUrl(url)
      setRemainingInvites((prev) => Math.max(0, prev - 1))
      return url
    } catch {
      toast.error('링크 생성 실패')
      return null
    } finally {
      setInviting(false)
    }
  }

  // Kakao SDK → navigator.share → clipboard 순서로 폴백
  const handleKakaoShare = async () => {
    const url = await ensureLink()
    if (!url) return

    if (isKakaoShareReady()) {
      const ok = shareToKakao({ referralUrl: url, referrerName })
      if (ok) {
        toast.success('카카오톡 공유 화면이 열렸어요 💬')
        return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'DoorPass 초대장 🎁',
          text: `${referrerName}님이 초대했어요! 가입하면 +300P`,
          url,
        })
        return
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success('링크가 복사됐어요 📋 카카오톡에 붙여넣기 하세요')
    } catch {
      toast.error('공유 실패')
    }
  }

  const handleCopyLink = async () => {
    const url = await ensureLink()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('링크가 복사됐어요 📋')
    } catch {
      toast.error('복사 실패')
    }
  }

  const submitExchange = async () => {
    setExchanging(true)
    try {
      const res = await fetch('/api/users/points/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiveMethod: exchangeMethod }),
      })
      const d = (await res.json()) as { error?: string; remainingPoints?: number }
      if (!res.ok) {
        toast.error(d.error || '교환 실패')
        return
      }
      toast.success('🎁 교환 신청 완료! 소장님 확인 후 처리됩니다.')
      setExchangeOpen(false)
      const res2 = await fetch('/api/users/points', { cache: 'no-store' })
      setData((await res2.json()) as PointData)
      refreshMyExchanges()
    } catch {
      toast.error('교환 실패')
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
            onClick={() => { if (canExchange) setExchangeOpen(true) }}
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

      {/* 출석 통계 */}
      {attendance && (
        <div className='mx-4 mt-3 bg-white/5 border border-white/10 rounded-2xl p-4'>
          <div className='flex items-center justify-between mb-3'>
            <div>
              <div className='text-sm font-bold text-white'>출석 체크 🎯</div>
              <div className='text-xs text-white/50 mt-0.5'>
                매일 룰렛으로 포인트 받아가세요
              </div>
            </div>
            {attendance.todayChecked ? (
              <span className='text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'>
                오늘 출석 완료
              </span>
            ) : (
              <span className='text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30'>
                오늘 미체크
              </span>
            )}
          </div>

          <div className='grid grid-cols-3 gap-2 mb-3'>
            <div className='bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center'>
              <div className='text-[11px] text-white/50 mb-1'>연속</div>
              <div className='text-xl font-extrabold text-amber-300'>
                🔥 {attendance.consecutiveDays}
              </div>
              <div className='text-[10px] text-white/40 mt-0.5'>일</div>
            </div>
            <div className='bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center'>
              <div className='text-[11px] text-white/50 mb-1'>총 출석</div>
              <div className='text-xl font-extrabold text-blue-300'>
                {attendance.totalDays}
              </div>
              <div className='text-[10px] text-white/40 mt-0.5'>일</div>
            </div>
            <div className='bg-white/[0.04] border border-white/10 rounded-xl p-3 text-center'>
              <div className='text-[11px] text-white/50 mb-1'>다음 보너스</div>
              <div className='text-xl font-extrabold text-purple-300'>
                D-{Math.max(1, 7 - (attendance.consecutiveDays % 7 || 7))}
              </div>
              <div className='text-[10px] text-white/40 mt-0.5'>+200P</div>
            </div>
          </div>

          {/* 이번 달 출석 캘린더 */}
          <div>
            <div className='text-[11px] text-white/50 mb-1.5'>
              이번 달 출석
            </div>
            <div className='grid grid-cols-7 gap-1'>
              {(() => {
                const now = new Date()
                const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
                const year = kst.getUTCFullYear()
                const month = kst.getUTCMonth()
                const firstDay = new Date(Date.UTC(year, month, 1))
                const startWeekday = firstDay.getUTCDay()
                const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
                const set = new Set(attendance.monthDates)
                const todayStr = kst.toISOString().split('T')[0]
                const cells: { day: number; iso: string; checked: boolean; isToday: boolean }[] = []
                for (let i = 0; i < startWeekday; i++) {
                  cells.push({ day: 0, iso: '', checked: false, isToday: false })
                }
                for (let d = 1; d <= daysInMonth; d++) {
                  const iso = new Date(Date.UTC(year, month, d)).toISOString().split('T')[0]
                  cells.push({
                    day: d,
                    iso,
                    checked: set.has(iso),
                    isToday: iso === todayStr,
                  })
                }
                return cells.map((c, i) => (
                  <div
                    key={i}
                    className={
                      'aspect-square rounded-md flex items-center justify-center text-[11px] font-medium ' +
                      (c.day === 0
                        ? ''
                        : c.checked
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                          : c.isToday
                            ? 'bg-blue-500/15 text-blue-200 border border-blue-400/40'
                            : 'bg-white/[0.03] text-white/30 border border-white/5')
                    }
                  >
                    {c.day === 0 ? '' : c.checked ? '✓' : c.day}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

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
        <input
          type='text'
          value={inviteMemo}
          onChange={(e) => setInviteMemo(e.target.value.slice(0, 50))}
          placeholder='예: DoorPass 김기사 (선택사항)'
          maxLength={50}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
            fontSize: '13px',
            marginBottom: '10px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => void handleKakaoShare()}
            disabled={inviting || (remainingInvites === 0 && !generatedUrl)}
            style={{
              flex: 2,
              padding: '14px',
              borderRadius: '12px',
              background:
                remainingInvites === 0 && !generatedUrl
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #FEE500, #FFCD00)',
              color:
                remainingInvites === 0 && !generatedUrl
                  ? 'rgba(255,255,255,0.3)'
                  : '#3B1E1E',
              border: 'none',
              fontSize: '15px',
              fontWeight: 700,
              cursor:
                remainingInvites === 0 && !generatedUrl ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {inviting
              ? '⏳ 생성 중...'
              : remainingInvites === 0 && !generatedUrl
                ? '오늘 한도 완료 (3/3)'
                : '💬 카카오톡으로 공유'}
          </button>
          <button
            onClick={() => void handleCopyLink()}
            disabled={inviting || (remainingInvites === 0 && !generatedUrl)}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              background:
                remainingInvites === 0 && !generatedUrl
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.1)',
              color:
                remainingInvites === 0 && !generatedUrl
                  ? 'rgba(255,255,255,0.3)'
                  : 'white',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '14px',
              fontWeight: 600,
              cursor:
                remainingInvites === 0 && !generatedUrl ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            🔗 링크 복사
          </button>
        </div>
      </div>

      {/* 교환 이력 */}
      {myExchanges.length > 0 && (
        <div className='mx-4 mt-3 bg-white/5 border border-white/10 rounded-2xl p-4'>
          <div className='text-sm font-bold text-white mb-2'>🎁 내 교환 이력</div>
          <div className='space-y-2'>
            {myExchanges.slice(0, 10).map((ex) => {
              const date = new Date(ex.requested_at).toLocaleDateString('ko-KR', {
                year: '2-digit', month: '2-digit', day: '2-digit',
              })
              const methodLabel = ex.receive_method === 'mobile' ? '모바일' : '방문'
              const statusBadge =
                ex.status === 'completed' ? (
                  <span className='text-xs text-emerald-400'>✅ 지급완료</span>
                ) : ex.status === 'rejected' ? (
                  <span className='text-xs text-red-400'>❌ 반려</span>
                ) : (
                  <span className='text-xs text-amber-400'>⏳ 처리중</span>
                )
              return (
                <div
                  key={ex.id}
                  className='flex items-start justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2'
                >
                  <div className='min-w-0 flex-1'>
                    <div className='text-xs text-white'>{ex.reward_name}</div>
                    <div className='text-[11px] text-white/40 mt-0.5'>
                      {date} · {methodLabel} · -{ex.points_used.toLocaleString()}P
                    </div>
                    {ex.status === 'rejected' && (
                      <div className='text-[11px] text-emerald-400/80 mt-0.5'>
                        포인트 환불됨{ex.admin_memo ? ` (${ex.admin_memo})` : ''}
                      </div>
                    )}
                  </div>
                  {statusBadge}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* 교환 신청 모달 */}
      {exchangeOpen && (
        <div
          onClick={() => !exchanging && setExchangeOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '380px',
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '24px',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px' }}>
              🎁 GS상품권 교환
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '18px' }}>
              GS상품권 1만원권 (10,000P 차감)
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 14px', borderRadius: '10px', marginBottom: '20px',
              border: '1px solid rgba(245,158,11,0.4)',
              background: 'rgba(245,158,11,0.08)',
              fontSize: '14px', color: 'rgba(255,255,255,0.85)',
            }}>
              📱 모바일 상품권 (카카오)으로 발송됩니다
            </div>

            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '16px',
              lineHeight: 1.6,
            }}>
              · 신청 후 관리자가 확인하여 상품권을 전달해 드립니다.<br />
              · 반려 시 차감된 10,000P는 자동 환불됩니다.<br />
              · 처리 중인 신청이 있으면 추가 신청이 불가합니다.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setExchangeOpen(false)}
                disabled={exchanging}
                style={{
                  flex: 1, padding: '13px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', fontWeight: 600, fontSize: '14px',
                  cursor: exchanging ? 'not-allowed' : 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (window.confirm('10,000P를 사용하여 GS상품권을 신청할까요?')) {
                    void submitExchange()
                  }
                }}
                disabled={exchanging}
                style={{
                  flex: 1, padding: '13px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', color: 'white', fontWeight: 700, fontSize: '14px',
                  cursor: exchanging ? 'not-allowed' : 'pointer',
                }}
              >
                {exchanging ? '⏳ 처리 중...' : '신청하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

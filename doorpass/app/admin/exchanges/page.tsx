'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
  processed_by: string | null
}

const STATUS_LABEL: Record<ExchangeRow['status'], string> = {
  pending: '⏳ 처리 중',
  completed: '✅ 지급 완료',
  rejected: '❌ 반려',
}

const METHOD_LABEL: Record<ExchangeRow['receive_method'], string> = {
  visit: '사무실 방문',
  mobile: '모바일 상품권',
}

export default function AdminExchangesPage() {
  const [rows, setRows] = useState<ExchangeRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending')
  const [rejectMemoFor, setRejectMemoFor] = useState<number | null>(null)
  const [rejectMemo, setRejectMemo] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/admin/exchanges', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { exchanges?: ExchangeRow[]; pendingCount?: number }) => {
        setRows(d.exchanges ?? [])
        setPendingCount(d.pendingCount ?? 0)
      })
      .catch(() => toast.error('목록을 불러오지 못했어요.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const approve = async (id: number) => {
    if (!window.confirm('지급 완료로 처리할까요?')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/exchanges/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const d = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(d.error)
      toast.success('지급 완료 처리됨')
      load()
    } catch (e) {
      toast.error((e as Error).message || '처리 실패')
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (id: number) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/exchanges/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', memo: rejectMemo.trim() || undefined }),
      })
      const d = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(d.error)
      toast.success('반려 처리됨 (포인트 환불 완료)')
      setRejectMemoFor(null)
      setRejectMemo('')
      load()
    } catch (e) {
      toast.error((e as Error).message || '처리 실패')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter)

  return (
    <div className='min-h-screen bg-slate-950 text-white'>
      <div className='border-b border-white/10 px-4 py-4'>
        <h1 className='text-base font-bold flex items-center gap-2'>
          🎁 상품권 교환 관리
          {pendingCount > 0 && (
            <span className='inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold'>
              {pendingCount}
            </span>
          )}
        </h1>
      </div>

      <div className='flex gap-1 mx-4 mt-4 bg-white/5 rounded-xl p-1'>
        {(['pending', 'completed', 'rejected', 'all'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ' +
              (filter === key ? 'bg-blue-500 text-white' : 'text-white/50 hover:text-white')
            }
          >
            {key === 'all' ? '전체' : key === 'pending' ? '처리중' : key === 'completed' ? '완료' : '반려'}
          </button>
        ))}
      </div>

      <div className='px-4 mt-4 pb-8 space-y-3'>
        {loading ? (
          <div className='text-center py-12 text-white/30 text-sm'>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className='text-center py-12 text-white/30 text-sm'>해당 상태의 신청이 없습니다.</div>
        ) : (
          filtered.map((r) => {
            const requested = new Date(r.requested_at).toLocaleString('ko-KR')
            const processed = r.processed_at ? new Date(r.processed_at).toLocaleString('ko-KR') : null
            return (
              <div
                key={r.id}
                className='bg-white/5 border border-white/10 rounded-xl p-4'
              >
                <div className='flex items-start justify-between gap-2 mb-2'>
                  <div className='min-w-0 flex-1'>
                    <div className='text-sm font-bold text-white truncate'>
                      {r.name ?? '-'} <span className='text-white/40 font-normal'>({r.user_email})</span>
                    </div>
                    <div className='text-xs text-white/50 mt-0.5'>
                      {r.reward_name} · {METHOD_LABEL[r.receive_method]} · -{r.points_used.toLocaleString()}P
                    </div>
                  </div>
                  <span className={
                    'text-xs font-medium whitespace-nowrap ' +
                    (r.status === 'pending' ? 'text-amber-400'
                     : r.status === 'completed' ? 'text-emerald-400'
                     : 'text-red-400')
                  }>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div className='text-[11px] text-white/40'>
                  신청: {requested}
                  {processed && <> · 처리: {processed}{r.processed_by ? ` (${r.processed_by})` : ''}</>}
                </div>
                {r.admin_memo && (
                  <div className='mt-2 text-[11px] text-white/60 bg-white/5 rounded-md px-2 py-1'>
                    메모: {r.admin_memo}
                  </div>
                )}

                {r.status === 'pending' && (
                  <div className='mt-3'>
                    {rejectMemoFor === r.id ? (
                      <div className='space-y-2'>
                        <input
                          type='text'
                          value={rejectMemo}
                          onChange={(e) => setRejectMemo(e.target.value.slice(0, 200))}
                          placeholder='반려 사유 (선택)'
                          className='w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none'
                        />
                        <div className='flex gap-2'>
                          <button
                            onClick={() => { setRejectMemoFor(null); setRejectMemo('') }}
                            disabled={busyId === r.id}
                            className='flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70'
                          >
                            취소
                          </button>
                          <button
                            onClick={() => void reject(r.id)}
                            disabled={busyId === r.id}
                            className='flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-xs font-bold'
                          >
                            {busyId === r.id ? '처리 중...' : '반려 확정 (환불)'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className='flex gap-2'>
                        <button
                          onClick={() => void approve(r.id)}
                          disabled={busyId === r.id}
                          className='flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-xs font-bold'
                        >
                          {busyId === r.id ? '처리 중...' : '✅ 지급 완료'}
                        </button>
                        <button
                          onClick={() => setRejectMemoFor(r.id)}
                          disabled={busyId === r.id}
                          className='flex-1 py-2 rounded-lg bg-white/5 border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/10'
                        >
                          반려
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

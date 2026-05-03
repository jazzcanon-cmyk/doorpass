'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Users, Building2, TrendingUp, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

interface DashboardStats {
  userCount: number
  buildingCount: number
  pendingApprovals: number
  recentUploads: number
}

interface Approval {
  id: number
  user_email: string
  user_name: string
  selected_branch_id: string
  requested_at: string
  branches?: { name?: string; region?: string } | null
}

export default function SubAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ userCount: 0, buildingCount: 0, pendingApprovals: 0, recentUploads: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [showApprovals, setShowApprovals] = useState(false)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/sub-admin/stats')
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.stats) {
        setStats((prev) => ({ ...prev, ...data.stats }))
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error('통계 조회 실패:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    try {
      const res = await fetch('/api/admin/pending-approvals')
      const data = await res.json().catch(() => ({}))
      setApprovals(data.approvals ?? [])
    } catch (e) {
      console.error('승인 목록 조회 실패:', e)
    } finally {
      setApprovalsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
    const interval = setInterval(() => void fetchStats(), 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const handleApprovalToggle = async () => {
    const next = !showApprovals
    setShowApprovals(next)
    if (next && approvals.length === 0) {
      await fetchApprovals()
    }
  }

  const handleApprove = async (approvalId: number, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve' ? '승인하시겠습니까?' : '거부하시겠습니까?')) return
    setProcessingId(approvalId)
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, action }),
      })
      if (!res.ok) throw new Error('처리 실패')
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId))
      setStats((prev) => ({ ...prev, pendingApprovals: Math.max(0, prev.pendingApprovals - 1) }))
      alert(action === 'approve' ? '✅ 승인 완료!' : '❌ 거부 완료')
    } catch {
      alert('처리 중 오류가 발생했습니다')
    } finally {
      setProcessingId(null)
    }
  }

  if (isLoading) return (
    <div className='flex items-center justify-center p-12'>
      <RefreshCw className='h-6 w-6 animate-spin text-blue-500' />
    </div>
  )

  return (
    <div className='p-4 md:p-6 max-w-4xl'>
      {/* 헤더 */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold'>대시보드</h1>
          <p className='text-sm text-muted-foreground mt-0.5'>
            {lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') + ' 업데이트' : '로딩 중...'}
          </p>
        </div>
        <button
          onClick={() => void fetchStats()}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <RefreshCw className='h-4 w-4' />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mb-6'>

        {/* 총 회원 */}
        <Link href='/sub-admin/users' className='bg-card border rounded-xl p-4 hover:border-blue-500 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <Users className='h-4 w-4 text-blue-500' />
            <p className='text-xs text-muted-foreground font-medium'>총 회원</p>
          </div>
          <p className='text-2xl font-bold'>{stats.userCount}<span className='text-sm font-normal text-muted-foreground ml-1'>명</span></p>
        </Link>

        {/* 등록 건물 */}
        <Link href='/sub-admin/buildings' className='bg-card border rounded-xl p-4 hover:border-green-500 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <Building2 className='h-4 w-4 text-green-500' />
            <p className='text-xs text-muted-foreground font-medium'>등록 건물</p>
          </div>
          <p className='text-2xl font-bold'>{stats.buildingCount.toLocaleString()}<span className='text-sm font-normal text-muted-foreground ml-1'>개</span></p>
        </Link>

        {/* 승인 대기 - 클릭 시 펼침 */}
        <button
          onClick={() => void handleApprovalToggle()}
          className={'bg-card border rounded-xl p-4 text-left transition-all w-full ' +
            (stats.pendingApprovals > 0
              ? 'border-yellow-400 hover:border-yellow-500 cursor-pointer'
              : 'hover:border-gray-400 cursor-pointer')}
        >
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <Clock className={'h-4 w-4 ' + (stats.pendingApprovals > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
              <p className='text-xs text-muted-foreground font-medium'>승인 대기</p>
            </div>
            {showApprovals ? <ChevronUp className='h-3 w-3 text-muted-foreground' /> : <ChevronDown className='h-3 w-3 text-muted-foreground' />}
          </div>
          <div className='flex items-end gap-2'>
            <p className={'text-2xl font-bold ' + (stats.pendingApprovals > 0 ? 'text-yellow-500' : '')}>
              {stats.pendingApprovals}
            </p>
            <span className='text-sm text-muted-foreground mb-0.5'>건</span>
            {stats.pendingApprovals > 0 && (
              <span className='text-xs text-yellow-500 mb-0.5 font-medium'>▼ 클릭하여 승인</span>
            )}
          </div>
        </button>

        {/* 이번 달 업로드 */}
        <Link href='/sub-admin/upload' className='bg-card border rounded-xl p-4 hover:border-purple-500 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <TrendingUp className='h-4 w-4 text-purple-500' />
            <p className='text-xs text-muted-foreground font-medium'>이번 달 업로드</p>
          </div>
          <p className='text-2xl font-bold'>{stats.recentUploads}<span className='text-sm font-normal text-muted-foreground ml-1'>개</span></p>
        </Link>

      </div>

      {/* 승인 대기 목록 (펼침) */}
      {showApprovals && (
        <div className='mb-6 border rounded-xl overflow-hidden'>
          <div className='bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Clock className='h-4 w-4 text-yellow-500' />
              <span className='font-semibold text-sm'>승인 대기 목록</span>
              <span className='text-xs bg-yellow-500 text-white rounded-full px-2 py-0.5 font-bold'>{approvals.length}</span>
            </div>
            <button
              onClick={() => void fetchApprovals()}
              className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
            >
              <RefreshCw className='h-3 w-3' /> 새로고침
            </button>
          </div>

          {approvalsLoading ? (
            <div className='p-8 text-center text-muted-foreground text-sm'>
              <RefreshCw className='h-5 w-5 animate-spin mx-auto mb-2' />
              로딩 중...
            </div>
          ) : approvals.length === 0 ? (
            <div className='p-8 text-center text-muted-foreground text-sm'>
              ✅ 승인 대기 중인 요청이 없습니다
            </div>
          ) : (
            <div className='divide-y'>
              {approvals.map((approval) => (
                <div key={approval.id} className='p-4 flex items-center justify-between gap-4 hover:bg-muted/30'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <span className='font-semibold text-sm truncate'>
                        {approval.user_name || '이름 미입력'}
                      </span>
                      <span className='text-xs bg-blue-500/10 text-blue-400 rounded px-1.5 py-0.5 shrink-0'>
                        {approval.branches?.name ?? approval.selected_branch_id}
                      </span>
                    </div>
                    <p className='text-xs text-muted-foreground truncate'>{approval.user_email}</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {new Date(approval.requested_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className='flex gap-2 shrink-0'>
                    <button
                      onClick={() => void handleApprove(approval.id, 'approve')}
                      disabled={processingId === approval.id}
                      className='flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                    >
                      <CheckCircle2 className='h-3.5 w-3.5' />
                      승인
                    </button>
                    <button
                      onClick={() => void handleApprove(approval.id, 'reject')}
                      disabled={processingId === approval.id}
                      className='flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                    >
                      <XCircle className='h-3.5 w-3.5' />
                      거부
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 빠른 실행 */}
      <div className='bg-card border rounded-xl p-4'>
        <h2 className='font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wide'>빠른 실행</h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          <Link href='/sub-admin/users' className='p-3 border-2 border-dashed rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3'>
            <Users className='h-5 w-5 text-blue-500 shrink-0' />
            <div>
              <p className='font-bold text-sm'>회원 관리</p>
              <p className='text-xs text-muted-foreground'>회원 조회 및 권한 변경</p>
            </div>
          </Link>
          <Link href='/sub-admin/buildings' className='p-3 border-2 border-dashed rounded-lg hover:border-green-500 transition-colors flex items-center gap-3'>
            <Building2 className='h-5 w-5 text-green-500 shrink-0' />
            <div>
              <p className='font-bold text-sm'>건물 관리</p>
              <p className='text-xs text-muted-foreground'>건물 조회 및 수정</p>
            </div>
          </Link>
          <Link href='/sub-admin/upload' className='p-3 border-2 border-dashed rounded-lg hover:border-purple-500 transition-colors flex items-center gap-3'>
            <TrendingUp className='h-5 w-5 text-purple-500 shrink-0' />
            <div>
              <p className='font-bold text-sm'>Excel 업로드</p>
              <p className='text-xs text-muted-foreground'>건물 일괄 등록</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

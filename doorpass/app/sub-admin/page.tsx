'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Users, Building2, TrendingUp, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw, Link2, Bell } from 'lucide-react'

interface DashboardStats {
  userCount: number
  buildingCount: number          // 내 대리점 건물
  totalBuildingCount: number     // 전체 건물 (앱 검색 화면과 동일)
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

interface RoleRequest {
  id: string
  user_email: string
  user_name: string
  reason: string
  status: string
  created_at: string
}

interface ReferralRecord {
  id: number
  memo: string | null
  referrer_email: string
  referred_email: string | null
  status: string
  expires_at: string
  created_at: string
}

interface FeedbackRow {
  id: number
  user_email: string
  user_name: string | null
  category: 'bug' | 'feature' | 'complaint' | 'password_error' | 'general'
  building_id: number | null
  building_name: string | null
  content: string
  status: 'new' | 'reading' | 'resolved' | 'rejected'
  admin_reply: string | null
  created_at: string
}

export default function SubAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ userCount: 0, buildingCount: 0, totalBuildingCount: 0, pendingApprovals: 0, recentUploads: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [processingRoleChoice, setProcessingRoleChoice] = useState<'driver' | 'editor' | 'reject' | null>(null)
  const approvalSectionRef = useRef<HTMLDivElement | null>(null)
  const [pwReports, setPwReports] = useState<FeedbackRow[]>([])
  const [pwReportsBusy, setPwReportsBusy] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showRoleRequests, setShowRoleRequests] = useState(false)
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([])
  const [roleRequestsLoading, setRoleRequestsLoading] = useState(false)
  const [processingRoleId, setProcessingRoleId] = useState<string | null>(null)
  const [showReferralHistory, setShowReferralHistory] = useState(false)
  const [referralHistory, setReferralHistory] = useState<ReferralRecord[]>([])
  const [referralLoading, setReferralLoading] = useState(false)

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

  const fetchPasswordReports = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/feedbacks?category=password_error&status=new', { cache: 'no-store' })
      if (!res.ok) return
      const d = (await res.json()) as { feedbacks?: FeedbackRow[] }
      setPwReports(d.feedbacks ?? [])
    } catch {}
  }, [])

  const handleResolvePwReport = async (id: number) => {
    setPwReportsBusy(id)
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      if (!res.ok) {
        toast.error('처리에 실패했어요.')
        return
      }
      toast.success('해결로 처리됐어요.')
      void fetchPasswordReports()
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setPwReportsBusy(null)
    }
  }

  useEffect(() => {
    void fetchStats()
    void fetchApprovals()
    void fetchPasswordReports()
    const interval = setInterval(() => {
      void fetchStats()
      void fetchApprovals()
      void fetchPasswordReports()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchApprovals, fetchPasswordReports])

  const scrollToApprovals = () => {
    approvalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fetchRoleRequests = useCallback(async () => {
    setRoleRequestsLoading(true)
    try {
      const res = await fetch('/api/admin/role-requests')
      const data = await res.json().catch(() => ({}))
      setRoleRequests((data.requests ?? []).filter((r: RoleRequest) => r.status === 'pending'))
    } catch (e) {
      console.error('편집자 권한 요청 조회 실패:', e)
    } finally {
      setRoleRequestsLoading(false)
    }
  }, [])

  const handleRoleRequestToggle = async () => {
    const next = !showRoleRequests
    setShowRoleRequests(next)
    if (next && roleRequests.length === 0) {
      await fetchRoleRequests()
    }
  }

  const handleRoleRequest = async (id: string, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve' ? '편집자 권한을 승인하시겠습니까?' : '편집자 권한 요청을 거부하시겠습니까?')) return
    setProcessingRoleId(id)
    try {
      const res = await fetch(`/api/admin/role-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('처리 실패')
      setRoleRequests((prev) => prev.filter((r) => r.id !== id))
      alert(action === 'approve' ? '✅ 편집자 권한 승인 완료!' : '❌ 거부 완료')
    } catch {
      alert('처리 중 오류가 발생했습니다')
    } finally {
      setProcessingRoleId(null)
    }
  }

  const fetchReferralHistory = useCallback(async () => {
    setReferralLoading(true)
    try {
      const res = await fetch('/api/users/referral/history')
      const data = await res.json().catch(() => ({}))
      setReferralHistory(data.history ?? [])
    } catch (e) {
      console.error('추천 기록 조회 실패:', e)
    } finally {
      setReferralLoading(false)
    }
  }, [])

  const handleReferralToggle = async () => {
    const next = !showReferralHistory
    setShowReferralHistory(next)
    if (next && referralHistory.length === 0) {
      await fetchReferralHistory()
    }
  }

  const getReferralStatusLabel = (record: ReferralRecord) => {
    if (record.status === 'used') return { label: '✅ 사용됨', color: 'text-green-400' }
    if (new Date(record.expires_at) < new Date()) return { label: '⏰ 만료됨', color: 'text-gray-400' }
    return { label: '⏳ 대기중', color: 'text-yellow-400' }
  }

  const handleApprove = async (
    approval: Approval,
    choice: 'driver' | 'editor' | 'reject'
  ) => {
    const action: 'approve' | 'reject' = choice === 'reject' ? 'reject' : 'approve'
    const role: 'driver' | 'editor' | undefined = choice === 'reject' ? undefined : choice
    const name = approval.user_name || approval.user_email
    const confirmMsg =
      choice === 'driver' ? `${name}님을 driver(기사)로 승인할까요?` :
      choice === 'editor' ? `${name}님을 editor(편집자)로 승인할까요?` :
      `${name}님 가입 요청을 거절할까요?`
    if (!confirm(confirmMsg)) return

    setProcessingId(approval.id)
    setProcessingRoleChoice(choice)
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.id, action, role }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(data.error || '처리 실패')

      setApprovals((prev) => prev.filter((a) => a.id !== approval.id))
      setStats((prev) => ({ ...prev, pendingApprovals: Math.max(0, prev.pendingApprovals - 1) }))

      if (choice === 'reject') {
        toast.success(`${name}님 가입을 거절했습니다`)
      } else {
        toast.success(`${name}님을 ${choice}로 승인했습니다`)
      }
    } catch (e) {
      toast.error((e as Error).message || '처리 중 오류가 발생했습니다')
    } finally {
      setProcessingId(null)
      setProcessingRoleChoice(null)
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
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3 mb-6'>

        {/* 총 회원 */}
        <Link href='/sub-admin/users' className='bg-card border rounded-xl p-4 hover:border-blue-500 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <Users className='h-4 w-4 text-blue-500' />
            <p className='text-xs text-muted-foreground font-medium'>총 회원</p>
          </div>
          <p className='text-2xl font-bold'>{stats.userCount}<span className='text-sm font-normal text-muted-foreground ml-1'>명</span></p>
        </Link>

        {/* 전체 건물 (앱 검색 화면과 동일) */}
        <div className='bg-card border rounded-xl p-4'>
          <div className='flex items-center gap-2 mb-2'>
            <Building2 className='h-4 w-4 text-emerald-500' />
            <p className='text-xs text-muted-foreground font-medium'>전체 건물</p>
          </div>
          <p className='text-2xl font-bold'>{stats.totalBuildingCount.toLocaleString()}<span className='text-sm font-normal text-muted-foreground ml-1'>개</span></p>
        </div>

        {/* 내 대리점 건물 */}
        <Link href='/sub-admin/buildings' className='bg-card border rounded-xl p-4 hover:border-green-500 transition-colors'>
          <div className='flex items-center gap-2 mb-2'>
            <Building2 className='h-4 w-4 text-green-500' />
            <p className='text-xs text-muted-foreground font-medium'>내 대리점</p>
          </div>
          <p className='text-2xl font-bold'>{stats.buildingCount.toLocaleString()}<span className='text-sm font-normal text-muted-foreground ml-1'>개</span></p>
        </Link>

        {/* 승인 대기 - 클릭 시 아래 섹션으로 스크롤 */}
        <button
          onClick={scrollToApprovals}
          className={'bg-card border rounded-xl p-4 text-left transition-all w-full ' +
            (stats.pendingApprovals > 0
              ? 'border-yellow-400 hover:border-yellow-500 cursor-pointer'
              : 'hover:border-gray-400 cursor-pointer')}
        >
          <div className='flex items-center gap-2 mb-2'>
            <Clock className={'h-4 w-4 ' + (stats.pendingApprovals > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
            <p className='text-xs text-muted-foreground font-medium'>승인 대기</p>
          </div>
          <div className='flex items-end gap-2'>
            <p className={'text-2xl font-bold ' + (stats.pendingApprovals > 0 ? 'text-yellow-500' : '')}>
              {stats.pendingApprovals}
            </p>
            <span className='text-sm text-muted-foreground mb-0.5'>건</span>
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

      {/* 승인 대기 목록 (항상 표시) */}
      <div
        ref={approvalSectionRef}
        className={
          'mb-6 border rounded-xl overflow-hidden ' +
          (approvals.length > 0 ? 'border-yellow-400/60 ring-2 ring-yellow-400/20' : '')
        }
      >
        <div className='bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Bell className={'h-4 w-4 ' + (approvals.length > 0 ? 'text-yellow-500' : 'text-muted-foreground')} />
            <span className='font-semibold text-sm'>🔔 승인 대기</span>
            {approvals.length > 0 && (
              <span className='text-xs bg-yellow-500 text-white rounded-full px-2 py-0.5 font-bold'>{approvals.length}건</span>
            )}
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
            승인 대기 중인 회원이 없습니다
          </div>
        ) : (
          <div className='divide-y'>
            {approvals.map((approval) => {
              const isBusy = processingId === approval.id
              return (
                <div key={approval.id} className='p-4 hover:bg-muted/30'>
                  <div className='mb-2'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-semibold text-sm'>
                        {approval.user_name || '이름 미입력'}
                      </span>
                      <span className='text-xs text-muted-foreground'>|</span>
                      <span className='text-xs text-muted-foreground truncate'>{approval.user_email}</span>
                      <span className='text-xs text-muted-foreground'>|</span>
                      <span className='text-xs text-muted-foreground'>
                        {new Date(approval.requested_at).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>
                      소속: <span className='text-blue-400'>{approval.branches?.name ?? approval.selected_branch_id}</span>
                    </div>
                  </div>
                  <div className='flex gap-2 flex-wrap'>
                    <button
                      onClick={() => void handleApprove(approval, 'driver')}
                      disabled={isBusy}
                      className='flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                    >
                      <CheckCircle2 className='h-3.5 w-3.5' />
                      {isBusy && processingRoleChoice === 'driver' ? '처리 중...' : 'driver 승인'}
                    </button>
                    <button
                      onClick={() => void handleApprove(approval, 'editor')}
                      disabled={isBusy}
                      className='flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                    >
                      <CheckCircle2 className='h-3.5 w-3.5' />
                      {isBusy && processingRoleChoice === 'editor' ? '처리 중...' : 'editor 승인'}
                    </button>
                    <button
                      onClick={() => void handleApprove(approval, 'reject')}
                      disabled={isBusy}
                      className='flex items-center gap-1 bg-white/5 border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                    >
                      <XCircle className='h-3.5 w-3.5' />
                      {isBusy && processingRoleChoice === 'reject' ? '처리 중...' : '거절'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 비밀번호 오류 신고 (내 대리점 건물) */}
      {pwReports.length > 0 && (
        <div className='mb-6 border border-amber-400/40 ring-2 ring-amber-400/20 rounded-xl overflow-hidden'>
          <div className='bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center gap-2'>
            <span className='font-semibold text-sm'>⚠️ 비밀번호 오류 신고</span>
            <span className='text-xs bg-amber-500 text-white rounded-full px-2 py-0.5 font-bold'>{pwReports.length}건</span>
          </div>
          <div className='divide-y'>
            {pwReports.map((fb) => {
              const created = new Date(fb.created_at).toLocaleString('ko-KR', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={fb.id} className='p-4 hover:bg-muted/30'>
                  <div className='mb-2'>
                    <div className='text-sm font-bold'>
                      {fb.building_name ?? '(건물 미상)'}
                      <span className='text-xs text-muted-foreground font-normal ml-2'>· {fb.user_name ?? fb.user_email}</span>
                    </div>
                    <p className='text-sm text-foreground/90 mt-1 whitespace-pre-wrap'>{fb.content}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{created}</p>
                  </div>
                  <button
                    onClick={() => void handleResolvePwReport(fb.id)}
                    disabled={pwReportsBusy === fb.id}
                    className='px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50'
                  >
                    {pwReportsBusy === fb.id ? '처리 중...' : '✅ 해결'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 편집자 권한 요청 목록 */}
      <div className='mb-6 border rounded-xl overflow-hidden'>
        <button
          onClick={() => void handleRoleRequestToggle()}
          className='w-full bg-card px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors'
        >
          <div className='flex items-center gap-2'>
            <CheckCircle2 className='h-4 w-4 text-purple-400' />
            <span className='font-semibold text-sm'>편집자 권한 요청</span>
            {roleRequests.length > 0 && (
              <span className='text-xs bg-purple-500 text-white rounded-full px-2 py-0.5 font-bold'>{roleRequests.length}</span>
            )}
          </div>
          {showRoleRequests ? <ChevronUp className='h-3 w-3 text-muted-foreground' /> : <ChevronDown className='h-3 w-3 text-muted-foreground' />}
        </button>

        {showRoleRequests && (
          <>
            <div className='flex justify-end px-4 py-2 border-t bg-muted/10'>
              <button
                onClick={() => void fetchRoleRequests()}
                className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
              >
                <RefreshCw className='h-3 w-3' /> 새로고침
              </button>
            </div>
            {roleRequestsLoading ? (
              <div className='p-8 text-center text-muted-foreground text-sm'>
                <RefreshCw className='h-5 w-5 animate-spin mx-auto mb-2' />
                로딩 중...
              </div>
            ) : roleRequests.length === 0 ? (
              <div className='p-8 text-center text-muted-foreground text-sm'>
                ✅ 대기 중인 편집자 권한 요청이 없습니다
              </div>
            ) : (
              <div className='divide-y'>
                {roleRequests.map((req) => (
                  <div key={req.id} className='p-4 flex items-start justify-between gap-4 hover:bg-muted/30'>
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold text-sm truncate'>{req.user_name || '이름 미입력'}</p>
                      <p className='text-xs text-muted-foreground truncate'>{req.user_email}</p>
                      {req.reason && (
                        <p className='text-xs text-muted-foreground/80 mt-1 line-clamp-2'>사유: {req.reason}</p>
                      )}
                      <p className='text-xs text-muted-foreground mt-0.5'>
                        {new Date(req.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className='flex gap-2 shrink-0'>
                      <button
                        onClick={() => void handleRoleRequest(req.id, 'approve')}
                        disabled={processingRoleId === req.id}
                        className='flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors'
                      >
                        <CheckCircle2 className='h-3.5 w-3.5' />
                        승인
                      </button>
                      <button
                        onClick={() => void handleRoleRequest(req.id, 'reject')}
                        disabled={processingRoleId === req.id}
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
          </>
        )}
      </div>

      {/* 추천 링크 기록 */}
      <div className='mb-6 border rounded-xl overflow-hidden'>
        <button
          onClick={() => void handleReferralToggle()}
          className='w-full bg-card px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors'
        >
          <div className='flex items-center gap-2'>
            <Link2 className='h-4 w-4 text-blue-400' />
            <span className='font-semibold text-sm'>추천 링크 발송 기록</span>
            {referralHistory.length > 0 && (
              <span className='text-xs bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5'>{referralHistory.length}</span>
            )}
          </div>
          {showReferralHistory ? <ChevronUp className='h-3 w-3 text-muted-foreground' /> : <ChevronDown className='h-3 w-3 text-muted-foreground' />}
        </button>

        {showReferralHistory && (
          <>
            <div className='flex justify-end px-4 py-2 border-t bg-muted/10'>
              <button
                onClick={() => void fetchReferralHistory()}
                className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
              >
                <RefreshCw className='h-3 w-3' /> 새로고침
              </button>
            </div>
            {referralLoading ? (
              <div className='p-8 text-center text-muted-foreground text-sm'>
                <RefreshCw className='h-5 w-5 animate-spin mx-auto mb-2' />
                로딩 중...
              </div>
            ) : referralHistory.length === 0 ? (
              <div className='p-8 text-center text-muted-foreground text-sm'>발송 기록이 없습니다</div>
            ) : (
              <div className='divide-y'>
                {referralHistory.map((record) => {
                  const { label, color } = getReferralStatusLabel(record)
                  return (
                    <div key={record.id} className='px-4 py-3 hover:bg-muted/20 text-sm'>
                      <div className='flex items-start justify-between gap-3'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-1'>
                            <span className={`text-xs font-bold shrink-0 ${color}`}>{label}</span>
                            {record.memo && (
                              <span className='text-xs bg-muted rounded px-1.5 py-0.5 truncate max-w-[160px]'>{record.memo}</span>
                            )}
                          </div>
                          <p className='text-xs text-muted-foreground truncate'>
                            발신: {record.referrer_email}
                          </p>
                          <p className='text-xs text-muted-foreground truncate'>
                            수신: {record.referred_email ?? '미사용'}
                          </p>
                        </div>
                        <div className='text-right shrink-0'>
                          <p className='text-xs text-muted-foreground'>
                            {new Date(record.created_at).toLocaleDateString('ko-KR')}
                          </p>
                          <p className='text-xs text-muted-foreground/60'>
                            만료 {new Date(record.expires_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

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

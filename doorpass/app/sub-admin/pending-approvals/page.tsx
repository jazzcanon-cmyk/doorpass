"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock, UserCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Approval {
  id: number
  user_email: string
  user_name: string
  selected_branch_id: string
  requested_at: string
  branches?: {
    name?: string
    region?: string
  } | null
}

type Role = "driver" | "editor"

export default function SubAdminPendingApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [roleModal, setRoleModal] = useState<{ approvalId: number; userName: string } | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>("driver")
  const [processing, setProcessing] = useState(false)

  const fetchApprovals = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/pending-approvals")
      const data = await res.json().catch(() => ({}))
      setApprovals(data.approvals || [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchApprovals()
  }, [])

  const openRoleModal = (approvalId: number, userName: string) => {
    setSelectedRole("driver")
    setRoleModal({ approvalId, userName })
  }

  const handleApproveWithRole = async () => {
    if (!roleModal) return
    setProcessing(true)
    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: roleModal.approvalId, action: "approve", role: selectedRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "처리 실패")
      setRoleModal(null)
      await fetchApprovals()
    } catch (error) {
      alert("처리 중 오류가 발생했습니다")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (approvalId: number) => {
    if (!confirm("거부하시겠습니까?")) return
    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, action: "reject" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "처리 실패")
      await fetchApprovals()
    } catch (error) {
      alert("처리 중 오류가 발생했습니다")
    }
  }

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">승인 대기 목록</h1>
        {approvals.length > 0 && (
          <span className="rounded-full bg-yellow-500 px-2.5 py-0.5 text-sm font-bold text-black">
            {approvals.length}
          </span>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">승인 대기 중인 요청이 없습니다</div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-lg">{approval.user_name || approval.user_email}</h3>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>📧 {approval.user_email}</p>
                    <p>🏢 {approval.branches?.name ?? approval.selected_branch_id}{approval.branches?.region ? ` (${approval.branches.region})` : ""}</p>
                    <p>📅 {new Date(approval.requested_at).toLocaleString("ko-KR")}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    onClick={() => openRoleModal(approval.id, approval.user_name || approval.user_email)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />승인
                  </Button>
                  <Button onClick={() => void handleReject(approval.id)} variant="destructive">
                    <XCircle className="h-4 w-4 mr-2" />거부
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 역할 선택 모달 */}
      <Dialog open={!!roleModal} onOpenChange={(open) => { if (!open) setRoleModal(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              역할 선택
            </DialogTitle>
            <p className="text-sm text-gray-500">
              <span className="font-medium">{roleModal?.userName}</span> 님에게 부여할 역할을 선택하세요.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => setSelectedRole("driver")}
              className={`rounded-lg border-2 p-4 text-center transition-colors ${
                selectedRole === "driver"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="text-2xl mb-1">🚗</div>
              <div className="font-semibold text-sm">기사</div>
              <div className="text-xs text-gray-500 mt-0.5">비번 열람만</div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole("editor")}
              className={`rounded-lg border-2 p-4 text-center transition-colors ${
                selectedRole === "editor"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="text-2xl mb-1">✏️</div>
              <div className="font-semibold text-sm">편집자</div>
              <div className="text-xs text-gray-500 mt-0.5">열람 + 수정</div>
            </button>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setRoleModal(null)} disabled={processing}>
              취소
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => void handleApproveWithRole()}
              disabled={processing}
            >
              {processing ? "처리 중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

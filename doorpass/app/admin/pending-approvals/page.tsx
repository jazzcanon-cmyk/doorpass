"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock } from "lucide-react"

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

export default function PendingApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  const handleApprove = async (approvalId: number, action: "approve" | "reject") => {
    if (!confirm(action === "approve" ? "승인하시겠습니까?" : "거부하시겠습니까?")) return

    try {
      const res = await fetch("/api/admin/approve-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, action }),
      })
      if (!res.ok) throw new Error("처리 실패")
      alert(action === "approve" ? "승인 완료" : "거부 완료")
      await fetchApprovals()
    } catch (error) {
      console.error("오류:", error)
      alert("처리 중 오류가 발생했습니다")
    }
  }

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">승인 대기 목록</h1>
        <p className="text-gray-600 dark:text-gray-400">{approvals.length}건의 승인 요청</p>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">승인 대기 중인 요청이 없습니다</div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-lg">{approval.user_name || approval.user_email}</h3>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>📧 {approval.user_email}</p>
                    <p>
                      🏢 {approval.branches?.name ?? approval.selected_branch_id}
                      {approval.branches?.region ? ` (${approval.branches.region})` : ""}
                    </p>
                    <p>📅 {new Date(approval.requested_at).toLocaleString("ko-KR")}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleApprove(approval.id, "approve")} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    승인
                  </Button>
                  <Button onClick={() => void handleApprove(approval.id, "reject")} variant="destructive">
                    <XCircle className="h-4 w-4 mr-2" />
                    거부
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

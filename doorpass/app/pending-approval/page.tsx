"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type ApprovalStatus = "pending" | "approved" | "rejected"

export default function PendingApprovalPage() {
  const router = useRouter()
  const [status, setStatus] = useState<ApprovalStatus>("pending")
  const [branchName, setBranchName] = useState("")

  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetch("/api/users/approval-status")
      const data = await res.json().catch(() => ({}))

      if (data.status === "approved") {
        setStatus("approved")
        setTimeout(() => router.push("/"), 3000)
      } else if (data.status === "rejected") {
        setStatus("rejected")
      } else {
        setStatus("pending")
        setBranchName(data.branchName || "")
      }
    }

    void checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D2144 40%, #0A3A6B 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          {status === "pending" && (
            <>
              <Clock className="h-16 w-16 text-yellow-400 mx-auto animate-pulse mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">승인 대기 중</h1>
              <p className="text-white/60 mb-6">
                {branchName || "선택한 대리점"} 관리자가 승인하면
                <br />
                계속 이용 가능합니다
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                자동으로 확인 중...
              </div>
            </>
          )}

          {status === "approved" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">승인이 완료됐어요! 🎉</h1>
              <p className="text-white/60 mb-6">잠시 후 앱으로 이동합니다...</p>
            </>
          )}

          {status === "rejected" && (
            <>
              <XCircle className="h-16 w-16 text-red-400 mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">승인 거부됨</h1>
              <p className="text-white/60 mb-6">관리자에게 문의해주세요</p>
              <Button onClick={() => router.push("/login")} variant="outline" className="w-full">
                로그인 화면으로
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

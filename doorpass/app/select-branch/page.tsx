"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Branch {
  id: string
  name: string
  region: string
}

export default function SelectBranchPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    void fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data.branches ?? []))
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.name) setUserName(d.name)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem("referral_token")
    if (!token) return
    fetch("/api/users/referral/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(() => sessionStorage.removeItem("referral_token"))
      .catch(console.error)
  }, [])

  const branchesByRegion = useMemo(() => {
    return branches.reduce<Record<string, Branch[]>>((acc, branch) => {
      if (!acc[branch.region]) acc[branch.region] = []
      acc[branch.region].push(branch)
      return acc
    }, {})
  }, [branches])

  const canSubmit = !!selectedBranch && termsChecked && purposeChecked

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranch,
          userName: userName || "",
        }),
      })
      if (!res.ok) throw new Error("승인 요청 실패")
      router.push("/pending-approval")
    } catch (error) {
      console.error("오류:", error)
      alert("승인 요청 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D2144 40%, #0A3A6B 100%)" }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">소속 대리점 선택</h1>
          <p className="text-white/60">계속 이용하시려면 소속 대리점을 선택해주세요</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
          <div className="space-y-6">
            {Object.entries(branchesByRegion).map(([region, regionBranches]) => (
              <div key={region}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">{region}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {regionBranches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => setSelectedBranch(branch.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedBranch === branch.id
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2
                          className={`h-5 w-5 ${
                            selectedBranch === branch.id ? "text-blue-400" : "text-white/40"
                          }`}
                        />
                        <div className="text-left">
                          <p className="font-semibold text-white">{branch.name}</p>
                          <p className="text-sm text-white/60">{region}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 약관 동의 (div 클릭 방식 — 모바일 호환) */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">이용약관 동의</p>

            <div
              onClick={() => setTermsChecked((v) => !v)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                background: termsChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                border: termsChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                userSelect: "none",
                WebkitUserSelect: "none",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  minWidth: "20px",
                  borderRadius: "6px",
                  marginTop: "1px",
                  background: termsChecked ? "#3b82f6" : "transparent",
                  border: termsChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {termsChecked && (
                  <span style={{ color: "white", fontSize: "12px", fontWeight: 900 }}>✓</span>
                )}
              </div>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: "1.5" }}>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "#60a5fa", textDecoration: "underline" }}
                >
                  이용약관
                </a>
                에 동의합니다.{" "}
                <span style={{ color: "#f87171", fontWeight: 600 }}>(필수)</span>
              </span>
            </div>

            <div
              onClick={() => setPurposeChecked((v) => !v)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                background: purposeChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                border: purposeChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  minWidth: "20px",
                  borderRadius: "6px",
                  marginTop: "1px",
                  background: purposeChecked ? "#3b82f6" : "transparent",
                  border: purposeChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {purposeChecked && (
                  <span style={{ color: "white", fontSize: "12px", fontWeight: 900 }}>✓</span>
                )}
              </div>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: "1.5" }}>
                비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{" "}
                <span style={{ color: "#f87171", fontWeight: 600 }}>(필수)</span>
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isLoading}
              className="w-full py-6 text-lg disabled:opacity-40"
            >
              {isLoading ? "처리 중..." : "선택 완료"}
            </Button>
          </div>
          <p className="text-center text-sm text-white/40 mt-4">
            선택한 대리점의 관리자가 승인하면 계속 이용 가능합니다
          </p>
        </div>
      </div>
    </div>
  )
}

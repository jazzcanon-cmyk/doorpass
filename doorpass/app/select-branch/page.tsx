"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Building2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Branch {
  id: string
  name: string
  region: string
  type?: string | null
}

export default function SelectBranchPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState("")
  const [reason, setReason] = useState("")
  const [termsChecked, setTermsChecked] = useState(false)
  const [purposeChecked, setPurposeChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const isEtc = selected === "etc-branch"

  useEffect(() => {
    void fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data.branches ?? []))
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d: { name?: string }) => { if (d.name) setUserName(d.name) })
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

  const branchOnly = useMemo(
    () => branches.filter((b) => !b.type || b.type === "branch"),
    [branches]
  )

  const branchesByRegion = useMemo(() => {
    return branchOnly.reduce<Record<string, Branch[]>>((acc, branch) => {
      if (!acc[branch.region]) acc[branch.region] = []
      acc[branch.region].push(branch)
      return acc
    }, {})
  }, [branchOnly])

  const canSubmit =
    !!selected &&
    termsChecked &&
    purposeChecked &&
    (!isEtc || reason.trim().length >= 2)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selected,
          userName: userName || "",
          reason: isEtc ? reason.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert((data as { error?: string }).error || "승인 요청 중 오류가 발생했습니다.")
        return
      }
      router.push("/pending-approval")
    } catch {
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
          {/* 대리점 목록 */}
          <div className="space-y-6 mb-6">
            {Object.entries(branchesByRegion).map(([region, regionBranches]) => (
              <div key={region}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-semibold text-white">{region}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {regionBranches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => { setSelected(branch.id); setReason("") }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selected === branch.id
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className={`h-4 w-4 flex-shrink-0 ${selected === branch.id ? "text-blue-400" : "text-white/40"}`} />
                        <span className="text-sm font-semibold text-white">{branch.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* 기타 옵션 */}
            <button
              onClick={() => setSelected("etc-branch")}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
                isEtc
                  ? "border-amber-500 bg-amber-500/20"
                  : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <HelpCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isEtc ? "text-amber-400" : "text-white/40"}`} />
              <div>
                <span className="text-sm font-semibold text-white">기타 (소속 대리점 없음)</span>
                <p className="text-xs text-white/40 mt-0.5">쿠팡, 한진택배 등 자영업 기사님</p>
              </div>
            </button>
          </div>

          {/* 기타 사유 입력 */}
          {isEtc && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/70 mb-2">
                소속/사유 입력 <span className="text-red-400">(필수)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 쿠팡 기사, 한진택배 등"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          )}

          {/* 약관 동의 */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">이용약관 동의</p>
            <div
              onClick={() => setTermsChecked((v) => !v)}
              style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"12px", borderRadius:"10px", cursor:"pointer", userSelect:"none", WebkitUserSelect:"none", background: termsChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", border: termsChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)", marginBottom:"8px" }}
            >
              <div style={{ width:"20px", height:"20px", minWidth:"20px", borderRadius:"6px", marginTop:"1px", background: termsChecked ? "#3b82f6" : "transparent", border: termsChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {termsChecked && <span style={{ color:"white", fontSize:"12px", fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"14px", lineHeight:"1.5" }}>
                <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color:"#60a5fa", textDecoration:"underline" }}>이용약관</a>에 동의합니다.{" "}
                <span style={{ color:"#f87171", fontWeight:600 }}>(필수)</span>
              </span>
            </div>
            <div
              onClick={() => setPurposeChecked((v) => !v)}
              style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"12px", borderRadius:"10px", cursor:"pointer", userSelect:"none", WebkitUserSelect:"none", background: purposeChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", border: purposeChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)" }}
            >
              <div style={{ width:"20px", height:"20px", minWidth:"20px", borderRadius:"6px", marginTop:"1px", background: purposeChecked ? "#3b82f6" : "transparent", border: purposeChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {purposeChecked && <span style={{ color:"white", fontSize:"12px", fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"14px", lineHeight:"1.5" }}>
                비밀번호 정보를 배송 업무 목적 외에 사용하지 않겠습니다.{" "}
                <span style={{ color:"#f87171", fontWeight:600 }}>(필수)</span>
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
            {isEtc ? "관리자 검토 후 승인됩니다" : "선택한 대리점 관리자가 승인하면 이용 가능합니다"}
          </p>
        </div>
      </div>
    </div>
  )
}

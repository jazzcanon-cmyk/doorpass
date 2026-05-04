"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Building2, Briefcase, Truck, User } from "lucide-react"
import { Button } from "@/components/ui/button"

type MemberType = "headquarters" | "branch" | "public"

interface Branch {
  id: string
  name: string
  region: string
  type?: string | null
}

const MEMBER_TYPES: { key: MemberType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "headquarters", label: "지사직원", desc: "울산지사 소속", icon: <Briefcase className="h-6 w-6" /> },
  { key: "branch", label: "대리점기사", desc: "대리점 소속 기사", icon: <Truck className="h-6 w-6" /> },
  { key: "public", label: "일반인", desc: "일반 회원", icon: <User className="h-6 w-6" /> },
]

export default function SelectBranchPage() {
  const router = useRouter()
  const [memberType, setMemberType] = useState<MemberType | null>(null)
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

  const getTargetBranchId = () => {
    if (memberType === "headquarters") return "ulsan-hq"
    if (memberType === "public") return "public-general"
    return selectedBranch
  }

  const canSubmit =
    !!memberType &&
    termsChecked &&
    purposeChecked &&
    (memberType !== "branch" || !!selectedBranch)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: getTargetBranchId(), userName: userName || "" }),
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
          <h1 className="text-3xl font-bold text-white mb-2">소속 선택</h1>
          <p className="text-white/60">계속 이용하시려면 소속을 선택해주세요</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
          {/* 소속 유형 선택 */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">소속 유형</p>
            <div className="grid grid-cols-3 gap-3">
              {MEMBER_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setMemberType(t.key)
                    setSelectedBranch("")
                    setTermsChecked(false)
                    setPurposeChecked(false)
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    memberType === t.key
                      ? "border-blue-500 bg-blue-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <span className={memberType === t.key ? "text-blue-400" : "text-white/50"}>
                    {t.icon}
                  </span>
                  <span className="font-semibold text-white text-sm">{t.label}</span>
                  <span className="text-[11px] text-white/40 text-center leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 지사직원 안내 */}
          {memberType === "headquarters" && (
            <div className="mb-6 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">울산지사 소속으로 가입 신청됩니다</p>
                <p className="text-white/50 text-xs mt-0.5">관리자 승인 후 이용 가능합니다</p>
              </div>
            </div>
          )}

          {/* 일반인 안내 */}
          {memberType === "public" && (
            <div className="mb-6 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center gap-3">
              <User className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">일반회원으로 가입 신청됩니다</p>
                <p className="text-white/50 text-xs mt-0.5">관리자 승인 후 이용 가능합니다</p>
              </div>
            </div>
          )}

          {/* 대리점기사: 대리점 선택 */}
          {memberType === "branch" && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">대리점 선택</p>
              {Object.entries(branchesByRegion).map(([region, regionBranches]) => (
                <div key={region} className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-white">{region}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {regionBranches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => setSelectedBranch(branch.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          selectedBranch === branch.id
                            ? "border-blue-500 bg-blue-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2
                            className={`h-4 w-4 flex-shrink-0 ${
                              selectedBranch === branch.id ? "text-blue-400" : "text-white/40"
                            }`}
                          />
                          <span className="text-sm font-semibold text-white">{branch.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 약관 동의 */}
          {memberType && (
            <>
              <div className="border-t border-white/10 pt-6">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">이용약관 동의</p>
                <div
                  onClick={() => setTermsChecked((v) => !v)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px",
                    borderRadius: "10px", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
                    background: termsChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                    border: termsChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ width:"20px", height:"20px", minWidth:"20px", borderRadius:"6px", marginTop:"1px", background: termsChecked ? "#3b82f6" : "transparent", border: termsChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {termsChecked && <span style={{ color:"white", fontSize:"12px", fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: "1.5" }}>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#60a5fa", textDecoration: "underline" }}>이용약관</a>에 동의합니다.{" "}
                    <span style={{ color: "#f87171", fontWeight: 600 }}>(필수)</span>
                  </span>
                </div>
                <div
                  onClick={() => setPurposeChecked((v) => !v)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px",
                    borderRadius: "10px", cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
                    background: purposeChecked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                    border: purposeChecked ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ width:"20px", height:"20px", minWidth:"20px", borderRadius:"6px", marginTop:"1px", background: purposeChecked ? "#3b82f6" : "transparent", border: purposeChecked ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {purposeChecked && <span style={{ color:"white", fontSize:"12px", fontWeight:900 }}>✓</span>}
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
                {memberType === "branch"
                  ? "선택한 대리점의 관리자가 승인하면 계속 이용 가능합니다"
                  : "관리자 승인 후 이용 가능합니다"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

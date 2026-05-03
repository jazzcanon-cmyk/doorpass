"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TermsAgreementModal } from "@/components/TermsAgreementModal"

interface Branch {
  id: string
  name: string
  region: string
}

export default function SelectBranchPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    void fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data.branches ?? []))
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    const token = sessionStorage.getItem('referral_token')
    if (!token) return
    fetch('/api/users/referral/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(() => sessionStorage.removeItem('referral_token'))
      .catch(console.error)
  }, [])

  const branchesByRegion = useMemo(() => {
    return branches.reduce<Record<string, Branch[]>>((acc, branch) => {
      if (!acc[branch.region]) acc[branch.region] = []
      acc[branch.region].push(branch)
      return acc
    }, {})
  }, [branches])

  const canSubmit = !!selectedBranch

  const submitApproval = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranch }),
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

  const handleSubmit = () => {
    if (!canSubmit) return
    if (!termsAgreed) {
      setShowTerms(true)
      return
    }
    void submitApproval()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D2144 40%, #0A3A6B 100%)" }}
    >
      {showTerms && (
        <TermsAgreementModal
          onAgreed={() => {
            setTermsAgreed(true)
            setShowTerms(false)
            void submitApproval()
          }}
        />
      )}

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

          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className="w-full py-6 text-lg disabled:opacity-40"
            >
              {isLoading ? "처리 중..." : "선택 완료"}
            </Button>
          </div>
          <p className="text-center text-sm text-white/40 mt-4">
            선택 후 약관 동의를 거쳐 승인이 완료되면 이용 가능합니다
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Building2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Branch {
  id: string
  name: string
  region: string
}

export function ApprovalRequestModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected("")
      return
    }
    void fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d.branches) ? d.branches : []))
      .catch(() => setBranches([]))
  }, [open])

  const branchesByRegion = useMemo(() => {
    return branches.reduce<Record<string, Branch[]>>((acc, b) => {
      if (!acc[b.region]) acc[b.region] = []
      acc[b.region].push(b)
      return acc
    }, {})
  }, [branches])

  const handleSubmit = async () => {
    if (!selected) {
      toast.error("대리점을 선택해주세요")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/users/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "요청 실패")

      if (data.status === "approved" || String(data.message ?? "").includes("이미 승인")) {
        toast.success("이미 승인된 계정입니다.")
        onOpenChange(false)
        router.refresh()
        return
      }
      if (String(data.message ?? "").includes("진행 중")) {
        toast.info("이미 승인 요청이 진행 중입니다.")
        onOpenChange(false)
        router.push("/pending-approval")
        return
      }

      toast.success("승인 요청이 접수되었습니다.")
      onOpenChange(false)
      router.push("/pending-approval")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "요청에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-md overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">승인 요청</DialogTitle>
          <p className="text-left text-sm text-white/60">
            소속 대리점을 선택하면 관리자에게 승인 요청이 전달됩니다.
          </p>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
          {Object.entries(branchesByRegion).map(([region, list]) => (
            <div key={region}>
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">{region}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {list.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelected(branch.id)}
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${
                      selected === branch.id
                        ? "border-blue-500 bg-blue-500/20"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2
                        className={`h-4 w-4 shrink-0 ${selected === branch.id ? "text-blue-400" : "text-white/40"}`}
                      />
                      <span className="text-sm font-medium text-white">{branch.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button
            type="button"
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            disabled={submitting || !selected}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            요청 보내기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

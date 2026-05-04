"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function NewBranchPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    id: "",
    name: "",
    region: "",
    manager_email: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.id || !form.name || !form.region) {
      alert("필수 항목을 입력해주세요")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "추가 실패")
      }

      alert("대리점 추가 완료!")
      router.push("/admin/branches")
    } catch (error) {
      console.error("추가 오류:", error)
      alert("추가 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => router.push("/admin/branches")} variant="outline" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">대리점 추가</h1>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  대리점 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="예: donggu"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">영문 소문자와 숫자만 사용 (예: donggu, junggu)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  대리점 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="예: 동구대리점"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  지역 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  required
                >
                  <option value="">선택하세요</option>
                  <option value="울산">울산</option>
                  <option value="부산">부산</option>
                  <option value="대구">대구</option>
                  <option value="서울">서울</option>
                  <option value="경기">경기</option>
                  <option value="인천">인천</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">부관리자 이메일 (선택)</label>
                <input
                  type="email"
                  value={form.manager_email}
                  onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="manager@example.com"
                />
                <p className="text-sm text-gray-500 mt-1">부관리자로 지정할 사용자 이메일 (나중에 변경 가능)</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "추가 중..." : "대리점 추가"}
            </Button>
            <Button type="button" onClick={() => router.push("/admin/branches")} variant="outline">
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

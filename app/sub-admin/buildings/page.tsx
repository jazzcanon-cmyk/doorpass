"use client"

import { useEffect, useState } from "react"
import { Building2, MapPin } from "lucide-react"

interface Building {
  id: number
  name: string
  address: string
  region: string | null
  created_at: string
}

export default function SubAdminBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    void fetchBuildings()
  }, [])

  const fetchBuildings = async () => {
    setIsLoading(true)
    const res = await fetch("/api/sub-admin/buildings")
    const data = await res.json().catch(() => ({}))
    setBuildings(data.buildings || [])
    setIsLoading(false)
  }

  const filteredBuildings = buildings.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) return <div className="p-6">로딩 중...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">건물 관리</h1>
        <p className="text-gray-600 dark:text-gray-400">{buildings.length}개의 건물</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="건물명 또는 주소로 검색..."
          className="w-full px-4 py-3 border rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBuildings.map((building) => (
          <div key={building.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <div className="flex items-start justify-between mb-3">
              <Building2 className="h-6 w-6 text-blue-500" />
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{building.region || "미분류"}</span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{building.name}</h3>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {building.address}
            </p>

            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500 dark:text-gray-400">등록일: {new Date(building.created_at).toLocaleDateString("ko-KR")}</p>
            </div>
          </div>
        ))}
      </div>

      {filteredBuildings.length === 0 && (
        <div className="text-center py-12 text-gray-500">{searchTerm ? "검색 결과가 없습니다" : "등록된 건물이 없습니다"}</div>
      )}
    </div>
  )
}

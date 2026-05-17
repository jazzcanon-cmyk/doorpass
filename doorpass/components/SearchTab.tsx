"use client"
import { useEffect, useRef, useState } from "react"
import { Search, AlertCircle, Plus, Mic } from "lucide-react"
import { Input } from "@/components/ui/input"
import { BuildingCard } from "@/components/building-card"
import type { Building } from "@/types/building"

interface SearchTabProps {
  searchQuery: string
  searchResults: Building[]
  allBuildings: Building[]
  searchNote?: string
  canRevealBuildingPassword: boolean
  onSearch: (query: string) => void
  onBuildingUpdate: (id: string, updated: Partial<Building>) => void
  onPointsUpdate?: () => void
  onAddBuilding?: () => void
  autoOpenBuildingId?: string
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: unknown) => void) | null
  start: () => void
  stop: () => void
}

export function SearchTab({
  searchQuery,
  searchResults,
  searchNote,
  canRevealBuildingPassword,
  onSearch,
  onBuildingUpdate,
  onPointsUpdate,
  onAddBuilding,
  autoOpenBuildingId,
}: SearchTabProps) {
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return

    setVoiceSupported(true)
    const rec = new Ctor()
    rec.lang = "ko-KR"
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? ""
      if (transcript) onSearchRef.current(transcript.trim())
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    recognitionRef.current = rec

    return () => {
      try { rec.stop() } catch { /* noop */ }
    }
  }, [])

  const handleMicClick = () => {
    const rec = recognitionRef.current
    if (!rec) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.")
      return
    }
    if (isListening) {
      try { rec.stop() } catch { /* noop */ }
      setIsListening(false)
      return
    }
    try {
      rec.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }

  return (
    <>
      <section className="container mx-auto px-4 py-4">
        {onAddBuilding && (
          <div className="mb-3">
            <button
              type="button"
              onClick={onAddBuilding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-sm font-semibold transition-colors shadow-md shadow-green-900/30"
            >
              <Plus className="h-4 w-4" />
              새 건물 등록
            </button>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            type="text"
            placeholder="건물명 또는 주소 검색..."
            aria-label="건물 검색"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className={`pl-10 ${voiceSupported ? "pr-12" : ""} h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-blue-500/50 transition-all duration-200`}
            autoFocus
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isListening ? "음성 인식 중지" : "음성 검색 시작"}
              className={`absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
      <section className="container mx-auto px-4 pb-6">
        {searchQuery.trim() === "" ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
            <Search className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm mb-1">건물명 또는 주소를 검색해주세요</p>
            <p className="text-white/20 text-xs">울산 전체 112,836개 건물 검색 가능</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center backdrop-blur-sm">
            <AlertCircle className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">{`'${searchQuery}'에 대한 검색 결과가 없습니다.`}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchNote && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-300/80">
                {searchNote}
              </div>
            )}
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
              검색 결과 {searchResults.length}건
            </p>
            {searchResults.map((b) => (
              <BuildingCard
                key={b.id}
                building={b}
                showDistance={false}
                canRevealBuildingPassword={canRevealBuildingPassword}
                onUpdate={onBuildingUpdate}
                onPointsUpdate={onPointsUpdate}
                autoOpen={autoOpenBuildingId === b.id}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

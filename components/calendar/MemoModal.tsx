"use client"
import { useState, useEffect } from "react"
import { X, Edit2, Trash2, Lock, Globe } from "lucide-react"
import { COLORS, calendarInputStyle } from "@/lib/calendar-utils"
import type { Memo } from "@/types/calendar"

interface MemoModalProps {
  selectedDate: string
  memos: Memo[]
  kakaoId?: string
  userName: string
  onClose: () => void
  onRefresh: () => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
}

export function MemoModal({ selectedDate, memos, kakaoId, userName, onClose, onRefresh, onDelete }: MemoModalProps) {
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null)
  const [content, setContent] = useState("")
  const [memoPrivate, setMemoPrivate] = useState(false)
  const [memoColor, setMemoColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dateMemos = memos.filter(m => m.date === selectedDate && (!m.is_private || m.kakao_id === kakaoId))

  const resetForm = () => {
    setEditingMemo(null)
    setContent("")
    setMemoPrivate(false)
    setMemoColor(COLORS[0])
    setSaveError(null)
  }

  const startEdit = (memo: Memo) => {
    setEditingMemo(memo)
    setContent(memo.content)
    setMemoPrivate(memo.is_private)
    setMemoColor(memo.color)
    setSaveError(null)
  }

  useEffect(() => { resetForm() }, [selectedDate])

  const saveMemo = async () => {
    if (!content.trim()) {
      setSaveError("내용을 입력해주세요.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = editingMemo
        ? { action: "update", id: editingMemo.id, content, is_private: memoPrivate, color: memoColor }
        : { action: "insert", date: selectedDate, content, is_private: memoPrivate, kakao_id: memoPrivate ? (kakaoId ?? null) : null, author: userName, color: memoColor }

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? "저장에 실패했습니다."); return }

      await onRefresh()
      resetForm()
    } catch {
      setSaveError("네트워크 오류로 저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => { onClose(); resetForm() }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "20px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
            📅 {selectedDate.replace(/-/g, ".")}
          </h3>
          <button onClick={handleClose}
            style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: 7, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {dateMemos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 7 }}>등록된 메모</p>
            {dateMemos.map(m => (
              <div key={m.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 7, borderLeft: `4px solid ${m.color}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      {m.is_private && <Lock size={11} color="#94a3b8" />}
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.author}</span>
                    </div>
                    <p style={{ fontSize: 14, color: "#1e293b", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</p>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button onClick={() => startEdit(m)}
                      style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "#3b82f6" }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => onDelete(m.id)}
                      style={{ background: "#fef2f2", border: "none", borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: "#ef4444" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
            {editingMemo ? "✏️ 수정" : "➕ 새 메모"}
          </p>

          {saveError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 10px", marginBottom: 10, color: "#b91c1c", fontSize: 13 }}>
              ⚠️ {saveError}
            </div>
          )}

          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setMemoColor(c)}
                style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: memoColor === c ? "3px solid #1e293b" : "3px solid transparent", cursor: "pointer", flexShrink: 0 }} />
            ))}
          </div>

          <textarea
            placeholder="메모 내용을 입력하세요"
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaveError(null) }}
            rows={4}
            autoFocus
            style={{ ...calendarInputStyle, border: saveError ? "1px solid #ef4444" : "1px solid #e2e8f0", marginBottom: 10, resize: "none", lineHeight: 1.6 }}
          />

          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setMemoPrivate(!memoPrivate)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: memoPrivate ? "#eff6ff" : "#f1f5f9", border: "none", borderRadius: 8, padding: "7px 11px", cursor: "pointer", color: memoPrivate ? "#3b82f6" : "#64748b", fontWeight: 600, fontSize: 13 }}>
              {memoPrivate ? <Lock size={13} /> : <Globe size={13} />}
              {memoPrivate ? "개인 메모" : "공개 메모"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {editingMemo && (
              <button onClick={resetForm}
                style={{ flex: 1, background: "#f1f5f9", color: "#64748b", fontWeight: 600, fontSize: 14, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer" }}>
                취소
              </button>
            )}
            <button onClick={saveMemo} disabled={saving}
              style={{ flex: 2, background: saving ? "#94a3b8" : memoColor, color: "white", fontWeight: 700, fontSize: 14, padding: "10px 0", borderRadius: 8, border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "저장 중..." : editingMemo ? "수정 완료" : "메모 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

interface TestResult {
  ok: boolean
  message: string
  detail?: string
}

const TESTS = [
  { label: "검색 추적", type: "search",        data: { query: "테스트건물", results: 3 } },
  { label: "건물 조회", type: "building_view", data: { buildingId: "test-1", buildingName: "테스트빌딩" } },
  { label: "게시글 조회", type: "post_view",   data: { postId: 99, postTitle: "테스트게시글" } },
  { label: "버튼 클릭", type: "button_click",  data: { buttonName: "test_button" } },
  { label: "페이지 뷰", type: "page_view",     data: { pagePath: "/test-tracking" } },
]

export default function TestTrackingPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const runTest = async (type: string, data: object) => {
    setLoading(type)
    try {
      const res = await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      })
      const json = await res.json()
      setResults((prev) => ({
        ...prev,
        [type]: res.ok
          ? { ok: true,  message: "DB 저장 성공", detail: JSON.stringify(json) }
          : { ok: false, message: `HTTP ${res.status} 실패`, detail: JSON.stringify(json) },
      }))
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [type]: { ok: false, message: "fetch 오류", detail: String(err) },
      }))
    }
    setLoading(null)
  }

  const runAll = async () => {
    for (const t of TESTS) await runTest(t.type, t.data)
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>추적 시스템 테스트</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        각 버튼을 누르면 <code>/api/analytics/track</code>을 호출해 DB에 기록합니다.
      </p>

      <button
        onClick={runAll}
        disabled={!!loading}
        style={{
          width: "100%", padding: "11px 0", marginBottom: 16,
          background: "#2563eb", color: "white", border: "none",
          borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}
      >
        {loading ? "테스트 중..." : "전체 테스트 실행"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TESTS.map(({ label, type, data }) => {
          const r = results[type]
          return (
            <div key={type} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: r ? 8 : 0 }}>
                <button
                  onClick={() => runTest(type, data)}
                  disabled={loading === type}
                  style={{
                    flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0",
                    borderRadius: 6, background: "#f8fafc", fontSize: 13,
                    fontWeight: 600, cursor: "pointer", textAlign: "left",
                  }}
                >
                  {loading === type ? "전송 중..." : label}
                </button>
                <code style={{ fontSize: 11, color: "#94a3b8" }}>{type}</code>
              </div>
              {r && (
                <div style={{
                  padding: "8px 10px", borderRadius: 6,
                  background: r.ok ? "#f0fdf4" : "#fef2f2",
                  color: r.ok ? "#16a34a" : "#dc2626",
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 600 }}>{r.ok ? "✅" : "❌"} {r.message}</div>
                  {r.detail && <div style={{ marginTop: 2, color: "#475569", wordBreak: "break-all" }}>{r.detail}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 12, color: "#475569" }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>결과 확인 방법</p>
        <ol style={{ paddingLeft: 18, lineHeight: 2 }}>
          <li>Supabase Dashboard → Table Editor → <strong>user_activities</strong></li>
          <li>브라우저 콘솔 → <code>[Analytics] tracked OK</code> 또는 에러 확인</li>
          <li>❌가 나오면 아래 SQL을 Supabase SQL Editor에서 실행:</li>
        </ol>
        <pre style={{
          marginTop: 8, padding: "10px 12px", background: "#1e293b",
          color: "#94a3b8", borderRadius: 6, fontSize: 11, overflowX: "auto",
          whiteSpace: "pre-wrap",
        }}>
{`ALTER TABLE user_activities DISABLE ROW LEVEL SECURITY;`}
        </pre>
      </div>
    </div>
  )
}

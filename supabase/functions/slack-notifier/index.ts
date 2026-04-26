import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL") ?? ""

serve(async (req) => {
  try {
    const payload = await req.json()

    const { type, table, record } = payload  // old_record는 필요 없을 경우 생략

    let title = `🔄 ${table} 테이블 ${type}`
    let message = ""

    if (table === "door_passwords") {
      title = type === "INSERT" ? "🆕 새 건물 비밀번호 등록" : "✏️ 비밀번호 수정"
      message = `*건물명*: ${record.building_name || record.address || "알 수 없음"}\n*비밀번호*: ${record.password || "없음"}\n*작성자*: ${record.created_by || record.user_id || "시스템"}`
    } 
    else if (table === "memos" || table === "calendar_memos") {
      title = "📝 새 메모 / 캘린더 메모 등록"
      message = `*제목*: ${record.title || "메모"}\n*내용*: ${record.content ? record.content.substring(0, 80) + "..." : ""}\n*날짜*: ${record.memo_date || record.date || ""}`
    } 
    else if (table === "posts" || table === "board") {
      title = "📢 게시판 새 글 등록"
      message = `*제목*: ${record.title}\n*작성자*: ${record.user_id || "알 수 없음"}`
    } 
    else if (table === "materials" || table === "files") {
      title = "📁 자료실 새 파일 업로드"
      message = `*파일명*: ${record.file_name || record.name}\n*설명*: ${record.description || ""}`
    } 
    else if (table === "notices") {
      title = "📣 공지사항 등록"
      message = `*제목*: ${record.title}`
    }

    const slackPayload = {
      text: title,
      blocks: [
        {
          type: "section",
          text: { 
            type: "mrkdwn", 
            text: `*${title}*\n${message}` 
          }
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `🕒 ${new Date().toLocaleString('ko-KR')}` }
          ]
        }
      ]
    }

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload)
    })

    if (!res.ok) {
      console.error("Slack 전송 실패:", await res.text())
    }

    return new Response("Success", { status: 200 })
  } catch (error) {
    console.error("Error:", error)
    return new Response("Error", { status: 500 })
  }
})
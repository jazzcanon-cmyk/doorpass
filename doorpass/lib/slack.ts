export async function sendSlackMessage(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.")
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    })

    const responseText = await response.text()
    console.log(`[Slack] status=${response.status} ok=${response.ok} body="${responseText}"`)

    if (!response.ok) {
      console.error(`[Slack] 전송 실패: HTTP ${response.status} - ${responseText}`)
    }
  } catch (err) {
    console.error("[Slack] fetch 예외 발생:", err)
  }
}

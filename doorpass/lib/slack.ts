export interface SlackField {
  title: string
  value: string
  short?: boolean
}

export interface SlackMessageOptions {
  text: string
  fields?: SlackField[]
  color?: string
}

export async function sendSlackMessage(messageOrOptions: string | SlackMessageOptions): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn("[Slack] SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.")
    return { ok: false, error: "SLACK_WEBHOOK_URL 환경변수 없음" }
  }

  const payload =
    typeof messageOrOptions === "string"
      ? { text: messageOrOptions }
      : {
          attachments: [
            {
              color: messageOrOptions.color ?? "#36a64f",
              text: messageOrOptions.text,
              fields: messageOrOptions.fields?.map((f) => ({
                title: f.title,
                value: f.value,
                short: f.short ?? true,
              })),
              footer: "DoorPass",
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log(`[Slack] status=${response.status} ok=${response.ok} body="${responseText}"`)

    if (!response.ok) {
      console.error(`[Slack] 전송 실패: HTTP ${response.status} - ${responseText}`)
      return { ok: false, error: `HTTP ${response.status}: ${responseText}` }
    }
    return { ok: true }
  } catch (err) {
    console.error("[Slack] fetch 예외 발생:", err)
    return { ok: false, error: String(err) }
  }
}

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface BoxMeasureResult {
  width: number
  depth: number
  height: number
  total: number
  type: string
  confidence: string
  note: string
}

function classifyType(total: number): string {
  if (total <= 80) return "A"
  if (total <= 100) return "B"
  if (total <= 120) return "C"
  if (total <= 140) return "D"
  if (total <= 160) return "E"
  if (total <= 190) return "F"
  return "G"
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      frontImageBase64: string
      frontMediaType?: string
      sideImageBase64: string
      sideMediaType?: string
      referenceHeight?: number
    }

    const { frontImageBase64, sideImageBase64, referenceHeight } = body

    if (!frontImageBase64 || !sideImageBase64) {
      return NextResponse.json({ error: "정면/옆면 이미지 모두 필요합니다" }, { status: 400 })
    }

    const refNote = referenceHeight
      ? `\n기준 정보: 정면 이미지의 박스 높이는 실제 ${referenceHeight}cm입니다. 이를 기준으로 비율을 계산하여 다른 치수를 추정하세요.`
      : ""

    const userPrompt = `이 택배박스 이미지를 분석해서:
1. 첫 번째 이미지(정면)에서 가로(width, cm), 높이(height, cm) 추정
2. 두 번째 이미지(옆면)에서 세로(depth, cm) 추정
3. 합계(가로+세로+높이) 계산
4. CJ대한통운 기준 타입 분류:
   - A타입: 합계 80cm 이하
   - B타입: 81~100cm
   - C타입: 101~120cm
   - D타입: 121~140cm
   - E타입: 141~160cm
   - F타입: 161~190cm
   - G타입: 191~220cm

정확한 치수 측정을 위해:
- 박스 모서리와 엣지를 기준으로 분석
- 원근법과 비율을 활용
- 불확실한 경우 범위로 표시${refNote}

JSON으로만 반환:
{
  "width": 가로cm (숫자),
  "depth": 세로cm (숫자),
  "height": 높이cm (숫자),
  "total": 합계cm (숫자),
  "type": "A"~"G" 중 하나,
  "confidence": "높음" | "보통" | "낮음",
  "note": "참고사항"
}`

    const frontMediaType = (body.frontMediaType || "image/jpeg") as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp"
    const sideMediaType = (body.sideMediaType || "image/jpeg") as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "당신은 택배박스 치수 측정 전문가입니다. 제공된 이미지에서 박스의 정확한 치수를 추정합니다. JSON만 반환하세요.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: frontMediaType, data: frontImageBase64 },
            },
            {
              type: "image",
              source: { type: "base64", media_type: sideMediaType, data: sideImageBase64 },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    })

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "분석 실패", raw: rawText }, { status: 422 })
    }

    const result = JSON.parse(jsonMatch[0]) as BoxMeasureResult

    if (!result.total || result.total === 0) {
      result.total = (result.width || 0) + (result.depth || 0) + (result.height || 0)
    }

    if (!result.type) {
      result.type = classifyType(result.total)
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error("박스 측정 오류:", err)
    return NextResponse.json({ error: "박스 측정 중 오류 발생" }, { status: 500 })
  }
}

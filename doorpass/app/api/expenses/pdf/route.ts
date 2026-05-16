import { NextRequest, NextResponse } from "next/server"
import { generateExpensePdf } from "../_pdf-generator"
import { requireAuth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("user_id")
    const year   = searchParams.get("year")   ?? String(new Date().getFullYear())
    const period = searchParams.get("period") ?? "all"

    if (!userId) {
      return NextResponse.json({ error: "user_id 필수" }, { status: 400 })
    }

    const { buffer, filename } = await generateExpensePdf(userId, year, period)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF 생성 중 오류"
    if (msg === "데이터 없음") {
      return NextResponse.json({ error: "데이터 없음" }, { status: 404 })
    }
    console.error("PDF 생성 오류:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

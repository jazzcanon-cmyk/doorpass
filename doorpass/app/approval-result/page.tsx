import Link from "next/link"

type Status = "approved" | "rejected" | "already" | "invalid" | "expired" | "error"

const MESSAGES: Record<Status, { title: string; body: string; tone: "ok" | "warn" | "err" }> = {
  approved: {
    title: "승인 완료",
    body: "회원 승인이 완료되었습니다. 신청자에게 안내 메일이 발송됩니다.",
    tone: "ok",
  },
  rejected: {
    title: "거절 처리됨",
    body: "회원 승인이 거절되었습니다. 신청자에게 안내 메일이 발송됩니다.",
    tone: "warn",
  },
  already: {
    title: "이미 처리된 요청",
    body: "이미 처리된 승인 요청입니다. 다른 관리자가 먼저 응답했을 수 있습니다.",
    tone: "warn",
  },
  invalid: {
    title: "유효하지 않은 링크",
    body: "링크가 잘못되었거나 만료되었습니다. 신청자가 다시 가입 신청을 해야 할 수 있습니다.",
    tone: "err",
  },
  expired: {
    title: "만료된 링크",
    body: "승인 링크가 만료되었습니다. 관리자에게 문의하세요.",
    tone: "err",
  },
  error: {
    title: "처리 중 오류",
    body: "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    tone: "err",
  },
}

const TONE_COLORS = {
  ok: "#16a34a",
  warn: "#d97706",
  err: "#dc2626",
} as const

function normalize(input: string | undefined): Status {
  switch (input) {
    case "approved":
    case "rejected":
    case "already":
    case "invalid":
    case "expired":
    case "error":
      return input
    default:
      return "invalid"
  }
}

export default async function ApprovalResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const status = normalize(sp.status)
  const msg = MESSAGES[status]

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f4f5",
        color: "#18181b",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "28rem",
          width: "100%",
          background: "#ffffff",
          borderRadius: "0.75rem",
          padding: "2rem",
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            margin: "0 0 0.5rem",
            color: TONE_COLORS[msg.tone],
          }}
        >
          {msg.title}
        </h1>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.95rem", color: "#52525b", lineHeight: 1.6 }}>
          {msg.body}
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.5rem 1.25rem",
            background: "#2563eb",
            color: "#ffffff",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          DoorPass 홈으로
        </Link>
      </div>
    </main>
  )
}

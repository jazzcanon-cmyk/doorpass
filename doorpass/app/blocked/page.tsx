import Link from "next/link"

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const decodedReason = reason ? decodeURIComponent(reason) : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🚫</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">계정이 차단되었습니다</h1>
          <p className="text-muted-foreground text-sm">
            관리자에 의해 이 계정의 접근이 제한되었습니다.
          </p>
        </div>

        {decodedReason && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-left">
            <p className="text-xs font-medium text-destructive mb-1">차단 사유</p>
            <p className="text-sm text-foreground">{decodedReason}</p>
          </div>
        )}

        <div className="rounded-lg bg-secondary px-4 py-4 text-left space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">문의 방법</p>
          <p className="text-sm text-foreground">차단 해제를 원하시면 관리자에게 직접 문의해 주세요.</p>
        </div>

        <Link
          href="/login"
          className="inline-block text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          로그인 페이지로 돌아가기
        </Link>
      </div>
    </div>
  )
}

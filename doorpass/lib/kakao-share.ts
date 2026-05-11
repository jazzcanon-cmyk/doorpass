// 카카오 JavaScript SDK 공유 헬퍼.
// Step 1에서 layout.tsx가 SDK 스크립트를 lazyOnload로 받아오고,
// 첫 공유 시 NEXT_PUBLIC_KAKAO_JS_KEY 로 init 한다.

interface KakaoShareLink {
  mobileWebUrl: string
  webUrl: string
}

interface KakaoShareApi {
  isInitialized(): boolean
  init(key: string): void
  Share?: {
    sendDefault: (payload: {
      objectType: "feed"
      content: {
        title: string
        description: string
        imageUrl: string
        link: KakaoShareLink
      }
      buttons?: Array<{ title: string; link: KakaoShareLink }>
    }) => void
  }
}

declare global {
  interface Window {
    Kakao?: KakaoShareApi
  }
}

function ensureInitialized(): boolean {
  if (typeof window === "undefined") return false
  const Kakao = window.Kakao
  if (!Kakao) return false
  if (!Kakao.isInitialized()) {
    // NEXT_PUBLIC_KAKAO_JS_KEY 우선, 없으면 NEXT_PUBLIC_KAKAO_REST_API_KEY 폴백
    const key =
      process.env.NEXT_PUBLIC_KAKAO_JS_KEY ??
      process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY
    if (!key) return false
    try {
      Kakao.init(key)
    } catch {
      return false
    }
  }
  return Boolean(Kakao.Share?.sendDefault)
}

export function isKakaoShareReady(): boolean {
  return ensureInitialized()
}

export interface ShareToKakaoOptions {
  referralUrl: string
  referrerName: string
  /** 절대 URL이어야 함. 비워두면 현재 origin의 /icon-512x512.png 사용 */
  imageUrl?: string
}

/**
 * 카카오톡 카드형 메시지 공유.
 * @returns SDK가 초기화되어 sendDefault를 호출한 경우 true.
 */
export function shareToKakao(opts: ShareToKakaoOptions): boolean {
  if (!ensureInitialized()) return false
  const Kakao = window.Kakao
  if (!Kakao?.Share?.sendDefault) return false

  const imageUrl =
    opts.imageUrl ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/icon-512x512.png`
      : "")

  const link: KakaoShareLink = {
    mobileWebUrl: opts.referralUrl,
    webUrl: opts.referralUrl,
  }

  try {
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "DoorPass - 공동현관 비밀번호",
        description: `${opts.referrerName}님이 초대했어요! 건물 비밀번호를 바로 확인하세요. (가입 시 +300P)`,
        imageUrl,
        link,
      },
      buttons: [{ title: "가입하기", link }],
    })
    return true
  } catch {
    return false
  }
}

// ─── 지출내역서 PDF 카카오 공유 ───────────────────────────────────────────────

export interface ShareExpensePdfOptions {
  pdfUrl: string
  year: string
  periodLabel: string
  totalAmount: number
  deductibleAmount: number
}

/**
 * 지출내역서 PDF 링크를 카카오톡 카드형 메시지로 공유.
 * @returns SDK sendDefault 호출 성공 시 true.
 */
export function shareExpensePdf(opts: ShareExpensePdfOptions): boolean {
  if (!ensureInitialized()) return false
  const Kakao = window.Kakao
  if (!Kakao?.Share?.sendDefault) return false

  const imageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/icon-512x512.png`
      : ""

  const link: KakaoShareLink = {
    mobileWebUrl: opts.pdfUrl,
    webUrl:       opts.pdfUrl,
  }

  try {
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title:       `${opts.year}년 ${opts.periodLabel} 지출내역서`,
        description: `총 지출: ${opts.totalAmount.toLocaleString("ko-KR")}원 | 부가세공제: ${opts.deductibleAmount.toLocaleString("ko-KR")}원`,
        imageUrl,
        link,
      },
      buttons: [{ title: "지출내역서 다운로드", link }],
    })
    return true
  } catch {
    return false
  }
}

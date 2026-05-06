interface KakaoChannelButtonProps {
  className?: string
}

export function KakaoChannelButton({ className = "" }: KakaoChannelButtonProps) {
  return (
    <a
      href="https://pf.kakao.com/_tXNxbX"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 active:opacity-80 ${className}`}
      style={{ backgroundColor: "#FEE500", color: "#000000" }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 2C5.582 2 2 5.07 2 8.857c0 2.41 1.388 4.532 3.484 5.802L4.5 18l4.167-2.571c.44.06.888.094 1.333.094 4.418 0 8-3.07 8-6.857S14.418 2 10 2z"
          fill="black"
        />
      </svg>
      카카오 채널 친구추가
    </a>
  )
}

"use client"
import Script from "next/script"

export function KakaoScript() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      strategy="lazyOnload"
      onLoad={() => {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
        if (key && window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(key)
        }
      }}
    />
  )
}

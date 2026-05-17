import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import LeafletPreloader from '@/components/LeafletPreloader'
import { KakaoScript } from '@/components/KakaoScript'
import { Toaster } from 'sonner'

export const viewport: Viewport = {
  themeColor: '#2E3192',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'DoorPass | 공동현관 비밀번호',
  description: '배달/택배 기사를 위한 공동현관 비밀번호 조회 서비스',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DoorPass',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DoorPass" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://xqvisvevzajxxmpzelmw.supabase.co" />
        <link rel="dns-prefetch" href="https://xqvisvevzajxxmpzelmw.supabase.co" />
      </head>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-4VT7N36ZS0"
        strategy="lazyOnload"
      />
      <KakaoScript />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4VT7N36ZS0', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
      <body className="antialiased">
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wljzmlx8np");
          `}
        </Script>
        <LeafletPreloader />
        {children}
        <Toaster position="top-center" richColors />
        <Script id="sw-register" strategy="afterInteractive">{`if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')`}</Script>
      </body>
    </html>
  )
}

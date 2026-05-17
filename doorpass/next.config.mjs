import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { withSentryConfig } from '@sentry/nextjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: resolve(__dirname, '..'),
  },
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xqvisvevzajxxmpzelmw.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
})

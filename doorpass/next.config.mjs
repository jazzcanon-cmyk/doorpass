import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { withSentryConfig } from '@sentry/nextjs'
import bundleAnalyzer from '@next/bundle-analyzer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })

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

export default withBundleAnalyzer(withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
}))

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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xqvisvevzajxxmpzelmw.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
})

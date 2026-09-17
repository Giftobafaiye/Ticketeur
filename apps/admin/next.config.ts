import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@ticketur/ui', '@ticketur/observability'],
  experimental: {
    // Tree-shake huge barrel packages so only referenced members are bundled.
    // @hugeicons/* aren't in Next's built-in optimizePackageImports list.
    optimizePackageImports: [
      '@hugeicons/core-free-icons',
      '@hugeicons/react',
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

export default nextConfig

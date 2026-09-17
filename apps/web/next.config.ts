import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    appNewScrollHandler: true,
    // Tree-shake huge barrel packages so only referenced members are bundled.
    // @hugeicons/* aren't in Next's built-in optimizePackageImports list
    // (date-fns / lucide-react already are), and they're imported app-wide.
    optimizePackageImports: [
      '@hugeicons/core-free-icons',
      '@hugeicons/react',
    ],
  },
  transpilePackages: ['@ticketur/ui', '@ticketur/observability'],
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
  allowedDevOrigins: ['192.168.0.67'],
  async redirects() {
    return [
      {
        source: '/organizers/new',
        destination: '/signup?role=organizer',
        permanent: false,
      },
      {
        source: '/vendors/apply',
        destination: '/signup?role=vendor',
        permanent: false,
      },
    ]
  },
}

export default nextConfig

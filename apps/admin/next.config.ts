import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@ticketur/ui', '@ticketur/observability'],
  // Same as apps/web: pdfkit 0.21 finds its data files through
  // import.meta.url, which bundling breaks. Admin reaches it through the
  // shared router (ticket PDFs), so it is kept external here too.
  serverExternalPackages: ['pdfkit'],
  experimental: {
    // Tree-shake huge barrel packages so only referenced members are bundled.
    // @hugeicons/* aren't in Next's built-in optimizePackageImports list.
    optimizePackageImports: [
      '@hugeicons/core-free-icons',
      '@hugeicons/react',
    ],
  },
  compiler: {
    // Keep error/warn diagnostics in production. `true` stripped every
    // console.* call, including the apps own console.error reports (e.g.
    // "webhook fulfillment failed", "PDF generation failed"), so a
    // production deploy with no Axiom token emitted nothing anywhere.
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
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

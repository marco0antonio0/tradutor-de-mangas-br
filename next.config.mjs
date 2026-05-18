/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    proxyClientMaxBodySize: '100mb',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig

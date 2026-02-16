/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  devIndicators: false,
  images: {
    unoptimized: true,
    domains: ['localhost', '192.168.1.8'],
  },
  async headers() {
    return [
      // Global headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self)', // allow camera for same-origin
          },
        ],
      },
      //  Existing logo caching rule
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
    // Cache all SVG files for 1 year
      {
        source: '/:path*.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
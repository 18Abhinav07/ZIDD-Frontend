const backendInternalUrl = process.env.BACKEND_INTERNAL_URL;

if (!backendInternalUrl) {
  throw new Error('BACKEND_INTERNAL_URL is required for API rewrites');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Exclude /api/auth/* so NextAuth owns sign-in/callback/session.
      // Exclude /api/session/* so the explicit route handler can stream SSE and
      // preserve structured 402 bodies without the generic rewrite timing out.
      {
        source: '/api/:path((?!auth/)(?!session/).*)',
        destination: `${backendInternalUrl}/:path`,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fifth-gentle-45902158.figma.site',
      }
    ]
  }
};

export default nextConfig;

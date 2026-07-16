const backendInternalUrl = process.env.BACKEND_INTERNAL_URL;
const requestedDistDir = process.env.NEXT_DIST_DIR || '.next';

if (!/^\.next(?:[-.][A-Za-z0-9]+)*$/.test(requestedDistDir)) {
  throw new Error('NEXT_DIST_DIR must be a repo-local .next-style directory name');
}

const distDir = requestedDistDir;

if (!backendInternalUrl) {
  throw new Error('BACKEND_INTERNAL_URL is required for API rewrites');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  async rewrites() {
    return [
      // Exclude /api/auth/* so NextAuth owns sign-in/callback/session.
      // Exclude /api/session/* so the explicit route handler can stream SSE and
      // preserve structured 402 bodies without the generic rewrite timing out.
      {
        source: '/api/:path((?!auth/)(?!session/)(?!school/).*)',
        destination: `${backendInternalUrl}/:path`,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fifth-gentle-45902158.figma.site',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
    ]
  }
};

export default nextConfig;

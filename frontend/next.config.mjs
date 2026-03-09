/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from issuing 308 redirects that strip trailing slashes
  // on /api/v1/* routes. FastAPI expects trailing slashes on root endpoints;
  // without this, POST /citizens/ gets 308 → /citizens → 307 loop → failure.
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        // Proxy all /api/v1/* requests to the FastAPI backend
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
      {
        // Proxy the /health endpoint
        source: "/api/health",
        destination: "http://localhost:8000/health",
      },
    ]
  },
}

export default nextConfig

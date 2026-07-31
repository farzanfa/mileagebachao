/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The read layer falls back to committed seed JSON, so the app builds with no
  // database and no secrets (BUILD-CONTRACT §2). Keep server-only packages external.
  serverExternalPackages: ["postgres"],
  eslint: {
    // CI runs `next lint` as a separate step; do not fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

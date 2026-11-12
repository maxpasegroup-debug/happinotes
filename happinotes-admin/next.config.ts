import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/admin/sw.js', headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Service-Worker-Allowed', value: '/admin/' },
      ] },
      { source: '/admin/manifest.webmanifest', headers: [
        { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache' },
      ] },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "happinotes.in" },
      { protocol: "https", hostname: "happinotes-production-6b44.up.railway.app" },
    ],
  },
};

export default nextConfig;

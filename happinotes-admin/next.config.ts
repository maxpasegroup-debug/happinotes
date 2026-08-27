import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

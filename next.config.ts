import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S2: aplicação não deve ser indexada — não é pública por design.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

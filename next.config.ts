import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // One 404 page with the site layout for URLs that match no route. The app
    // has two root layouts ((en), (es)), so there is no shared layout for them.
    globalNotFound: true,
  },
};

export default nextConfig;

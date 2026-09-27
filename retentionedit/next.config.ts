import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolate development output from production build so that running
  // `next build` or type checks never wipes or corrupts a running `next dev` server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // Serverless needs real ffmpeg/ffprobe binaries: file-tracing does not
  // follow the dynamic paths returned by ffmpeg-static/ffprobe-static, so
  // include the two linux/x64 binaries explicitly (~110MB, under the 250MB
  // function limit). media-bins.ts resolves them at runtime.
  // Keys are ROUTE paths (not src paths).
  outputFileTracingIncludes: {
    "/api/local-render/start": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./assets/fonts/Inter-Bold.woff",
    ],
    "/api/local-render/status": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./assets/fonts/Inter-Bold.woff",
    ],
    "/api/local-render/file": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./assets/fonts/Inter-Bold.woff",
    ],
    "/api/diag": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // HSTS only over https; harmless on http (ignored).
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      // Baseline CSP (adjust if you embed external media). Tight by default.
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: https:",
          "frame-src 'self' https://accounts.google.com",
          "connect-src 'self' https://api.anthropic.com https://api.elevenlabs.io https://api.higgsfield.ai https://*.modal.run https://*.supabase.co https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

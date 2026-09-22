/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'assets.higgsfield.ai' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // CSP: allow Supabase, Stripe, YouTube embeds & images, self
          { 
            key: 'Content-Security-Policy', 
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.youtube.com https://s.ytimg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https: blob: data:",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.elevenlabs.io https://www.youtube.com https://*.googlevideo.com https://*.google.com",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
              "child-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com blob:"
            ].join('; ') + ';'
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

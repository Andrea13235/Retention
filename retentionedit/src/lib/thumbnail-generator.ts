import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VideoFormat } from "./types";

export interface ThumbnailOptions {
  jobId: string;
  title: string;
  badge?: string;
  format?: VideoFormat;
  framePathOrBuffer?: string | Buffer | null;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * High-CTR YouTube Cover Generator
 * Generates an eye-catching YouTube thumbnail composite with:
 * - Rich dark vignette / background
 * - Neon emerald badge ("VIRAL HOOK", "RETENTION 98%")
 * - High-contrast bold typography with drop shadow
 * Returns the public URL path: /thumbnails/<jobId>.png
 */
export async function generateYouTubeCover(options: ThumbnailOptions): Promise<string> {
  const { jobId, title, badge = "VIRAL HOOK", format = "short", framePathOrBuffer } = options;
  const isShort = format === "short";
  const width = isShort ? 1080 : 1280;
  const height = isShort ? 1920 : 720;

  // Clean title for thumbnail headline: uppercase, punchy max 4-6 words
  const words = title
    .replace(/[()]/g, "")
    .replace(/[:!?]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .toUpperCase();

  const headline = words.length > 30 ? words.slice(0, 28) + "..." : words || "VIRAL EDIT";
  const badgeText = (badge || "VIRAL HOOK").toUpperCase().slice(0, 18);

  const outDir = path.join(process.cwd(), "public", "thumbnails");
  try {
    mkdirSync(outDir, { recursive: true });
  } catch {}

  const outFilename = `${jobId}.png`;
  const outPath = path.join(outDir, outFilename);

  const badgeWidth = Math.max(160, badgeText.length * 14 + 40);
  const badgeX = isShort ? 80 : 70;
  const badgeY = isShort ? 180 : 70;
  const headlineY = isShort ? 320 : 180;
  const fontSize = isShort ? 64 : 58;

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#050508" stop-opacity="0.8"/>
          <stop offset="40%" stop-color="#000000" stop-opacity="0.25"/>
          <stop offset="70%" stop-color="#000000" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#050508" stop-opacity="0.95"/>
        </linearGradient>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000000" flood-opacity="0.95"/>
        </filter>
        <filter id="badgeGlow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#10b981" flood-opacity="0.6"/>
        </filter>
      </defs>
      <!-- Vignette overlay for text readability -->
      <rect width="${width}" height="${height}" fill="url(#vignette)"/>
      <!-- Neon Emerald Badge -->
      <g filter="url(#badgeGlow)">
        <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="42" rx="21" fill="url(#badgeGrad)"/>
        <text x="${badgeX + badgeWidth / 2}" y="${badgeY + 28}" font-family="Arial Black, Impact, sans-serif" font-size="18" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="1">${badgeText}</text>
      </g>
      <!-- Main High-CTR Headline -->
      <g filter="url(#glow)">
        <text x="${badgeX}" y="${headlineY}" font-family="Impact, Arial Black, Montserrat, sans-serif" font-size="${fontSize}" font-weight="900" fill="#ffffff" letter-spacing="0.5">
          ${escapeXml(headline)}
        </text>
      </g>
    </svg>
  `);

  try {
    let base: sharp.Sharp;
    if (
      framePathOrBuffer &&
      (typeof framePathOrBuffer === "string" ? existsSync(framePathOrBuffer) : Buffer.isBuffer(framePathOrBuffer))
    ) {
      base = sharp(framePathOrBuffer).resize(width, height, { fit: "cover" });
    } else {
      // Find a sample frame in public/videos or public/images
      const sampleFrame = isShort
        ? path.join(process.cwd(), "public", "videos", "raw-vlog.jpg")
        : path.join(process.cwd(), "public", "videos", "final-horizontal.jpg");
      if (existsSync(sampleFrame)) {
        base = sharp(sampleFrame).resize(width, height, { fit: "cover" });
      } else {
        base = sharp({
          create: {
            width,
            height,
            channels: 4,
            background: { r: 16, g: 17, b: 24, alpha: 1 },
          },
        });
      }
    }

    const outputBuffer = await base
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png({ quality: 90 })
      .toBuffer();

    writeFileSync(outPath, outputBuffer);
    return `/thumbnails/${outFilename}`;
  } catch (err) {
    console.warn("Error generating sharp thumbnail cover:", err);
    return isShort ? "/videos/raw-vlog.jpg" : "/videos/final-horizontal.jpg";
  }
}

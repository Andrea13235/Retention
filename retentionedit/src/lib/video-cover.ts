"use client";

export interface CoverOverlayOptions {
  title?: string;
  badge?: string;
  niche?: string;
}

/**
 * Capture a real frame of the video and apply YouTube high-CTR graphic styling:
 * - High-contrast cinematic vignette / gradient
 * - Neon emerald badge pill ("VIRAL HOOK")
 * - Punchy bold uppercase headline text with drop shadow
 * Returns a high-quality dataURL (PNG/JPEG).
 */
export async function captureVideoCover(
  url: string,
  atSec?: number,
  options?: CoverOverlayOptions
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof document === "undefined" || !url) {
        resolve(null);
        return;
      }
      const video = document.createElement("video");
      video.muted = true;
      (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      const cleanup = () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 7000);

      video.onloadedmetadata = () => {
        try {
          const duration = video.duration;
          const target = atSec ?? Math.min(1.8, Math.max(0.3, (duration || 3) / 3));
          video.currentTime = Number.isFinite(target) ? target : 0.5;
        } catch {
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
      };

      video.onseeked = () => {
        try {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 360;
          const w = 640;
          const h = Math.max(1, Math.round((w * vh) / vw));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            clearTimeout(timer);
            cleanup();
            resolve(null);
            return;
          }

          // 1. Draw video frame
          ctx.drawImage(video, 0, 0, w, h);

          // 2. High-CTR YouTube Vignette / Gradient Overlay
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "rgba(5, 5, 8, 0.75)");
          grad.addColorStop(0.35, "rgba(0, 0, 0, 0.15)");
          grad.addColorStop(0.7, "rgba(0, 0, 0, 0.25)");
          grad.addColorStop(1, "rgba(5, 5, 8, 0.85)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // 3. Neon Emerald Badge Pill
          const badgeText = (options?.badge || "VIRAL HOOK").toUpperCase().slice(0, 16);
          const badgeX = 24;
          const badgeY = 24;
          const badgeH = 26;
          ctx.font = "bold 11px sans-serif";
          const badgeTextW = ctx.measureText(badgeText).width;
          const badgeW = badgeTextW + 24;

          // Draw pill
          ctx.save();
          ctx.fillStyle = "#10b981";
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 13);
          ctx.fill();
          ctx.restore();

          // Badge text
          ctx.fillStyle = "#000000";
          ctx.font = "900 11px sans-serif";
          ctx.fillText(badgeText, badgeX + 12, badgeY + 17);

          // 4. Punchy YouTube Headline
          let rawHeadline = (options?.title || "DO THIS NOW!").toUpperCase();
          // Clean up technical characters or extensions
          rawHeadline = rawHeadline.replace(/\.[a-z0-9]+$/i, "").replace(/[()_]/g, " ").trim();
          const headlineWords = rawHeadline.split(/\s+/).slice(0, 4).join(" ");
          const headline = headlineWords.length > 24 ? headlineWords.slice(0, 22) + "..." : headlineWords;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.95)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = "#ffffff";
          ctx.font = "900 28px Impact, Arial Black, sans-serif";
          ctx.fillText(headline, badgeX, badgeY + 65);
          ctx.restore();

          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          clearTimeout(timer);
          cleanup();
          resolve(dataUrl);
        } catch {
          clearTimeout(timer);
          cleanup();
          resolve(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      };

      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

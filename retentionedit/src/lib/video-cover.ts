"use client";

/**
 * Capture a real frame of the edited video as its cover image.
 * Same-origin URLs (local files, /videos/...) draw cleanly to canvas;
 * remote URLs that taint the canvas resolve to null (caller falls back
 * to the live <video> first-frame preview).
 */
export async function captureVideoCover(
  url: string,
  atSec?: number
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
      }, 9000);

      video.onloadedmetadata = () => {
        try {
          const duration = video.duration;
          const target =
            atSec ?? Math.min(1.6, Math.max(0.2, (duration || 3) / 3));
          video.currentTime = Number.isFinite(target) ? target : 0.2;
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
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
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

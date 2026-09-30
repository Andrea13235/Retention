import { EditPlan, QualityGateResult } from "./types";
import { getSecret } from "./vault-store";

/**
 * Modal.com Serverless GPU Worker Client (Hardened & Multi-Tenant Isolated).
 * Dispatches heavy rendering, NVENC hardware encoding, and frame verification to Modal GPU containers.
 *
 * Security:
 * - Mutual Bearer token authentication (MODAL_AUTH_TOKEN).
 * - Per-user tenant isolation: user_id is always transmitted and checked.
 * - Private inputs: r2:// URLs are resolved to short-lived (30m) presigned GET URLs so raw footage stays private.
 * - Private outputs: results are saved under the user's isolated exports/ directory.
 */

function isPlaceholder(v: string): boolean {
  const s = (v || "").trim();
  if (!s) return true;
  return [/your_.*_here/i, /your-workspace/i, /^https?:\/\/$/].some((re) => re.test(s));
}

export class ModalGPUClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    const fromEnv = (endpoint || process.env.MODAL_RENDER_ENDPOINT || "").trim();
    this.endpoint = isPlaceholder(fromEnv) ? "" : fromEnv;
  }

  /** True quando c'è un endpoint GPU reale configurato (non placeholder). */
  public hasEndpoint(): boolean {
    return this.endpoint.length > 0;
  }

  /**
   * Dispatches the EditPlan and source video to Modal.com serverless GPU cluster.
   * If rawVideoUrl is r2://..., it is resolved to a private short-lived presigned GET server-side.
   */
  public async renderVideo(params: {
    jobId: string;
    userId?: string;
    rawVideoUrl: string;
    editPlan: EditPlan;
  }): Promise<{
    renderedVideoUrl: string;
    thumbnailUrl: string;
    qualityGate: QualityGateResult;
  }> {
    const { jobId, userId = "default" } = params;
    const rawVideoUrl = await this.resolveMediaUrl(params.rawVideoUrl);
    const { editPlan } = params;

    // Live Modal GPU with Bearer token authentication
    if (this.endpoint) {
      try {
        const authToken = getSecret("modal") || process.env.MODAL_AUTH_TOKEN;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken && authToken.trim().length > 0 && !isPlaceholder(authToken)) {
          headers["Authorization"] = `Bearer ${authToken.trim()}`;
        }

        const response = await fetch(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            job_id: jobId,
            user_id: userId,
            raw_video_url: rawVideoUrl,
            edit_plan: editPlan,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const modalVideo = result.rendered_video_url || result.renderedVideoUrl || "";
          // If worker returned a legacy or mock public R2 domain, re-map to private user-isolated r2:// URI
          let safeRenderedUrl = modalVideo;
          if (modalVideo.includes("r2.retentionedit.com")) {
            safeRenderedUrl = `r2://exports/${userId}/${jobId}_final.mp4`;
          } else if (!modalVideo || modalVideo.includes("your_")) {
            safeRenderedUrl = rawVideoUrl;
          }

          const modalThumb = result.thumbnail_url || result.thumbnailUrl || "";
          let safeThumbUrl = modalThumb;
          if (modalThumb.includes("r2.retentionedit.com")) {
            safeThumbUrl = `r2://thumbnails/${userId}/${jobId}_cover.png`;
          } else if (!modalThumb || modalThumb.includes("your_")) {
            safeThumbUrl = "/images/hero-preview.png";
          }

          return {
            renderedVideoUrl: safeRenderedUrl || rawVideoUrl,
            thumbnailUrl: safeThumbUrl,
            // Quality gate REALE del worker — niente score inventato: se il
            // worker non lo restituisce, passato=false (mai 9.8 finto).
            qualityGate: result.quality_gate || result.qualityGate || {
              passed: false,
              score: 0,
              pillars: {
                beat_sync: false,
                safe_areas: false,
                typography_contrast: false,
                facial_clearance: false,
                thumbnail_magnetism: false,
              },
              checked_frames_count: 0,
              verified_timestamp: new Date().toISOString(),
            },
          };
        }
        console.warn(`[modal] GPU endpoint returned HTTP ${response.status}, using local engine.`);
      } catch (err) {
        console.warn("Modal.com GPU endpoint unreachable, utilizing local engine:", err);
      }
    }

    // Fallback locale/dev: NESSUN render finto — restituisce il raw così com'è
    // e qualityGate NON passato (score 0 = non misurato, mai inventato).
    // Il video "editato" nasce solo dal montaggio reale (bake/render col piano).
    return {
      renderedVideoUrl: rawVideoUrl,
      thumbnailUrl: "/images/hero-preview.png",
      qualityGate: {
        passed: false,
        score: 0,
        pillars: {
          beat_sync: false,
          safe_areas: false,
          typography_contrast: false,
          facial_clearance: false,
          thumbnail_magnetism: false,
        },
        checked_frames_count: 0,
        verified_timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Resolves media URL: if it is an r2:// private URI, generate a short-lived
   * presigned GET URL (1800s / 30m) so that serverless GPU workers can stream
   * the video privately without making the bucket public.
   */
  private async resolveMediaUrl(url: string): Promise<string> {
    if (url.startsWith("r2://")) {
      try {
        const { presignPrivateGetUrl } = await import("./r2");
        const key = url.slice(5);
        return presignPrivateGetUrl(key, 1800) ?? url;
      } catch {
        return url;
      }
    }
    return url;
  }
}

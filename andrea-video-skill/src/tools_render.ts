/**
 * tools_render.ts — Step 5+6: traduzione in progetto HyperFrames + render (spec §4).
 * build_hyperframes_project(edit_plan) genera una composition standalone
 * (contratto hyperframes-core: root sized, una timeline paused, data-* timing).
 * render_video(project) esegue `hyperframes render` con preset draft/standard/high.
 */
import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  RENDER_PRESETS,
  timecodeToSec,
  type EditPlan,
  type RenderPreset,
} from "./types.js";

const execFileAsync = promisify(execFile);

export interface HyperframesProject {
  /** Cartella del progetto generato (contiene index.html + hyperframes.json). */
  dir: string;
  compositionId: string;
  durationSec: number;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface BuildOptions {
  /**
   * Path del RAW originale. Viene COPIATO dentro outDir/assets/ e
   * referenziato con path relativo — il renderer salta gli asset assenti
   * (missing_local_asset), quindi mai path assoluti esterni.
   */
  rawVideoPath?: string;
  width?: number;
  height?: number;
}

export async function buildHyperframesProject(
  plan: EditPlan,
  outDir: string,
  opts: BuildOptions = {}
): Promise<HyperframesProject> {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const compositionId = `andrea-edit-${plan.media_id.slice(0, 8)}`;

  // Durata = fine dell'ultimo cut da tenere (escludi i TAGLIARE).
  const keepCuts = plan.cuts.filter((c) => !c.reason.startsWith("TAGLIARE"));
  const durationSec = Math.max(
    1,
    ...keepCuts.map((c) => timecodeToSec(c.end)),
    ...plan.pattern_interrupts.map((p) => timecodeToSec(p.time))
  );

  // Asset: copia il RAW dentro il progetto (mai path esterni).
  let videoSrc: string | null = null;
  if (opts.rawVideoPath) {
    const { copyFile, stat: statFile } = await import("node:fs/promises");
    const st = await statFile(opts.rawVideoPath).catch(() => null);
    if (!st || !st.isFile())
      throw new Error(`build: RAW non trovato: ${opts.rawVideoPath}`);
    await mkdir(join(outDir, "assets"), { recursive: true });
    const fileName = opts.rawVideoPath.split("/").pop() ?? "raw.mp4";
    await copyFile(opts.rawVideoPath, join(outDir, "assets", fileName));
    videoSrc = `./assets/${fileName}`;
  }

  // Contratto media HyperFrames (verificato su CLI 0.8.40):
  // - il TIMING sta sul <video> stesso (data-start + data-duration);
  // - MAI un antenato timed attorno al <video> (video_nested_in_timed_element);
  // - <video> con src richiede data-start (media_missing_data_start).
  const clips = keepCuts
    .map((c, i) => {
      const start = timecodeToSec(c.start);
      const dur = timecodeToSec(c.end) - start;
      if (dur <= 0) return "";
      // id univoco + data-has-audio: il renderer scopre i media via id
      // (media_missing_id) e il RAW parlato deve contribuire l'audio.
      const media = videoSrc
        ? `<video id="clip-video-${i}" src="${escHtml(videoSrc)}" data-start="${start}" data-duration="${dur}" data-has-audio="true" style="width:100%;height:100%;object-fit:cover"></video>`
        : `<div class="clip placeholder" data-start="${start}" data-duration="${dur}"><div>CLIP ${i + 1}<br/><span>${escHtml(c.reason)}</span></div></div>`;
      // Wrapper div SENZA timing: contiene solo il styling full-bleed.
      return `      <div id="clip-${i}" class="fullbleed">\n        ${media}\n      </div>`;
    })
    .join("\n");

  const overlays = plan.animations
    .map((a, i) => {
      const t = timecodeToSec(a.time);
      if (a.type === "text_overlay" || a.type === "caption") {
        const pos =
          a.position === "top"
            ? "top:8%"
            : a.position === "center"
              ? "top:42%"
              : "bottom:10%";
        return `      <div id="ov-${i}" class="clip overlay" data-start="${t}" data-duration="3" style="${pos}">\n        <span>${escHtml(a.content ?? "")}</span>\n      </div>`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const beats = plan.pattern_interrupts
    .map((p, i) => {
      const t = timecodeToSec(p.time);
      return `      tl.fromTo("#punch-${i}", { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }, ${t});`;
    })
    .join("\n");
  const punchDivs = plan.pattern_interrupts
    .map((p, i) => {
      const t = timecodeToSec(p.time);
      return `      <div id="punch-${i}" class="clip punch" data-start="${t}" data-duration="0.6"></div>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escHtml(compositionId)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #000; color: #fff; font-family: Inter, system-ui, sans-serif; }
      #root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: #0b0f14; }
      .fullbleed { position: absolute; inset: 0; }
      .fullbleed video { width: 100%; height: 100%; object-fit: cover; display: block; }
      .clip.placeholder { position: absolute; inset: 0; display: grid; place-items: center; }
      .placeholder { text-align: center; font-size: 64px; font-weight: 800; }
      .placeholder span { font-size: 28px; font-weight: 400; opacity: 0.7; }
      .overlay { position: absolute; left: 0; right: 0; text-align: center; z-index: 10; }
      .overlay span { display: inline-block; background: rgba(0,0,0,0.65); padding: 12px 28px; border-radius: 12px; font-size: 56px; font-weight: 800; }
      .punch { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${compositionId}" data-start="0" data-width="${width}" data-height="${height}" data-duration="${durationSec}">
${clips}
${overlays}
${punchDivs}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${beats}
      window.__timelines["${compositionId}"] = tl;
    </script>
  </body>
</html>
`;

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), html);
  await writeFile(
    join(outDir, "hyperframes.json"),
    JSON.stringify({ compositionId, generatedBy: "andrea-video-skill" }, null, 2)
  );
  return { dir: outDir, compositionId, durationSec };
}

export interface RenderOptions {
  preset?: RenderPreset;
  output?: string;
  timeoutMs?: number;
}

export async function renderVideo(
  project: HyperframesProject,
  opts: RenderOptions = {}
): Promise<string> {
  const preset = opts.preset ?? "standard";
  const output = opts.output ?? join(project.dir, "output.mp4");

  // CLI reale (hyperframes 0.8.40): `render [DIR] -o OUTPUT -q QUALITY`.
  // Quality valide: draft | looks | delivery | standard | high.
  // Mappiamo i preset della skill (§2): draft→draft, standard→looks, high→delivery.
  const quality = preset === "draft" ? "draft" : preset === "high" ? "delivery" : "looks";

  const { existsSync } = await import("node:fs");
  const findLocalBin = (start: string): string | null => {
    let dir = start;
    for (let i = 0; i < 6; i++) {
      const cand = join(dir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      if (existsSync(cand)) return cand;
      const parent = join(dir, "..");
      if (parent === dir) return null;
      dir = parent;
    }
    return null;
  };
  const localBin = process.env.HF_CLI_PATH ?? findLocalBin(project.dir);

  try {
    if (localBin) {
      await execFileAsync(process.execPath, [localBin, "render", project.dir, "--quality", quality, "--output", output], {
        timeout: opts.timeoutMs ?? 30 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
    } else {
      await execFileAsync("npx", ["hyperframes", "render", project.dir, "--quality", quality, "--output", output], {
        timeout: opts.timeoutMs ?? 30 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
    }
  } catch (err) {
    throw new Error(
      `render_video: hyperframes render fallito — ${(err as Error).message}`
    );
  }

  const st = await stat(output).catch(() => null);
  if (!st || st.size === 0)
    throw new Error(`render_video: output mancante o vuoto: ${output}`);
  return output;
}

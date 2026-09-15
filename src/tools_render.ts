/**
 * tools_render.ts — Step 5+6: HyperFrames project build + render.
 * build_hyperframes_project(edit_plan) generates a standalone composition
 * (hyperframes-core contract: sized root, one paused timeline, data-* timing).
 * render_video(project) runs `hyperframes render` with draft/standard/high presets.
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
  /** Generated project folder (contains index.html + hyperframes.json). */
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
   * Path of the original RAW. It is COPIED into outDir/assets/ and
   * referenced with a relative path — the renderer skips missing assets
   * (missing_local_asset), so never use external absolute paths.
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

  // Duration = end of the last KEEP cut (exclude CUTs).
  const keepCuts = plan.cuts.filter((c) => !c.reason.startsWith("CUT"));
  const durationSec = Math.max(
    1,
    ...keepCuts.map((c) => timecodeToSec(c.end)),
    ...plan.pattern_interrupts.map((p) => timecodeToSec(p.time))
  );

  // Asset: copy the RAW into the project (never external paths).
  let videoSrc: string | null = null;
  if (opts.rawVideoPath) {
    const { copyFile, stat: statFile } = await import("node:fs/promises");
    const st = await statFile(opts.rawVideoPath).catch(() => null);
    if (!st || !st.isFile())
      throw new Error(`build: RAW not found: ${opts.rawVideoPath}`);
    await mkdir(join(outDir, "assets"), { recursive: true });
    const fileName = opts.rawVideoPath.split("/").pop() ?? "raw.mp4";
    await copyFile(opts.rawVideoPath, join(outDir, "assets", fileName));
    videoSrc = `./assets/${fileName}`;
  }

  // HyperFrames media contract (verified on CLI 0.8.40):
  // - TIMING lives on the <video> itself (data-start + data-duration);
  // - NEVER a timed ancestor around <video> (video_nested_in_timed_element);
  // - <video> with src requires data-start (media_missing_data_start).
  const clips = keepCuts
    .map((c, i) => {
      const start = timecodeToSec(c.start);
      const dur = timecodeToSec(c.end) - start;
      if (dur <= 0) return "";
      // Unique id + data-has-audio: the renderer discovers media via id
      // (media_missing_id) and spoken RAW must contribute audio.
      const media = videoSrc
        ? `<video id="clip-video-${i}" src="${escHtml(videoSrc)}" data-start="${start}" data-duration="${dur}" data-has-audio="true" style="width:100%;height:100%;object-fit:cover"></video>`
        : `<div class="clip placeholder" data-start="${start}" data-duration="${dur}"><div>CLIP ${i + 1}<br/><span>${escHtml(c.reason)}</span></div></div>`;
      // Wrapper div WITHOUT timing: only full-bleed styling.
      // Its id (#clip-i) is the GSAP target for slow_zoom / zoom punch tweens.
      return `      <div id="clip-${i}" class="fullbleed">\n        ${media}\n      </div>`;
    })
    .join("\n");

  // Overlay animations: captions/text/lower-thirds (timed divs) and
  // zoom tweens (GSAP on the clip wrapper — no silent drops: zoom_in,
  // zoom_out and slow_zoom all render as visible motion).
  //
  // Time → clip mapping: a zoom at time t targets the wrapper of the
  // KEEP cut active at t; if none is active, it targets #root.
  const cutAt = (t: number): number => {
    for (let i = 0; i < keepCuts.length; i++) {
      const s = timecodeToSec(keepCuts[i].start);
      const e = timecodeToSec(keepCuts[i].end);
      if (t >= s && t < e) return i;
    }
    return -1;
  };

  const overlayDivs: string[] = [];
  const zoomTweens: string[] = [];
  plan.animations.forEach((a, i) => {
    const t = timecodeToSec(a.time);
    if (
      a.type === "text_overlay" ||
      a.type === "caption" ||
      a.type === "lower_third"
    ) {
      const dur = Math.max(0.5, Math.min(a.duration ?? 3, 15));
      const cls =
        a.type === "lower_third" ? "clip overlay lower3rd" : "clip overlay";
      const pos =
        a.position === "top"
          ? "top:8%"
          : a.position === "center"
            ? "top:42%"
            : "bottom:10%";
      overlayDivs.push(
        `      <div id="ov-${i}" class="${cls}" data-start="${t}" data-duration="${dur}" style="${pos}">\n        <span>${escHtml(a.content ?? "")}</span>\n      </div>`
      );
    } else if (
      a.type === "zoom_in" ||
      a.type === "zoom_out" ||
      a.type === "slow_zoom"
    ) {
      const idx = cutAt(t);
      const target = idx >= 0 ? `#clip-${idx}` : "#root";
      if (a.type === "slow_zoom") {
        // Progressive scale over the whole visible duration (default 8s):
        // subtle continuous motion, 2–5 %/s as the analysis guide suggests.
        const dir = a.direction ?? "in";
        const rate = Math.max(0.5, Math.min(a.intensity ?? 3, 10)) / 100;
        const dur = Math.max(1, Math.min(a.duration ?? 8, 30));
        const from = dir === "out" ? 1 + rate * dur : 1;
        const to = dir === "out" ? 1 : 1 + rate * dur;
        zoomTweens.push(
          `      tl.fromTo("${target}", { scale: ${from.toFixed(3)} }, { scale: ${to.toFixed(3)}, duration: ${dur}, ease: "none" }, ${t});`
        );
      } else {
        // Punch zoom: quick in-and-back (re-engage on attention dips).
        const peak = a.type === "zoom_in" ? 1.08 : 0.94;
        zoomTweens.push(
          `      tl.fromTo("${target}", { scale: 1 }, { scale: ${peak}, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }, ${t});`
        );
      }
    }
    // "transition" is a cut-level concern (jump cut between clips) and is
    // already expressed by the cuts list — nothing extra to render.
  });
  const overlays = overlayDivs.join("\n");

  const beats = [
    ...zoomTweens,
    ...plan.pattern_interrupts.map((p, i) => {
      const t = timecodeToSec(p.time);
      return `      tl.fromTo("#punch-${i}", { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }, ${t});`;
    }),
  ].join("\n");
  const punchDivs = plan.pattern_interrupts
    .map((p, i) => {
      const t = timecodeToSec(p.time);
      return `      <div id="punch-${i}" class="clip punch" data-start="${t}" data-duration="0.6"></div>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
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
      .overlay.lower3rd { text-align: left; }
      .overlay.lower3rd span { font-size: 34px; font-weight: 600; border-left: 8px solid #4da3ff; border-radius: 0 12px 12px 0; }
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

  // Real CLI (hyperframes 0.8.40): `render [DIR] -o OUTPUT -q QUALITY`.
  // Valid qualities: draft | looks | delivery | standard | high.
  // Skill preset mapping: draft→draft, standard→looks, high→delivery.
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
      `render_video: hyperframes render failed — ${(err as Error).message}`
    );
  }

  const st = await stat(output).catch(() => null);
  if (!st || st.size === 0)
    throw new Error(`render_video: missing or empty output: ${output}`);
  return output;
}

/**
 * tools_render.ts — Step 5+6: HyperFrames project build + render.
 * build_hyperframes_project(edit_plan) generates a standalone composition
 * (hyperframes-core contract: sized root, one paused timeline, data-* timing).
 * render_video(project) runs `hyperframes render` with draft/standard/high presets.
 */
import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import {
  CANVAS,
  motionSpanAllowed,
  motionSpanDuration,
  RENDER_PRESETS,
  secToTimecode,
  timecodeToSec,
  type EditPlan,
  type MotionKind,
  type RenderPreset,
  type ThumbnailConfig,
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
  /**
   * Canvas override. Default: from plan.format (short → 1080×1920,
   * long → 1920×1080). Explicit width/height still win when both set.
   */
  width?: number;
  height?: number;
}

export async function buildHyperframesProject(
  plan: EditPlan,
  outDir: string,
  opts: BuildOptions = {}
): Promise<HyperframesProject> {
  // Canvas follows the plan format (v1.2): shorts render 1080×1920,
  // long-form 1920×1080. Explicit opts override (back-compat).
  // NOTE: plan.version "1.0"/"1.1" have no format → default long.
  // v1.2 plans have no graphics/takesCount — handled as empty/absent.
  const canvas = CANVAS[(plan as EditPlan).format ?? "long"] ?? CANVAS.long;
  const width = opts.width ?? canvas.width;
  const height = opts.height ?? canvas.height;
  const portrait = height > width;
  const compositionId = `retention-edit-${plan.media_id.slice(0, 8)}`;

  // Duration + source→timeline map: KEEP cuts (exclude CUTs) are sorted
  // and laid edge-to-edge on the output timeline. For each KEEP range we
  // record { srcStart, tlStart } so animations authored in SOURCE time
  // remap onto the OUTPUT timeline (post-splice clock).
  const keepCuts = plan.cuts
    .filter((c) => !c.reason.startsWith("CUT"))
    .map((c) => ({ start: timecodeToSec(c.start), end: timecodeToSec(c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const tlSpans: Array<{ srcStart: number; tlStart: number; dur: number }> = [];
  let tlCursor = 0;
  for (const c of keepCuts) {
    const dur = c.end - c.start;
    tlSpans.push({ srcStart: c.start, tlStart: tlCursor, dur });
    tlCursor += dur;
  }
  const srcToTl = (src: number): number | null => {
    for (const s of tlSpans) {
      if (src >= s.srcStart && src < s.srcStart + s.dur)
        return s.tlStart + (src - s.srcStart);
    }
    return null; // inside a CUT range — dropped
  };

  // ——— Plan validation (fail loud, never render garbage) ———
  // A hand-written or third-party plan can still violate the two
  // invisibility guarantees. The planner enforces them by construction,
  // but the renderer is the last gate: any violation throws with the
  // exact fix, instead of producing overlapping captions / visible seams.
  {
    const karaoke = plan.animations.filter((a) => a.type === "karaoke_caption");
    const spans = karaoke
      .map((a) => {
        const t = srcToTl(timecodeToSec(a.time));
        if (t === null) return null; // inside a CUT — dropped, harmless
        return { t, e: t + (a.duration ?? 3), at: a.time };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((x, y) => x.t - y.t);
    for (let i = 0; i + 1 < spans.length; i++) {
      if (spans[i].e > spans[i + 1].t + 0.05) {
        throw new Error(
          `build: karaoke captions overlap (${spans[i].at} runs ${(spans[i].e - spans[i].t).toFixed(2)}s into ${karaoke[i + 1]?.time}) — ` +
            `shorten duration so each card ends ≤0.08s before the next starts`
        );
      }
    }
    const cutStarts = plan.cuts
      .filter((c) => c.reason.startsWith("CUT"))
      .map((c) => ({ s: timecodeToSec(c.start), e: timecodeToSec(c.end) }));
    // CUTS-FIRST last gate: hand-written plans must obey the same rule as
    // the planner — the FULL zoom span (not just its start) keeps clear of
    // every CUT edge on both sides (types.ts motionSpanAllowed). A zoom
    // landing on a cleanup resume, or a slow_zoom running across a splice,
    // renders as a visible scale jump — reject with the exact fix.
    for (const a of plan.animations) {
      if (a.type !== "zoom_in" && a.type !== "zoom_out" && a.type !== "slow_zoom") continue;
      const src = timecodeToSec(a.time);
      const spanDur = motionSpanDuration(a.type as MotionKind, a.duration);
      const verdict = motionSpanAllowed(src, a.type as MotionKind, a.duration, cutStarts);
      if (!verdict.ok) {
        // Find the nearest CUT-clear slot (same relocation the planner uses)
        // so the error message carries the exact fix, not just the veto.
        let fix = "drop it";
        for (let d = 1; d <= 6; d++) {
          let found: number | null = null;
          for (const t of [Math.floor(src) - d, Math.ceil(src) + d]) {
            if (t >= 0 && motionSpanAllowed(t, a.type as MotionKind, a.duration, cutStarts).ok) {
              found = t;
              break;
            }
          }
          if (found !== null) {
            fix = `move it to ${secToTimecode(found)}`;
            break;
          }
        }
        throw new Error(
          `build: ${a.type} at ${a.time} (span ${spanDur.toFixed(2)}s) ${verdict.reason} — ` + fix
        );
      }
    }
    // Graphic banners: same invisibility contract as karaoke — max ONE
    // alive at a time (they are TOP banners, karaoke lives at the bottom,
    // so the two families never collide; but two banners would stack).
    const gb = (plan.graphics ?? [])
      .map((g) => {
        const t = srcToTl(timecodeToSec(g.time));
        if (t === null) return null; // inside a CUT — dropped, harmless
        return { t, e: t + g.duration, at: g.time, kind: g.kind };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((x, y) => x.t - y.t);
    for (let i = 0; i + 1 < gb.length; i++) {
      if (gb[i].e > gb[i + 1].t + 0.05) {
        throw new Error(
          `build: graphic banners overlap (${gb[i].kind} at ${gb[i].at} runs ${(gb[i].e - gb[i].t).toFixed(2)}s into ${gb[i + 1].kind} at ${gb[i + 1].at}) — ` +
            `keep max 1 banner at a time: shorten duration or drop one`
        );
      }
    }
  }
  const durationSec = Math.max(
    1,
    tlCursor,
    ...plan.pattern_interrupts
      .map((p) => srcToTl(timecodeToSec(p.time)) ?? -1)
      .filter((t) => t >= 0)
  );

  // Asset management: copy RAW footage, B-roll media, and demonstrative shot visuals into ./assets/
  const { copyFile, stat: statFile } = await import("node:fs/promises");
  await mkdir(join(outDir, "assets"), { recursive: true });

  let videoSrc: string | null = null;
  if (opts.rawVideoPath) {
    const st = await statFile(opts.rawVideoPath).catch(() => null);
    if (!st || !st.isFile())
      throw new Error(`build: RAW not found: ${opts.rawVideoPath}`);
    const fileName = opts.rawVideoPath.split("/").pop() ?? "raw.mp4";
    await copyFile(opts.rawVideoPath, join(outDir, "assets", fileName));
    videoSrc = `./assets/${fileName}`;
  }

  // Copy local B-roll files
  for (let bi = 0; bi < (plan.broll ?? []).length; bi++) {
    const b = plan.broll![bi];
    if (b.source && !b.source.startsWith("http") && !b.source.startsWith("./assets/")) {
      const st = await statFile(b.source).catch(() => null);
      if (st && st.isFile()) {
        const ext = b.source.split(".").pop() ?? "png";
        const fname = `broll_${bi}.${ext}`;
        await copyFile(b.source, join(outDir, "assets", fname));
        b.source = `./assets/${fname}`;
      }
    }
  }

  // Copy local shot media files (demonstrative images & slides)
  for (let si = 0; si < (plan.shots ?? []).length; si++) {
    const s = plan.shots![si];
    if (s.media_url && !s.media_url.startsWith("http") && !s.media_url.startsWith("./assets/")) {
      const st = await statFile(s.media_url).catch(() => null);
      if (st && st.isFile()) {
        const ext = s.media_url.split(".").pop() ?? "png";
        const fname = `shot_${si}.${ext}`;
        await copyFile(s.media_url, join(outDir, "assets", fname));
        s.media_url = `./assets/${fname}`;
      }
    }
  }

  // HyperFrames media contract (verified on CLI 0.8.40 + editing recipes):
  // - TIMING lives on the <video> itself (data-start + data-duration);
  // - NEVER a timed ancestor around <video> (video_nested_in_timed_element);
  // - <video> with src requires data-start (media_missing_data_start);
  // - SPLICE: each KEEP clip plays its source window via data-media-start
  //   and is laid at its tlStart — the output timeline skips CUT ranges.
  const clips = tlSpans
    .map((span, i) => {
      const media = videoSrc
        ? `<video id="clip-video-${i}" src="${escHtml(videoSrc)}" data-start="${span.tlStart}" data-duration="${span.dur}" data-media-start="${span.srcStart}" data-has-audio="true" style="width:100%;height:100%;object-fit:cover"></video>`
        : `<div class="clip placeholder" data-start="${span.tlStart}" data-duration="${span.dur}"><div>CLIP ${i + 1}<br/><span>KEEP ${span.srcStart.toFixed(1)}s → ${(span.srcStart + span.dur).toFixed(1)}s</span></div></div>`;
      // Wrapper div WITHOUT timing: only full-bleed styling.
      // Its id (#clip-i) is the GSAP target for slow_zoom / zoom punch tweens.
      return `      <div id="clip-${i}" class="fullbleed">\n        ${media}\n      </div>`;
    })
    .join("\n");

  // Overlay animations: captions/text/lower-thirds (timed divs),
  // karaoke captions (word-by-word highlight, Apple-style) and
  // zoom tweens (GSAP on the clip wrapper — no silent drops: zoom_in,
  // zoom_out and slow_zoom all render as visible motion).
  //
  // All animation times arrive in SOURCE clock → remapped to TIMELINE
  // clock via srcToTl. Anything inside a CUT range returns null and is
  // dropped (its words are gone from the video too).
  // Time → clip mapping: a zoom at timeline time t targets the wrapper
  // of the KEEP clip active at t; if none is active, it targets #root.
  const cutAt = (tl: number): number => {
    for (let i = 0; i < tlSpans.length; i++) {
      if (tl >= tlSpans[i].tlStart && tl < tlSpans[i].tlStart + tlSpans[i].dur) return i;
    }
    return -1;
  };

  const overlayDivs: string[] = [];
  const overlayTimelines: string[] = [];
  const zoomTweens: string[] = [];
  plan.animations.forEach((a, i) => {
    const srcT = timecodeToSec(a.time);
    const t = srcToTl(srcT);
    // Animation authored inside a CUT range → its moment is gone: drop it.
    if (t === null) return;
    if (a.type === "karaoke_caption") {
      // Caption design system (v1.1):
      // - clean white type, no boxes; spoken word full white, upcoming 40%.
      // - emphasis words (planner keywords) get .hl: accent color + pop.
      // - safe-area: captions sit at bottom 18% on EVERY canvas —
      //   TikTok/Reels/Shorts draw progress bar + rails over the bottom
      //   ~12–15% of a 9:16 frame; 18% keeps words readable everywhere.
      //   Never center-face.
      // Words carry SOURCE timecodes → remap each onto the timeline;
      // words inside CUT ranges are dropped (planner usually pre-filters).
      const remapped = (a.words ?? [])
        .map((w) => ({ ...w, tl: srcToTl(timecodeToSec(w.start)) }))
        .filter((w): w is typeof w & { tl: number } => w.tl !== null);
      const words = remapped.map((w) => ({ ...w, rel: w.tl - (t as number) }));
      if (words.length === 0) return; // whole card was cut away
      const dur = Math.max(
        0.5,
        Math.min(
          a.duration ??
            (words.length > 0 ? words[words.length - 1].rel + 0.6 : 3),
          15
        )
      );
      const pos =
        a.position === "top"
          ? portrait
            ? "top:6%"
            : "top:8%"
          : a.position === "center"
            ? "top:42%"
            : "bottom:18%";
      const spans = words
        .map(
          (w, wi) =>
            `<span class="kw${w.emphasis ? " hl" : ""}" id="ov-${i}-w${wi}">${escHtml(w.word)}</span>`
        )
        .join(" ");
      overlayDivs.push(
        `      <div id="ov-${i}" class="clip overlay karaoke" data-start="${t}" data-duration="${dur}" style="${pos}">\n        <span class="clean">${spans}</span>\n      </div>`
      );
      // Entrance: gentle fade with a soft rise (no spring — restraint).
      overlayTimelines.push(
        `      tl.fromTo("#ov-${i} .clean", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" }, ${t});`
      );
      overlayTimelines.push(
        `      tl.to("#ov-${i} .clean", { opacity: 0, duration: 0.2, ease: "power2.in" }, ${t + dur - 0.2});`
      );
      // Per-word highlight: 40% → 100% opacity with a whisper of scale;
      // keyword pops get accent color + springy overshoot.
      // Offsets are timeline-relative (rel), base is the remapped card start.
      words.forEach((w, wi) => {
        const wt = Math.max(0, w.rel);
        if (w.emphasis) {
          overlayTimelines.push(
            `      tl.fromTo("#ov-${i}-w${wi}", { opacity: 0.4, scale: 0.85, color: "#ffffff" }, { opacity: 1, scale: 1.12, color: "#ffd60a", duration: 0.22, ease: "back.out(2.5)" }, ${t}+${Math.max(0, wt).toFixed(3)});`
          );
          overlayTimelines.push(
            `      tl.to("#ov-${i}-w${wi}", { scale: 1, duration: 0.3, ease: "power2.out" }, ${t}+${(Math.max(0, wt) + 0.22).toFixed(3)});`
          );
        } else {
          overlayTimelines.push(
            `      tl.fromTo("#ov-${i}-w${wi}", { opacity: 0.4, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, ${t}+${Math.max(0, wt).toFixed(3)});`
          );
        }
      });
    } else if (
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
          `      tl.fromTo("${target}", { scale: ${from.toFixed(3)} }, { scale: ${to.toFixed(3)}, duration: ${dur}, ease: "none", immediateRender: false }, ${t});`
        );
      } else {
        // Punch-cut zoom: hard cut feel — fast push with a settle frame,
        // no yoyo "breathing" (that reads as cheap). Alternating direction
        // per index keeps consecutive punches from looking identical.
        const dir = i % 2 === 0 ? 1 : -1;
        const peak = a.type === "zoom_in" ? 1 + 0.09 * dir : 1 - 0.07 * dir;
        zoomTweens.push(
          `      tl.fromTo("${target}", { scale: 1 }, { scale: ${peak.toFixed(3)}, duration: 0.18, ease: "power3.out", immediateRender: false }, ${t});`
        );
        zoomTweens.push(
          `      tl.to("${target}", { scale: 1, duration: 0.5, ease: "power2.inOut" }, ${t}+0.18);`
        );
      }
    }
    // "transition" is a cut-level concern (jump cut between clips) and is
    // already expressed by the cuts list — nothing extra to render.
  });
  const overlays = overlayDivs.join("\n");

  // ——— Graphic banners (v1.3): content-aware TOP banners ———
  // Position: TOP (top 6–8%) — karaoke captions live at the BOTTOM, so a
  // banner and a caption can share the screen without touching (the
  // video-4 pattern: talking head + "3 STEPS" banner, face always free).
  // Style: Apple restraint — clean white type, no boxes, no pills; the
  // number_stat kind gets the accent color (video-3 "$3,000" lime logic).
  // Beats inside CUT ranges are dropped (same clock honesty as karaoke).
  const graphicDivs: string[] = [];
  (plan.graphics ?? []).forEach((g, gi) => {
    const t = srcToTl(timecodeToSec(g.time));
    if (t === null) return;
    const dur = Math.max(1, Math.min(g.duration, 8));
    const isScreen = Boolean(g.tag && (g.tag.includes("TERMINAL") || g.tag.includes("WORKSPACE") || g.tag.includes("AI SYSTEM") || g.tag.includes("AI AGENT") || g.tag.includes("AGENT TOOL") || g.tag.includes("CLI") || g.tag.includes("VIDEO AI")));
    const pos = g.position ?? (isScreen ? "center" : (portrait ? "top" : "top"));
    const posStyle = pos === "center" ? "top:35%;" : pos === "bottom" ? "bottom:28%;" : `top:${portrait ? "6%" : "8%"};`;

    if (isScreen) {
      graphicDivs.push(
        `      <div id="gfx-${gi}" class="clip overlay gfx gfx-screen_overlay" data-start="${t}" data-duration="${dur}" style="${posStyle}">\n        <div class="gfx-card screen-card">\n          <div class="screen-header">\n            <div class="screen-dot red"></div>\n            <div class="screen-dot yellow"></div>\n            <div class="screen-dot green"></div>\n            <span class="screen-title">${escHtml(g.tag ? `${g.tag} — ` : "")}${escHtml(g.title)}</span>\n          </div>\n          <div class="screen-body">\n            <div class="screen-line"><span class="cmd-prompt">&gt;</span> <span class="cmd-highlight">${escHtml(g.title)}</span> active</div>\n            ${g.subtitle ? `<div class="screen-line sub"><span class="cmd-info">⚡</span> ${escHtml(g.subtitle)}</div>` : ""}\n            <div class="screen-line status"><span class="cmd-ok">✔</span> workflow optimized with RetentionVolt</div>\n          </div>\n        </div>\n      </div>`
      );
    } else {
      graphicDivs.push(
        `      <div id="gfx-${gi}" class="clip overlay gfx gfx-${g.kind}" data-start="${t}" data-duration="${dur}" style="${posStyle}">\n        <div class="gfx-card">\n          ${g.tag || g.icon ? `<div class="gfx-tag">${g.icon ? `<span class="gfx-icon">${g.icon}</span> ` : ""}${g.tag ? `<span>${escHtml(g.tag)}</span>` : ""}</div>` : ""}\n          <span class="gfx-title">${escHtml(g.title)}</span>${g.subtitle ? `\n          <span class="gfx-sub">${escHtml(g.subtitle)}</span>` : ""}\n        </div>\n      </div>`
      );
    }
    overlayTimelines.push(
      `      tl.fromTo("#gfx-${gi}", { y: -26, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: "back.out(1.8)", immediateRender: false }, ${t});`
    );
    overlayTimelines.push(
      `      tl.to("#gfx-${gi}", { y: -16, opacity: 0, scale: 0.95, duration: 0.32, ease: "power2.in" }, ${t + dur - 0.32});`
    );
  });
  const graphicsHtml = graphicDivs.join("\n");

  // Demonstrative screens and background slides (for screen share, PiP, and B-roll visuals)
  const demoScreenDivs: string[] = [];
  const shotTweens: string[] = [];

  (plan.shots ?? []).forEach((shot, si) => {
    const sTl = srcToTl(timecodeToSec(shot.start));
    const eTl = srcToTl(timecodeToSec(shot.end));
    if (sTl === null || eTl === null || eTl <= sTl) return;
    const dur = eTl - sTl;
    const idx = cutAt(sTl);
    const target = idx >= 0 ? `#clip-${idx}` : ".fullbleed";

    const isScreenOrPip =
      shot.shot_type === "pip_talking_head_on_screen" ||
      shot.shot_type === "talking_head_pip" ||
      shot.shot_type === "screen_share_fullscreen" ||
      shot.shot_type === "b_roll_fullscreen" ||
      Boolean(shot.media_url);

    if (isScreenOrPip) {
      let contentHtml = "";
      if (shot.media_url) {
        const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(shot.media_url);
        if (isImg) {
          contentHtml = `        <div class="demo-img-box">\n          <img id="shot-img-${si}" src="${escHtml(shot.media_url)}" class="demo-bg-img" alt="${escHtml(shot.title ?? "Demonstration")}" />\n        </div>`;
          shotTweens.push(
            `      tl.fromTo("#shot-img-${si}", { scale: 1.0, y: 0 }, { scale: 1.12, y: -20, duration: ${dur}, ease: "none", immediateRender: false }, ${sTl});`
          );
        } else {
          contentHtml = `        <div class="demo-img-box">\n          <video src="${escHtml(shot.media_url)}" class="demo-bg-img" autoplay muted loop></video>\n        </div>`;
        }
      } else {
        contentHtml = `        <div class="demo-workspace">\n          <div class="workspace-header">\n            <div class="screen-dot red"></div>\n            <div class="screen-dot yellow"></div>\n            <div class="screen-dot green"></div>\n            <span class="workspace-title">${escHtml(shot.title ?? "DEMONSTRATIVE WORKSPACE")}</span>\n          </div>\n          <div class="workspace-body">\n            <div class="workspace-code"><span class="line-num">01</span> <span class="tok-kw">import</span> { RetentionVolt } <span class="tok-kw">from</span> <span class="tok-str">"@retention/ai"</span>;</div>\n            <div class="workspace-code"><span class="line-num">02</span> <span class="tok-kw">const</span> engine = <span class="tok-kw">await</span> RetentionVolt.loadModel();</div>\n            <div class="workspace-code"><span class="line-num">03</span> <span class="tok-comment">// ${escHtml(shot.subtitle ?? "Demonstrative Visual Pacing & Dynamic Framing")}</span></div>\n            <div class="workspace-code"><span class="line-num">04</span> <span class="tok-kw">const</span> optimized = <span class="tok-kw">await</span> engine.synthesize();</div>\n            <div class="workspace-code"><span class="line-num">05</span> <span class="tok-prompt">&gt;</span> <span class="tok-success">High-retention visual demonstrator active</span></div>\n          </div>\n        </div>`;
        shotTweens.push(
          `      tl.fromTo("#shot-bg-${si} .demo-workspace", { scale: 0.96, opacity: 0.8 }, { scale: 1.02, opacity: 1, duration: ${dur}, ease: "none", immediateRender: false }, ${sTl});`
        );
      }

      if (shot.title || shot.subtitle) {
        contentHtml += `\n        <div class="demo-caption-bar">\n          ${shot.title ? `<span class="demo-caption-title">${escHtml(shot.title)}</span>` : ""}${shot.subtitle ? `\n          <span class="demo-caption-sub">${escHtml(shot.subtitle)}</span>` : ""}\n        </div>`;
      }

      demoScreenDivs.push(
        `      <div id="shot-bg-${si}" class="clip demo-screen" data-start="${sTl}" data-duration="${dur}">\n${contentHtml}\n      </div>`
      );
      shotTweens.push(
        `      tl.fromTo("#shot-bg-${si}", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, ${sTl});`
      );
      shotTweens.push(
        `      tl.to("#shot-bg-${si}", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${eTl - 0.3});`
      );
    }

    if (shot.shot_type === "pip_talking_head_on_screen" || shot.shot_type === "talking_head_pip") {
      const pipPos = shot.pip_position ?? "bottom_right";
      const xOffset = pipPos.includes("right") ? -40 : 40;
      const yOffset = pipPos.includes("bottom") ? -160 : 160;
      const origin = pipPos.replace("_", " ");
      shotTweens.push(
        `      tl.to("${target}", { scale: 0.36, transformOrigin: "${origin}", x: ${xOffset}, y: ${yOffset}, borderRadius: "28px", boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 0 3px rgba(255,255,255,0.25)", duration: 0.45, ease: "power3.out" }, ${sTl});`
      );
      shotTweens.push(
        `      tl.to("${target}", { scale: 1, x: 0, y: 0, borderRadius: "0px", boxShadow: "none", duration: 0.45, ease: "power3.inOut" }, ${eTl - 0.45});`
      );
    } else if (shot.shot_type === "talking_head_fullscreen") {
      shotTweens.push(
        `      tl.to("${target}", { scale: 1.18, transformOrigin: "center 30%", duration: 0.15, ease: "power2.out" }, ${sTl});`
      );
      shotTweens.push(
        `      tl.to("${target}", { scale: 1, duration: 0.2, ease: "power2.in" }, ${eTl});`
      );
    } else if (shot.shot_type === "screen_share_fullscreen" || shot.shot_type === "b_roll_fullscreen") {
      shotTweens.push(
        `      tl.to("${target}", { opacity: 0, scale: 0.95, duration: 0.35, ease: "power2.out" }, ${sTl});`
      );
      shotTweens.push(
        `      tl.to("${target}", { opacity: 1, scale: 1, duration: 0.35, ease: "power2.inOut" }, ${eTl - 0.35});`
      );
    } else if (shot.shot_type === "split_screen") {
      const splitY = portrait ? -360 : 0;
      const splitX = portrait ? 0 : -320;
      shotTweens.push(
        `      tl.to("${target}", { x: ${splitX}, y: ${splitY}, scale: 0.65, borderRadius: "20px", duration: 0.45, ease: "power3.out" }, ${sTl});`
      );
      shotTweens.push(
        `      tl.to("${target}", { x: 0, y: 0, scale: 1, borderRadius: "0px", duration: 0.45, ease: "power3.inOut" }, ${eTl - 0.45});`
      );
    }
  });
  const demoScreensHtml = demoScreenDivs.join("\n");

  // B-roll video & image overlays
  const brollDivs: string[] = [];
  (plan.broll ?? []).forEach((b, bi) => {
    const sTl = srcToTl(timecodeToSec(b.start));
    const eTl = srcToTl(timecodeToSec(b.end));
    if (sTl === null || eTl === null || eTl <= sTl) return;
    const dur = eTl - sTl;
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(b.source);
    const mediaEl = isImage
      ? `<img id="broll-img-${bi}" src="${escHtml(b.source)}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;" />`
      : `<video src="${escHtml(b.source)}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;" autoplay muted loop></video>`;
    brollDivs.push(
      `      <div id="broll-${bi}" class="clip overlay broll-overlay" data-start="${sTl}" data-duration="${dur}">\n        ${mediaEl}\n      </div>`
    );
    overlayTimelines.push(
      `      tl.fromTo("#broll-${bi}", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, ${sTl});`
    );
    if (isImage) {
      overlayTimelines.push(
        `      tl.fromTo("#broll-img-${bi}", { scale: 1.0 }, { scale: 1.12, duration: ${dur}, ease: "none", immediateRender: false }, ${sTl});`
      );
    }
    overlayTimelines.push(
      `      tl.to("#broll-${bi}", { opacity: 0, scale: 0.98, duration: 0.3, ease: "power2.in" }, ${eTl - 0.3});`
    );
  });
  const brollHtml = brollDivs.join("\n");

  const beats = [
    ...overlayTimelines,
    ...zoomTweens,
    ...shotTweens,
    ...plan.pattern_interrupts.flatMap((p, i) => {
      const t = srcToTl(timecodeToSec(p.time));
      if (t === null) return []; // interrupt inside a CUT range — gone
      return [
        `      tl.fromTo("#punch-${i}", { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }, ${t});`,
      ];
    }),
  ].join("\n");
  const punchDivs = plan.pattern_interrupts
    .flatMap((p, i) => {
      const t = srcToTl(timecodeToSec(p.time));
      if (t === null) return [];
      return [
        `      <div id="punch-${i}" class="clip punch" data-start="${t}" data-duration="0.6"></div>`,
      ];
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
      #demo-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
      .demo-screen {
        position: absolute;
        inset: 0;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: radial-gradient(circle at 50% 35%, #1e293b 0%, #070a0f 100%);
        z-index: 2;
      }
      .demo-img-box {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .demo-bg-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        will-change: transform;
        display: block;
      }
      .demo-caption-bar {
        position: absolute;
        top: ${portrait ? "10%" : "8%"};
        left: 6%;
        right: 6%;
        background: rgba(15, 23, 42, 0.96);
        border: 1.5px solid rgba(255, 255, 255, 0.22);
        border-radius: 20px;
        padding: 16px 28px;
        box-shadow: 0 20px 45px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.25);
        z-index: 6;
        text-align: center;
      }
      .demo-caption-title {
        display: block;
        font-size: ${portrait ? "40px" : "48px"};
        font-weight: 800;
        color: #fff;
        letter-spacing: 0.02em;
        text-shadow: 0 2px 10px rgba(0,0,0,0.8);
      }
      .demo-caption-sub {
        display: block;
        margin-top: 6px;
        font-size: ${portrait ? "22px" : "24px"};
        font-weight: 600;
        color: #38bdf8;
        letter-spacing: 0.04em;
      }
      .demo-workspace {
        width: 90%;
        max-width: 960px;
        background: rgba(13, 17, 23, 0.95);
        border: 1.5px solid rgba(56, 189, 248, 0.5);
        border-radius: 24px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(56, 189, 248, 0.3);
        padding: 24px;
        font-family: monospace;
      }
      .workspace-header {
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .workspace-title {
        font-size: 20px;
        color: #94a3b8;
        font-weight: 600;
        margin-left: 8px;
      }
      .workspace-body {
        font-size: ${portrait ? "22px" : "24px"};
        line-height: 1.7;
        color: #e2e8f0;
      }
      .workspace-code { margin: 4px 0; }
      .line-num { color: #64748b; margin-right: 12px; user-select: none; }
      .tok-kw { color: #f43f5e; font-weight: 700; }
      .tok-str { color: #38bdf8; }
      .tok-comment { color: #94a3b8; font-style: italic; }
      .tok-prompt { color: #4ade80; font-weight: 700; margin-right: 6px; }
      .tok-success { color: #4ade80; font-weight: 600; }
      .fullbleed { position: absolute; inset: 0; z-index: 4; overflow: hidden; will-change: transform, opacity, border-radius; }
      .fullbleed video { width: 100%; height: 100%; object-fit: cover; display: block; }
      .clip.placeholder { position: absolute; inset: 0; display: grid; place-items: center; }
      .placeholder { text-align: center; font-size: 64px; font-weight: 800; }
      .placeholder span { font-size: 28px; font-weight: 400; opacity: 0.7; }
      .overlay { position: absolute; left: 0; right: 0; text-align: center; z-index: 10; }
      .overlay span { display: inline-block; background: rgba(0,0,0,0.65); padding: 12px 28px; border-radius: 12px; font-size: 56px; font-weight: 800; }
      .overlay.lower3rd { text-align: left; }
      .overlay.lower3rd span { font-size: 34px; font-weight: 600; border-left: 8px solid #4da3ff; border-radius: 0 12px 12px 0; }
      /* karaoke caption: true Apple style — no boxes, no pills.
         Clean white SF type with soft shadow; the spoken word is full
         white, upcoming words sit at 40% opacity. Restraint = premium.
         SAFE AREA: bottom 18% (not 10%) — TikTok/Reels/Shorts draw the
         progress bar, like/comment rail and description over the bottom
         ~12–15% of a 9:16 frame; parking captions at 18% keeps every
         word readable on every platform, landscape or portrait. */
      .overlay.karaoke { background: none; bottom: 18%; }
      .overlay.karaoke .clean {
        background: none;
        padding: 0;
        border-radius: 0;
        font-size: 46px;
        font-weight: 600;
        letter-spacing: 0.005em;
        color: #fff;
        /* Legibility system: layered shadow (halo + contact) + a hairline
           dark stroke. White-on-skin (selfie talking-heads) washes out
           with shadow alone — the 1px stroke keeps every glyph readable
           on bright backgrounds without any box behind the text. */
        text-shadow:
          0 2px 18px rgba(0,0,0,0.65),
          0 1px 4px rgba(0,0,0,0.8),
          0 0 2px rgba(0,0,0,0.9);
        -webkit-text-stroke: 1px rgba(0,0,0,0.35);
        paint-order: stroke fill;
      }
      .overlay.karaoke .kw {
        display: inline-block;
        opacity: 0.4;
        margin: 0 7px;
        /* neutralize the generic .overlay span box: words float free */
        background: none;
        padding: 0;
        border-radius: 0;
        will-change: transform, opacity;
      }
      /* keyword pop: accent color set by GSAP at speech onset */
      .overlay.karaoke .kw.hl { font-weight: 800; }
      /* Modern motion graphics & visual cards */
      .overlay.gfx {
        background: none;
        left: 4%;
        right: 4%;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        z-index: 15;
      }
      .gfx-card {
        background: rgba(13, 17, 23, 0.94);
        border: 1.5px solid rgba(255, 255, 255, 0.18);
        border-radius: 20px;
        padding: 16px 32px;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.75), 0 0 28px rgba(56, 189, 248, 0.25);
        text-align: center;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        max-width: 92%;
      }
      .gfx-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #38bdf8;
        margin-bottom: 6px;
      }
      .gfx-icon { font-size: 24px; }
      .overlay.gfx .gfx-title {
        display: block;
        font-size: 44px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: #fff;
        text-shadow: 0 2px 14px rgba(0,0,0,0.8);
        line-height: 1.25;
      }
      .overlay.gfx .gfx-sub {
        display: block;
        margin-top: 6px;
        font-size: 22px;
        font-weight: 500;
        color: #cbd5e1;
        letter-spacing: 0.04em;
      }
      .overlay.gfx.gfx-number_stat .gfx-card {
        border-color: rgba(255, 214, 10, 0.55);
        box-shadow: 0 16px 45px rgba(0,0,0,0.8), 0 0 35px rgba(255, 214, 10, 0.35);
      }
      .overlay.gfx.gfx-number_stat .gfx-title { color: #ffd60a; font-size: 58px; }
      .overlay.gfx.gfx-tool_badge .gfx-card {
        border-color: rgba(168, 85, 247, 0.55);
        box-shadow: 0 16px 45px rgba(0,0,0,0.8), 0 0 35px rgba(168, 85, 247, 0.35);
      }
      .overlay.gfx.gfx-tool_badge .gfx-tag { color: #c084fc; }
      .overlay.gfx.gfx-concept_card .gfx-card {
        border-color: rgba(56, 189, 248, 0.55);
        box-shadow: 0 16px 45px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.35);
      }
      .overlay.gfx.gfx-screen_overlay .gfx-card.screen-card {
        width: 94%;
        border-color: rgba(56, 189, 248, 0.7);
        background: rgba(15, 23, 42, 0.95);
        box-shadow: 0 20px 55px rgba(0,0,0,0.85), 0 0 45px rgba(56, 189, 248, 0.35);
        padding: 22px;
      }
      .screen-header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.14);
        padding-bottom: 10px;
      }
      .screen-dot { width: 14px; height: 14px; border-radius: 50%; }
      .screen-dot.red { background: #ff5f56; }
      .screen-dot.yellow { background: #ffbd2e; }
      .screen-dot.green { background: #27c93f; }
      .screen-title { font-size: 19px; color: #94a3b8; font-family: monospace; margin-left: 8px; font-weight: 600; }
      .screen-body {
        width: 100%;
        font-family: monospace;
        font-size: 24px;
        color: #e2e8f0;
        text-align: left;
        background: rgba(0,0,0,0.55);
        border-radius: 12px;
        padding: 18px;
        line-height: 1.6;
        box-sizing: border-box;
      }
      .screen-line { margin: 4px 0; }
      .cmd-prompt { color: #4ade80; font-weight: 700; margin-right: 6px; }
      .cmd-highlight { color: #38bdf8; font-weight: 700; }
      .cmd-info { color: #ffd60a; margin-right: 6px; }
      .overlay.broll-overlay {
        position: absolute;
        inset: 4%;
        z-index: 12;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.85);
        border: 1px solid rgba(255,255,255,0.18);
        pointer-events: none;
      }
      .punch { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${compositionId}" data-start="0" data-width="${width}" data-height="${height}" data-duration="${durationSec}">
      <div id="demo-layer">
${demoScreensHtml}
      </div>
${clips}
${overlays}
${graphicsHtml}
${brollHtml}
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
    JSON.stringify({ compositionId, generatedBy: "retention" }, null, 2)
  );
  return { dir: outDir, compositionId, durationSec };
}

export interface RenderOptions {
  preset?: RenderPreset;
  output?: string;
  timeoutMs?: number;
  /**
   * Target frames per second. Default "source": the render inherits the
   * RAW footage frame rate (24/25/30/60 stay native — no judder from
   * resampling). Pass an explicit number (24|25|30|60) only to force a
   * delivery spec (e.g. platform requires 30p).
   */
  fps?: number | "source";
  /**
   * Video CRF override (0–51, lower = better). Default: the preset's own
   * curve (draft 28 / standard 16 via "looks" / high 15 via "delivery").
   * Rarely needed — the presets already sit at transparency.
   */
  crf?: number;
}

export async function renderVideo(
  project: HyperframesProject,
  opts: RenderOptions = {}
): Promise<string> {
  const preset = opts.preset ?? "standard";
  const output = opts.output ?? join(project.dir, "output.mp4");

  // Real CLI (hyperframes 0.8.40): `render [DIR] -o OUTPUT -q QUALITY
  // [--fps N] [--crf N]`.
  // Valid qualities: draft | looks | delivery | standard | high.
  // Skill preset mapping: draft→draft, standard→looks, high→delivery.
  // "looks" = standard pipeline + crf 16 (visually transparent);
  // "delivery" = high pipeline: preset slow + crf 15 (max quality).
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

  // Quality flags: --fps keeps motion native by default ("source" =
  // no flag → the engine inherits the footage rate). An explicit fps
  // forces the delivery frame rate. --crf overrides the preset curve.
  const extraArgs: string[] = [];
  if (typeof opts.fps === "number" && Number.isFinite(opts.fps) && opts.fps > 0)
    extraArgs.push("--fps", String(Math.round(opts.fps)));
  if (typeof opts.crf === "number" && Number.isInteger(opts.crf) && opts.crf >= 0 && opts.crf <= 51)
    extraArgs.push("--crf", String(opts.crf));

  try {
    if (localBin) {
      await execFileAsync(process.execPath, [localBin, "render", project.dir, "--quality", quality, ...extraArgs, "--output", output], {
        timeout: opts.timeoutMs ?? 30 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
    } else {
      await execFileAsync("npx", ["hyperframes", "render", project.dir, "--quality", quality, ...extraArgs, "--output", output], {
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

/**
 * Render high-CTR video thumbnail / cover based on plan's thumbnail configuration.
 * Extracts a high-impact base frame at the hook moment and outputs a ready-to-use cover image
 * along with companion CTR metadata (title, badge, style) in a companion JSON file.
 * (Does not require external FFmpeg libfreetype filters).
 */
export async function renderThumbnail(
  sourceOrOptions:
    | string
    | ({ source_video_path: string; output_path: string } & ThumbnailConfig),
  outputPathOrConfig?: string | ThumbnailConfig,
  configArg?: ThumbnailConfig
): Promise<string> {
  let sourceVideoPath: string;
  let outputPath: string;
  let config: ThumbnailConfig;

  if (typeof sourceOrOptions === "object" && sourceOrOptions !== null) {
    sourceVideoPath = sourceOrOptions.source_video_path;
    outputPath = sourceOrOptions.output_path;
    config = sourceOrOptions;
  } else {
    sourceVideoPath = sourceOrOptions;
    outputPath =
      typeof outputPathOrConfig === "string"
        ? outputPathOrConfig
        : "thumbnail.jpg";
    config =
      (typeof outputPathOrConfig === "object" ? outputPathOrConfig : configArg) ??
      { title: "Thumbnail" };
  }

  const time = config.frame_time ?? "00:00:02.000";
  // Validate timecode format early to fail fast with a clear error
  timecodeToSec(time);

  // Determine final image path: handle directory path or explicit output_filename
  let finalOut = outputPath;
  const isDirLike =
    outputPath.endsWith("/") ||
    outputPath.endsWith("\\") ||
    !extname(outputPath);

  if (isDirLike) {
    const filename = config.output_filename || "thumbnail.jpg";
    finalOut = join(outputPath, filename);
  } else if (config.output_filename) {
    finalOut = join(dirname(outputPath), config.output_filename);
  }

  // Ensure parent directory exists
  await mkdir(dirname(finalOut), { recursive: true });

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        time,
        "-i",
        sourceVideoPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        finalOut,
      ],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (err) {
    throw new Error(`renderThumbnail failed: ${(err as Error).message}`);
  }

  const st = await stat(finalOut).catch(() => null);
  if (!st || st.size === 0)
    throw new Error(`renderThumbnail: failed to generate thumbnail at ${finalOut}`);

  // Write companion CTR metadata file if title, badge, or style are provided
  if (config.title || config.badge || config.style) {
    const metaPath = finalOut.replace(/\.[^.]+$/, "") + ".json";
    const meta = {
      image: finalOut,
      title: config.title ?? "Thumbnail",
      badge: config.badge,
      style: config.style ?? "bold",
      frame_time: time,
      suggested_ctr_elements: {
        headline: config.title,
        badge: config.badge,
        preset: config.style,
      },
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8").catch(() => {
      // non-fatal metadata write failure
    });
  }

  return finalOut;
}



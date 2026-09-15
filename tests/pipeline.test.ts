import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTranscript } from "../src/tools_analyze.js";
import { importRawMedia } from "../src/tools_ingest.js";
import { generateEditPlan } from "../src/tools_plan.js";
import { buildHyperframesProject } from "../src/tools_render.js";
import { detectHardware, selectModel } from "../src/tools_transcribe.js";
import {
  secToTimecode,
  timecodeToSec,
  type Transcript,
} from "../src/types.js";

describe("timecode utils", () => {
  it("roundtrip sec <-> timecode", () => {
    expect(timecodeToSec("00:03:10.000")).toBeCloseTo(190, 3);
    expect(secToTimecode(190)).toBe("00:03:10.000");
    expect(secToTimecode(timecodeToSec("01:00:00.500"))).toBe("01:00:00.500");
  });
  it("rejects invalid formats", () => {
    expect(() => timecodeToSec("nope")).toThrow();
  });
});

describe("whisper model selection", () => {
  it("detectHardware returns a valid value", async () => {
    expect(["gpu_nvidia", "apple_silicon", "cpu_only"]).toContain(
      await detectHardware()
    );
  });
  it("small on CPU, large-v3 on GPU/Silicon", () => {
    expect(selectModel("cpu_only")).toBe("small");
    expect(selectModel("gpu_nvidia")).toBe("large-v3");
    expect(selectModel("apple_silicon")).toBe("large-v3");
  });
});

describe("ingest (real ffprobe)", () => {
  it("extracts metadata from an ffmpeg-generated mp4", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-ingest-"));
    try {
      const mp4 = join(dir, "raw.mp4");
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=2:size=640x480:rate=30",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-shortest",
        "-y",
        mp4,
      ]);
      const [asset] = await importRawMedia([mp4]);
      expect(asset.duration_sec).toBeCloseTo(2, 0);
      expect(asset.width).toBe(640);
      expect(asset.height).toBe(480);
      expect(asset.fps).toBeCloseTo(30, 0);
      expect(asset.audio_streams).toBe(1);
      expect(asset.rotation).toBe(0);
      expect(asset.is_portrait).toBe(false);
      expect(asset.display_width).toBe(640);
      expect(asset.display_height).toBe(480);
      expect(asset.media_id).toMatch(/^[0-9a-f-]{36}$/);
      // no rotation metadata → landscape, display == stored
      expect(asset.display_width).toBe(640);
      expect(asset.display_height).toBe(480);
      expect(asset.is_portrait).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("errors on missing file", async () => {
    await expect(importRawMedia(["/non/esiste.mp4"])).rejects.toThrow();
  });
});

const SAMPLE_TRANSCRIPT: Transcript = {
  media_id: "test-media",
  model: "small",
  segments: [
    { start: "00:00:00.000", end: "00:00:05.000", text: "Ciao a tutti oggi parliamo di montaggio video" },
    { start: "00:00:05.000", end: "00:00:09.000", text: "ehm allora diciamo che cioè è importante" },
    { start: "00:00:12.000", end: "00:00:20.000", text: "Il primo segreto è il ritmo serrato e i tagli decisi nei punti giusti del racconto" },
    { start: "00:00:20.000", end: "00:00:28.000", text: "Il secondo segreto sono le caption animate e gli zoom punch per mantenere attenzione" },
  ],
};

describe("analyze", () => {
  it("finds hook, sections, fillers and dips", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT, { sectionCount: 2 });
    expect(s.hook.start).toBe("00:00:00.000");
    expect(s.sections).toHaveLength(2);
    // segment 2 = full of fillers
    expect(s.fillers.length).toBeGreaterThanOrEqual(1);
    expect(s.fillers[0].start).toBe("00:00:05.000");
    // 3s pause between segments 2 and 3 → dip
    expect(s.attention_dips).toHaveLength(1);
    expect(s.highlights.length).toBeGreaterThanOrEqual(1);
  });
  it("extracts keywords, hook moment and slow spots from word timestamps", () => {
    const t: Transcript = {
      ...SAMPLE_TRANSCRIPT,
      segments: SAMPLE_TRANSCRIPT.segments.map((s, i) => ({
        ...s,
        words: s.text.split(/\s+/).map((w, j) => ({
          start: secToTimecode(timecodeToSec(s.start) + j * 0.3),
          end: secToTimecode(timecodeToSec(s.start) + (j + 1) * 0.3),
          word: w,
        })),
      })),
    };
    const s = analyzeTranscript(t);
    expect(s.keywords && s.keywords.length).toBeGreaterThan(0);
    // stopwords never keywords
    const kw = (s.keywords ?? []).map((k) => k.word);
    expect(kw).not.toContain("il");
    expect(kw).not.toContain("e");
    // content words surface
    expect(kw.some((w) => w.includes("montaggio") || w.includes("ritmo") || w.includes("caption"))).toBe(true);
    // hook moment inside the hook
    expect(s.hook_moment).toBeDefined();
    expect(timecodeToSec(s.hook_moment!.start)).toBeLessThan(30);
  });
  it("detects real cut candidates: dead air, stutter, filler runs, trims", () => {
    // synthetic word flow (starts at 5s to stay clear of the hook guard):
    // "sul sul" stutter, 1.2s dead air mid-speech, "ehm allora" filler
    // run, head/tail silence around the flow
    const words: Array<{ start: string; end: string; word: string }> = [];
    let t = 5.0;
    const push = (w: string, dur = 0.3) => {
      const s = Math.round(t * 20) / 20;
      const e = Math.round((t + dur) * 20) / 20;
      words.push({ start: secToTimecode(s), end: secToTimecode(e), word: w });
      t = Math.round((e + 0.05) * 20) / 20;
    };
    ["ciao", "a", "tutti"].forEach((w) => push(w));
    push("sul"); push("sul"); push("tuo"); // stutter
    t += 1.2; // dead air
    ["parliamo", "di"].forEach((w) => push(w));
    push("ehm"); push("allora"); // filler run
    ["montaggio", "video"].forEach((w) => push(w));
    const tr: Transcript = {
      media_id: "cuts-test",
      model: "small",
      segments: [{ start: "00:00:00.000", end: "00:00:20.000", text: words.map((w) => w.word).join(" "), words }],
    };
    // head silence: flow starts at 5s; tail: segment ends at 20s
    const s = analyzeTranscript(tr, { deadAirSec: 0.8 });
    const kinds = (s.cut_candidates ?? []).map((c) => c.kind);
    expect(kinds).toContain("trim_head");
    expect(kinds).toContain("stutter");
    expect(kinds).toContain("dead_air");
    expect(kinds).toContain("filler");
    expect(kinds).toContain("trim_tail");
    // every candidate carries a confidence in [0,1]
    for (const c of s.cut_candidates ?? []) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
    // trims are max-trust, short dead-air is flagged for review
    const trim = (s.cut_candidates ?? []).find((c) => c.kind === "trim_head");
    expect(trim!.confidence).toBeGreaterThanOrEqual(0.9);
    // never zero-length, sorted
    for (const c of s.cut_candidates ?? []) {
      expect(timecodeToSec(c.end)).toBeGreaterThan(timecodeToSec(c.start));
    }
    const starts = (s.cut_candidates ?? []).map((c) => c.start);
    expect([...starts].sort()).toEqual(starts);
  });
  it("needs_review flags likely-mangled brand words with context", () => {
    // "rawcat" appears ONCE, long token, emphasized (slow) → suspicious.
    // "video" appears twice → trusted. stopwords never flagged.
    const mk = (word: string, start: number, dur = 0.3) => ({
      start: secToTimecode(start),
      end: secToTimecode(start + dur),
      word,
    });
    const tr: Transcript = {
      media_id: "review-test",
      model: "small",
      segments: [{
        start: "00:00:00.000",
        end: "00:00:10.000",
        text: "hai mai sentito parlare di rawcat oggi parliamo di video e di video",
        words: [
          mk("hai", 0), mk("mai", 0.35), mk("sentito", 0.7), mk("parlare", 1.1),
          mk("di", 1.5), mk("rawcat", 1.8, 0.9), mk("oggi", 3.0),
          mk("parliamo", 3.4), mk("di", 3.8), mk("video", 4.1),
          mk("e", 4.5), mk("di", 4.7), mk("video", 5.0),
        ],
      }],
    };
    const s = analyzeTranscript(tr);
    const flagged = (s.needs_review ?? []).map((r) => r.word);
    expect(flagged).toContain("rawcat");
    expect(flagged).not.toContain("video");
    expect(flagged).not.toContain("hai");
    const entry = (s.needs_review ?? []).find((r) => r.word === "rawcat");
    expect(entry!.context).toContain("rawcat");
    expect(entry!.start).toBe("00:00:01.800");
  });
  it("confidence gate: low cuts skipped, medium cuts flagged for review", () => {
    const words: Array<{ start: string; word: string }> = [];
    for (let i = 0; i < 40; i++) {
      words.push({ start: secToTimecode(i * 0.5), word: `w${i}` });
    }
    const s = analyzeTranscript({
      media_id: "gate-test",
      model: "small",
      segments: [{ start: "00:00:00.000", end: "00:00:25.000", text: words.map((w) => w.word).join(" ") }],
    });
    // craft candidates: high (trim), medium (short dead-air 0.6), low (0.3)
    const withCuts = {
      ...s,
      cut_candidates: [
        ...(s.cut_candidates ?? []).filter((c) => c.kind === "trim_head" || c.kind === "trim_tail"),
        { start: "00:00:05.000", end: "00:00:05.600", kind: "dead_air" as const, reason: "short gap", confidence: 0.6 },
        { start: "00:00:10.000", end: "00:00:10.400", kind: "filler" as const, reason: "dubious", confidence: 0.3 },
      ],
    };
    const plan = generateEditPlan(withCuts, { style: "short_form" }, words);
    const cutStarts = plan.cuts.filter((c) => c.reason.startsWith("CUT")).map((c) => c.start);
    // medium applied (present as CUT) AND flagged
    expect(cutStarts).toContain("00:00:05.000");
    // low NOT applied (absent from CUTs) but listed for the agent
    expect(cutStarts).not.toContain("00:00:10.000");
    expect((plan.review_cuts ?? []).some((r) => r.start === "00:00:10.000" && r.reason.includes("SKIPPED"))).toBe(true);
    expect((plan.review_cuts ?? []).some((r) => r.start === "00:00:05.000" && r.reason.includes("APPLIED"))).toBe(true);
  });
  it("corrections fix ASR-mangled words before analysis", () => {
    const tr: Transcript = {
      media_id: "fix-test",
      model: "small",
      segments: [{ start: "00:00:00.000", end: "00:00:05.000", text: "parliamo di raw cut oggi" }],
    };
    const s = analyzeTranscript(tr, {
      corrections: [{ misheard: "raw cut", correct: "CutCraft" }],
    });
    expect(s.hook.summary).toContain("CutCraft");
    expect(s.hook.summary).not.toMatch(/raw cut/i);
  });
});

describe("plan", () => {
  it("generates a coherent EditPlan 1.2 with a real splice", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(s, { style: "youtube_talking_head" });
    expect(plan.version).toBe("1.2");
    expect(plan.style).toBe("youtube_talking_head");
    expect(plan.format).toBe("long");
    // KEEP cuts first (sorted, non-overlapping), CUT record appended
    const keeps = plan.cuts.filter((c) => !c.reason.startsWith("CUT"));
    expect(keeps.length).toBeGreaterThan(0);
    for (let i = 1; i < keeps.length; i++) {
      expect(timecodeToSec(keeps[i].start)).toBeGreaterThanOrEqual(timecodeToSec(keeps[i - 1].end));
    }
    // sample has a filler segment → at least one CUT recorded
    expect(plan.cuts.some((c) => c.reason.startsWith("CUT"))).toBe(true);
    expect(plan.animations.length).toBeGreaterThan(0);
    // motion follows acts: one slow_zoom per section (3 default sections)
    const zooms = plan.animations.filter((a) => a.type === "slow_zoom");
    expect(zooms.length).toBeGreaterThanOrEqual(2);
    // interrupts every ~25s over 28s of video → 1
    expect(plan.pattern_interrupts).toHaveLength(1);
  });
  it("short_form → 9:16 format, tiny cards, keyword emphasis", () => {
    const t: Transcript = {
      ...SAMPLE_TRANSCRIPT,
      segments: SAMPLE_TRANSCRIPT.segments.map((s) => ({
        ...s,
        words: s.text.split(/\s+/).map((w, j) => ({
          start: secToTimecode(timecodeToSec(s.start) + j * 0.3),
          end: secToTimecode(timecodeToSec(s.start) + (j + 1) * 0.3),
          word: w,
        })),
      })),
    };
    const s = analyzeTranscript(t);
    const flat = t.segments.flatMap((sg) =>
      (sg.words ?? []).map((w) => ({ start: w.start, word: w.word }))
    );
    const plan = generateEditPlan(s, { style: "short_form" }, flat);
    expect(plan.format).toBe("short");
    const karaoke = plan.animations.filter((a) => a.type === "karaoke_caption");
    expect(karaoke.length).toBeGreaterThan(0);
    // cards are tiny (≤5 words)
    for (const k of karaoke) expect((k.words ?? []).length).toBeLessThanOrEqual(5);
    // at least one keyword gets emphasis pop
    const emphasized = karaoke.flatMap((k) => k.words ?? []).some((w) => w.emphasis);
    expect(emphasized).toBe(true);
    // interrupts survive only in KEEP zones outside the pre-cut mask
    // (cadence ticks inside CUTs/masks are skipped by design)
    expect(plan.pattern_interrupts.length).toBeGreaterThanOrEqual(1);
    const cutSpans = (s.cut_candidates ?? []).map((c) => ({
      s: timecodeToSec(c.start),
      e: timecodeToSec(c.end),
    }));
    for (const p of plan.pattern_interrupts) {
      const t = timecodeToSec(p.time);
      expect(cutSpans.every((c) => t < c.s - 0.8 || t >= c.e)).toBe(true);
    }
  });
  it("sourcePortrait forces short canvas", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(s, { sourcePortrait: true });
    expect(plan.format).toBe("short");
  });
  it("risk points get dedicated interrupt coverage", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(
      { ...s, attention_risk_points: [{ start: "00:00:20.000", end: "00:00:28.000", reason: "static block" }] },
      { style: "podcast" } // 60s cadence → midpoint 24s would otherwise be uncovered
    );
    const covered = plan.pattern_interrupts.some(
      (p) => p.detail?.includes("risk-point coverage")
    );
    expect(covered).toBe(true);
    // interrupts stay time-ordered
    const times = plan.pattern_interrupts.map((p) => p.time);
    expect([...times].sort()).toEqual(times);
  });
  it("broll entries carry a reason", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(s, { brollSources: ["./broll/a.mp4"] });
    for (const b of plan.broll) expect(b.reason).toBeTruthy();
  });
});

describe("render: HyperFrames project build", () => {
  it("generates a valid standalone index.html", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-hf-"));
    try {
      const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
      const plan = generateEditPlan(s);
      const proj = await buildHyperframesProject(plan, dir);
      expect(proj.durationSec).toBeGreaterThan(0);
      const { readFileSync } = await import("node:fs");
      const html = readFileSync(join(dir, "index.html"), "utf8");
      expect(html).toContain("data-composition-id");
      expect(html).toContain("__timelines");
      // no RAW: timing placeholder (no <video>)
      expect(html).toContain("CLIP 1");
      expect(html).toContain("data-start=");
      // standalone contract: no <template> wrapper
      expect(html).not.toContain("<template>");
      const meta = JSON.parse(readFileSync(join(dir, "hyperframes.json"), "utf8"));
      expect(meta.compositionId).toBe(proj.compositionId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("renders slow_zoom, lower_third and custom caption duration — no silent drops", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-hf2-"));
    try {
      const plan = {
        version: "1.2" as const,
        style: "youtube_talking_head",
        format: "long" as const,
        media_id: "test-media",
        cuts: [{ start: "00:00:00.000", end: "00:00:20.000", reason: "opening hook" }],
        animations: [
          { time: "00:00:02.000", type: "slow_zoom" as const, target: "face", direction: "in" as const, intensity: 3, duration: 8 },
          { time: "00:00:05.000", type: "zoom_in" as const, target: "face" },
          {
            time: "00:00:10.000", type: "karaoke_caption" as const, position: "bottom" as const,
            words: [
              { start: "00:00:10.000", word: "Premium" },
              { start: "00:00:10.400", word: "quality" },
              { start: "00:00:10.800", word: "matters" },
            ],
          },
          { time: "00:00:15.000", type: "caption" as const, content: "KEY INSIGHT", position: "bottom" as const, duration: 4 },
        ],
        broll: [],
        pattern_interrupts: [],
      };
      await buildHyperframesProject(plan, dir);
      const { readFileSync } = await import("node:fs");
      const html = readFileSync(join(dir, "index.html"), "utf8");
      // slow_zoom → progressive GSAP tween on the active clip
      expect(html).toContain('tl.fromTo("#clip-0"');
      expect(html).toContain('scale: 1.240');
      // zoom_in punch-cut → fast push + settle (no yoyo breathing)
      expect(html).toContain('duration: 0.18');
      // karaoke caption → clean Apple style (no pill, per-word spans)
      expect(html).toContain('class="clip overlay karaoke"');
      expect(html).toContain('id="ov-2-w0"');
      expect(html).toContain("Premium");
      expect(html).not.toContain("backdrop-filter");
      // custom caption duration honored (not hardcoded 3)
      expect(html).toContain('data-duration="4"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("splice: CUT middle range → two clips with data-media-start, remapped timeline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-splice-"));
    try {
      // real 12s RAW so the splice path (data-media-start) is exercised
      const raw = join(dir, "raw.mp4");
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc=duration=12:size=640x480:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
        "-shortest", "-y", raw,
      ]);
      // KEEP [0,5] + CUT (5,8) + KEEP [8,12] → output 9s, no gaps
      const plan = {
        version: "1.2" as const,
        style: "short_form",
        format: "short" as const,
        media_id: "splice-media",
        cuts: [
          { start: "00:00:00.000", end: "00:00:05.000", reason: "keep" },
          { start: "00:00:08.000", end: "00:00:12.000", reason: "keep" },
          { start: "00:00:05.000", end: "00:00:08.000", reason: "CUT — dead_air: silence of 3.0s mid-speech" },
        ],
        animations: [
          {
            time: "00:00:09.000", type: "karaoke_caption" as const, position: "bottom" as const,
            words: [{ start: "00:00:09.000", word: "hello" }],
          },
          {
            time: "00:00:06.000", type: "caption" as const, content: "INSIDE CUT", position: "bottom" as const,
          },
        ],
        broll: [],
        pattern_interrupts: [],
      };
      const proj = await buildHyperframesProject(plan, dir, { rawVideoPath: raw });
      // true spliced duration: 5 + 4 = 9s (not 12s)
      expect(proj.durationSec).toBeCloseTo(9, 3);
      const { readFileSync } = await import("node:fs");
      const html = readFileSync(join(dir, "index.html"), "utf8");
      // short canvas
      expect(html).toContain("width=1080, height=1920");
      // second clip resumes at source 8s, laid at timeline 5s
      expect(html).toContain('data-media-start="8"');
      expect(html).toContain('data-start="5"');
      // caption at source 9s remapped to timeline 6s
      expect(html).toContain('data-start="6"');
      expect(html).toContain("hello");
      // animation inside the CUT range is dropped entirely
      expect(html).not.toContain("INSIDE CUT");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("renderer rejects overlapping karaoke captions with a fix hint", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-reject-"));
    try {
      const plan = {
        version: "1.2" as const,
        style: "short_form",
        format: "short" as const,
        media_id: "reject-media",
        cuts: [{ start: "00:00:00.000", end: "00:00:10.000", reason: "keep" }],
        animations: [
          {
            time: "00:00:01.000", type: "karaoke_caption" as const, position: "bottom" as const,
            duration: 5,
            words: [{ start: "00:00:01.000", word: "hello" }],
          },
          {
            time: "00:00:02.000", type: "karaoke_caption" as const, position: "bottom" as const,
            duration: 2,
            words: [{ start: "00:00:02.000", word: "world" }],
          },
        ],
        broll: [],
        pattern_interrupts: [],
      };
      await expect(buildHyperframesProject(plan, dir)).rejects.toThrow(/overlap/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("renderer rejects zooms inside the pre-cut mask with a fix hint", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cutcraft-reject2-"));
    try {
      const plan = {
        version: "1.2" as const,
        style: "short_form",
        format: "short" as const,
        media_id: "reject-media-2",
        cuts: [
          { start: "00:00:00.000", end: "00:00:05.000", reason: "keep" },
          { start: "00:00:08.000", end: "00:00:12.000", reason: "keep" },
          { start: "00:00:05.000", end: "00:00:08.000", reason: "CUT — dead_air: x" },
        ],
        animations: [
          { time: "00:00:04.500", type: "zoom_in" as const, target: "face" },
        ],
        broll: [],
        pattern_interrupts: [],
      };
      await expect(buildHyperframesProject(plan, dir)).rejects.toThrow(/pre-cut mask/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("karaoke cards never overlap: each ends before the next begins", () => {
    // dense word flow: 12 words at 0.3s cadence, 4 words/card → 3 cards
    const words: Array<{ start: string; word: string }> = [];
    for (let i = 0; i < 12; i++) {
      words.push({ start: secToTimecode(1 + i * 0.3), word: `w${i}` });
    }
    const s = analyzeTranscript({
      media_id: "overlap-test",
      model: "small",
      segments: [{ start: "00:00:00.000", end: "00:00:10.000", text: words.map((w) => w.word).join(" ") }],
    });
    const plan = generateEditPlan(s, { style: "short_form" }, words);
    const cards = plan.animations.filter((a) => a.type === "karaoke_caption");
    expect(cards.length).toBe(3);
    const spans = cards.map((c) => ({
      s: timecodeToSec(c.time),
      e: timecodeToSec(c.time) + (c.duration ?? 3),
    }));
    for (let i = 0; i + 1 < spans.length; i++) {
      expect(spans[i].e).toBeLessThanOrEqual(spans[i + 1].s + 0.001);
    }
    // short-form clamp: no card longer than 4s
    for (const sp of spans) {
      expect(sp.e - sp.s).toBeLessThanOrEqual(4.001);
    }
  });
  it("invisible cuts: masking zoom at every resume, veto before every cut", () => {
    const words: Array<{ start: string; word: string }> = [];
    for (let i = 0; i < 40; i++) {
      words.push({ start: secToTimecode(i * 0.5), word: `w${i}` });
    }
    const s = analyzeTranscript({
      media_id: "mask-test",
      model: "small",
      segments: [{ start: "00:00:00.000", end: "00:00:25.000", text: words.map((w) => w.word).join(" ") }],
    });
    const plan = generateEditPlan(
      s,
      {
        style: "short_form",
        interruptEverySec: 4,
        extraCuts: [{ start: "00:00:05.000", end: "00:00:08.000", reason: "test cut" }],
      },
      words
    );
    const zooms = plan.animations.filter(
      (a) => a.type === "zoom_in" || a.type === "slow_zoom"
    );
    // masking punch lands exactly on the resume (cut end 8.0)
    expect(zooms.some((z) => Math.abs(timecodeToSec(z.time) - 8) < 0.01)).toBe(true);
    // veto: no zoom in [4.2, 5.0) before the cut at 5.0
    expect(zooms.some((z) => {
      const t = timecodeToSec(z.time);
      return t >= 4.2 && t < 5.0;
    })).toBe(false);
    // interrupts respect the same rules (none inside CUT or mask)
    for (const p of plan.pattern_interrupts) {
      const t = timecodeToSec(p.time);
      expect(t < 5 || t >= 8).toBe(true);
      expect(t < 4.2 || t >= 5).toBe(true);
    }
  });
});

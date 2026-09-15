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
    const dir = mkdtempSync(join(tmpdir(), "avskill-ingest-"));
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
      expect(asset.media_id).toMatch(/^[0-9a-f-]{36}$/);
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
});

describe("plan", () => {
  it("generates a coherent EditPlan 1.0", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(s, { style: "youtube_talking_head" });
    expect(plan.version).toBe("1.0");
    expect(plan.style).toBe("youtube_talking_head");
    expect(plan.cuts.length).toBeGreaterThan(0);
    expect(plan.cuts[0].reason).toBe("opening hook");
    expect(plan.cuts.some((c) => c.reason.startsWith("CUT"))).toBe(true);
    expect(plan.animations.length).toBeGreaterThan(0);
    // interrupts every ~25s over 28s of video → 1
    expect(plan.pattern_interrupts).toHaveLength(1);
  });
  it("short_form → interrupt every 4s", () => {
    const s = analyzeTranscript(SAMPLE_TRANSCRIPT);
    const plan = generateEditPlan(s, { style: "short_form" });
    expect(plan.pattern_interrupts.length).toBeGreaterThanOrEqual(5);
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
    const dir = mkdtempSync(join(tmpdir(), "avskill-hf-"));
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
    const dir = mkdtempSync(join(tmpdir(), "avskill-hf2-"));
    try {
      const plan = {
        version: "1.0" as const,
        style: "youtube_talking_head",
        media_id: "test-media",
        cuts: [{ start: "00:00:00.000", end: "00:00:20.000", reason: "opening hook" }],
        animations: [
          { time: "00:00:02.000", type: "slow_zoom" as const, target: "face", direction: "in" as const, intensity: 3, duration: 8 },
          { time: "00:00:05.000", type: "zoom_in" as const, target: "face" },
          { time: "00:00:10.000", type: "lower_third" as const, content: "Dr. Rossi", position: "bottom" as const, duration: 5 },
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
      // zoom_in punch → yoyo tween
      expect(html).toContain("yoyo: true");
      // lower_third → dedicated class
      expect(html).toContain("lower3rd");
      expect(html).toContain("Dr. Rossi");
      // custom caption duration honored (not hardcoded 3)
      expect(html).toContain('data-duration="4"');
      expect(html).toContain('data-duration="5"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

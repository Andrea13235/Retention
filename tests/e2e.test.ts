/**
 * e2e.test.ts — full pipeline on real media (ffmpeg testsrc + sine):
 * import_raw_media → analyze(realistic mock transcript) →
 * generate_edit_plan → build_hyperframes_project → hyperframes lint.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTranscript } from "../src/tools_analyze.js";
import { importRawMedia } from "../src/tools_ingest.js";
import { generateEditPlan } from "../src/tools_plan.js";
import { buildHyperframesProject } from "../src/tools_render.js";
import { fileURLToPath } from "node:url";
import type { Transcript } from "../src/types.js";

/** Local hyperframes binary (avoids npx re-downloading the package).
 *  Points at the real .mjs file: .bin/hyperframes is a symlink that breaks
 *  when tests run with a different cwd. */
const SKILL_ROOT = fileURLToPath(new URL("..", import.meta.url));
const HF_BIN = join(SKILL_ROOT, "node_modules", "hyperframes", "bin", "hyperframes.mjs");

describe("e2e pipeline", () => {
  it("RAW → EditPlan → HyperFrames project → clean lint", async () => {
    const dir = mkdtempSync(join(tmpdir(), "retention-e2e-"));
    try {
      // 1. Synthetic 10s RAW, 1280x720, 30fps, with audio
      const raw = join(dir, "raw.mp4");
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc=duration=10:size=1280x720:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=10",
        "-shortest", "-y", raw,
      ]);

      // 2. real ingest
      const [asset] = await importRawMedia([raw]);
      expect(asset.duration_sec).toBeCloseTo(10, 0);
      expect(asset.width).toBe(1280);

      // 3. realistic 10s transcript (real Whisper needs a model download;
      //    here we verify the pipeline digests the format)
      const transcript: Transcript = {
        media_id: asset.media_id,
        model: "small",
        segments: [
          { start: "00:00:00.000", end: "00:00:03.000", text: "Ciao oggi ti mostro tre trucchi di montaggio" },
          { start: "00:00:03.000", end: "00:00:05.000", text: "ehm allora cominciamo subito" },
          { start: "00:00:05.000", end: "00:00:08.000", text: "Primo trucco taglia tutto il superfluo senza pieta e tieni solo il meglio" },
          { start: "00:00:08.000", end: "00:00:10.000", text: "Iscriviti al canale per altri consigli" },
        ],
      };

      // 4. analyze → plan
      const structure = analyzeTranscript(transcript, { sectionCount: 2 });
      expect(structure.fillers.length).toBeGreaterThanOrEqual(1);
      const plan = generateEditPlan(structure, { style: "educational" });
      expect(plan.version).toBe("1.3");

      // 5. build project with RAW mounted (copied to ./assets by the builder).
      // NB: project inside the skill — the lint/render CLI takes a positional
      // DIR and does not follow the caller's cwd.
      const projDir = join(SKILL_ROOT, ".tmp-e2e", `run-${Date.now()}`);
      const proj = await buildHyperframesProject(plan, projDir, { rawVideoPath: raw });
      const html = readFileSync(join(projDir, "index.html"), "utf8");
      expect(html).toContain("./assets/raw.mp4");
      // filler "ehm allora" spliced out → 10s source becomes ~9s output
      expect(proj.durationSec).toBeCloseTo(9, 0);
      expect(plan.cuts.some((c) => c.reason.startsWith("CUT"))).toBe(true);

      // 6. hyperframes lint DIR --json (zero errors; warnings don't block)
      const lint = execFileSync(process.execPath, [HF_BIN, "lint", projDir, "--json"], {
        encoding: "utf8",
        timeout: 120_000,
      });
      const report = JSON.parse(lint) as { ok?: boolean; errorCount?: number };
      expect(report.errorCount ?? 1, `hyperframes lint: ${lint.slice(0, 2000)}`).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(join(SKILL_ROOT, ".tmp-e2e"), { recursive: true, force: true });
    }
  }, 180_000);
});

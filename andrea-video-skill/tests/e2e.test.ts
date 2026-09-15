/**
 * e2e.test.ts — pipeline completa su media reale (ffmpeg testsrc + sine):
 * import_raw_media → analyze(transcript finto ma realistico) →
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
import type { Transcript } from "../src/types.js";

/** Binario hyperframes locale (evita npx che scaricherebbe il pacchetto).
 *  Punta al file .mjs reale: .bin/hyperframes è un symlink che si rompe
 *  quando il test gira con cwd diversa. */
const SKILL_ROOT = "/Users/andrea/Desktop/opensource skill videoediting/andrea-video-skill";
const HF_BIN = `${SKILL_ROOT}/node_modules/hyperframes/bin/hyperframes.mjs`;

describe("e2e pipeline", () => {
  it("RAW → EditPlan → HyperFrames project → lint pulito", async () => {
    const dir = mkdtempSync(join(tmpdir(), "avskill-e2e-"));
    try {
      // 1. RAW sintetico 10s, 1280x720, 30fps, con audio
      const raw = join(dir, "raw.mp4");
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc=duration=10:size=1280x720:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=10",
        "-shortest", "-y", raw,
      ]);

      // 2. ingest reale
      const [asset] = await importRawMedia([raw]);
      expect(asset.duration_sec).toBeCloseTo(10, 0);
      expect(asset.width).toBe(1280);

      // 3. transcript realistico su 10s (whisper vero richiede modello;
      //    qui verifichiamo che la pipeline digerisca il formato §9)
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
      const plan = generateEditPlan(structure, { style: "youtube_talking_head" });
      expect(plan.version).toBe("1.0");

      // 5. build progetto con RAW montato (copiato in ./assets dal builder).
      // NB: progetto dentro la skill — la CLI lint/render accetta DIR
      // posizionale e non segue la cwd del chiamante.
      const projDir = join(SKILL_ROOT, ".tmp-e2e", `run-${Date.now()}`);
      const proj = await buildHyperframesProject(plan, projDir, { rawVideoPath: raw });
      const html = readFileSync(join(projDir, "index.html"), "utf8");
      expect(html).toContain("./assets/raw.mp4");
      expect(proj.durationSec).toBeCloseTo(10, 0);

      // 6. hyperframes lint DIR --json (zero errori; i warning non bloccano)
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

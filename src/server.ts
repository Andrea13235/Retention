#!/usr/bin/env node
/**
 * server.ts — MCP server for the cutcraft.
 * Exposes 5 tools: import_raw_media, transcribe_media, analyze_transcript,
 * generate_edit_plan, render_video.
 * Transport: stdio (standard for Codex / Claude Code / MCP clients).
 *
 * Agent reading guide for the analysis + planning phase:
 * docs/analysis-guide.md (cut rules, attention curve, EditPlan reference).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { importRawMedia } from "./tools_ingest.js";
import { transcribeMedia } from "./tools_transcribe.js";
import { analyzeTranscript } from "./tools_analyze.js";
import { generateEditPlan } from "./tools_plan.js";
import { REGISTER_CADENCE, type StylePreset } from "./types.js";
import {
  buildHyperframesProject,
  renderVideo,
} from "./tools_render.js";
import { RENDER_PRESETS } from "./types.js";

const server = new McpServer({
  name: "cutcraft",
  version: "0.1.0",
});

server.tool(
  "import_raw_media",
  "Step 1 — Register RAW files and extract metadata (duration, resolution, fps).",
  { paths: z.array(z.string()).min(1).describe("Paths of the RAW files") },
  async ({ paths }) => ({
    content: [{ type: "text", text: JSON.stringify(await importRawMedia(paths), null, 2) }],
  })
);

server.tool(
  "transcribe_media",
  "Step 2 — Transcribe audio with local Whisper (per-segment/per-word timecodes). Language auto-detected (~100 languages). Model: auto = large-v3 on GPU/Apple Silicon, small on CPU. Speed tip: `small` is 7–8x faster and word timings are equally good — pass model=`small` for drafts, long podcasts, or when you only need timings; use large-v3 (default on fast hardware) when every word must be exact for final captions.",
  {
    media_path: z.string().describe("Path of the file to transcribe"),
    media_id: z.string().describe("media_id from import_raw_media"),
    model: z.string().optional().describe("Whisper model override: `small` (fast, good timings) or `large-v3` (exact words). Default: auto."),
  },
  async ({ media_path, media_id, model }) => ({
    content: [
      { type: "text", text: JSON.stringify(await transcribeMedia(media_path, media_id, { model }), null, 2) },
    ],
  })
);

const RiskPoint = z.object({
  start: z.string().describe("Risk window start (HH:MM:SS.mmm)"),
  end: z.string().describe("Risk window end (HH:MM:SS.mmm)"),
  reason: z.string().describe("Why attention may drop here"),
});

server.tool(
  "analyze_transcript",
  "Step 3 — Narrative analysis: hook, sections, fillers, attention dips, highlights, cut candidates with confidence (dead air, stutters, filler runs, trims). ALWAYS inspect `needs_review`: every flagged word is a likely-mangled brand/proper noun — confirm each with the user (or from context) and pass the fixes as `corrections`, otherwise the raw ASR text burns into the captions. Reading guide: docs/analysis-guide.md.",
  {
    transcript: z.string().describe("Transcript JSON (transcribe_media output)"),
    longPauseSec: z.number().optional(),
    sectionCount: z.number().optional(),
    deadAirSec: z.number().optional().describe("Word-gap threshold for dead-air cuts (default 0.8, short-form 0.4-0.5)"),
    corrections: z
      .array(z.object({ misheard: z.string(), correct: z.string() }))
      .optional()
      .describe("Fix ASR-mangled words before analysis (e.g. 'rawcat' -> 'CutCraft'). Get these from the previous run's `needs_review`."),
  },
  async ({ transcript, longPauseSec, sectionCount, deadAirSec, corrections }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          analyzeTranscript(JSON.parse(transcript), { longPauseSec, sectionCount, deadAirSec, corrections }),
          null,
          2
        ),
      },
    ],
  })
);

const STYLE: [StylePreset, ...StylePreset[]] = [
  "show",
  "educational",
  "tutorial",
  "podcast",
  "short_form",
  "youtube_talking_head",
];

server.tool(
  "generate_edit_plan",
  "Step 4 — Generate the Action Plan JSON v1.3: a real KEEP splice (confidence-gated cuts), kept-words-only karaoke captions, act-based motion, content-aware graphic banners. STYLE picks the rhythm register (show ~2s / educational ~5s / tutorial ~20s / podcast ~60s cadence, measured on real reference videos). TAKESCOUNT is the footage gate and defaults to 1 (single_take): with one take the plan NEVER fakes multi-cam energy (caption pops only); pass the real take count (≥2) to unlock show rhythm and punch zooms. Legacy youtube_talking_head = educational. ALWAYS inspect `review_cuts` in the output before rendering: SKIPPED entries need an explicit promote-or-keep decision, APPLIED entries need a rhetoric check. Reading guide: docs/analysis-guide.md. Every attention_risk_point gets interrupt coverage.",
  {
    structure: z.string().describe("NarrativeStructure JSON (analyze_transcript output)"),
    transcript: z
      .string()
      .optional()
      .describe("Transcript JSON (transcribe_media output) — word timestamps feed karaoke captions (only kept words render)"),
    style: z.enum(STYLE).optional().describe(
      `Rhythm register. educational (default): steady explainer pace (~5s cadence). show: MrBeast-grade energy (~2s) — needs takesCount ≥2, downgraded to educational on a single take. tutorial: locked-off screen-led pace (~20s). podcast: conversation breathing room (~60s). short_form: vertical snap (~4s). Cadences: ${Object.entries(REGISTER_CADENCE).map(([k, v]) => `${k}=${v}s`).join(", ")}.`
    ),
    sourcePortrait: z.boolean().optional().describe("Set when the source footage is portrait (forces 9:16 short canvas)"),
    takesCount: z.number().int().min(1).optional().describe("Takes in hand (default 1 = single_take: no faked coverage, caption pops only). Pass the real count — ≥2 unlocks show rhythm and punch zooms."),
    brollSources: z.array(z.string()).optional(),
    attentionRiskPoints: z
      .array(RiskPoint)
      .optional()
      .describe("Static blocks at risk of attention drop (each gets a dedicated interrupt)"),
    extraCuts: z
      .array(RiskPoint)
      .optional()
      .describe("Agent-chosen CUT ranges (false starts / rhetoric heuristics can't judge)"),
    corrections: z
      .array(z.object({ misheard: z.string(), correct: z.string() }))
      .optional()
      .describe("Fix ASR-mangled words in captions (also accepted by analyze_transcript)"),
  },
  async ({ structure, transcript, style, sourcePortrait, takesCount, brollSources, attentionRiskPoints, extraCuts, corrections }) => {
    let words: Array<{ start: string; word: string }> | undefined;
    if (transcript) {
      try {
        const t = JSON.parse(transcript) as {
          segments?: Array<{ words?: Array<{ start: string; word: string }> }>;
        };
        words = (t.segments ?? []).flatMap((s) =>
          (s.words ?? []).map((w) => ({ start: w.start, word: w.word }))
        );
        if (words.length === 0) words = undefined;
      } catch {
        words = undefined;
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            generateEditPlan(JSON.parse(structure), {
              style,
              sourcePortrait,
              takesCount,
              brollSources,
              attentionRiskPoints,
              extraCuts,
              corrections,
            }, words),
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "render_video",
  "Step 5+6 — Build the HyperFrames project from the Action Plan and render it to MP4. Quality: standard = transparent (crf 16), high = max (slow + crf 15, slower). `fps`: omit to keep the footage native frame rate (recommended); set 24|25|30|60 only for a delivery spec. `crf`: omit (preset curve is already transparent). The builder VALIDATES the plan and throws on overlapping karaoke captions or zooms inside a cut mask (with the exact fix) — never renders garbage. Only call after clearing `needs_review` and `review_cuts`.",
  {
    edit_plan: z.string().describe("EditPlan JSON (generate_edit_plan output)"),
    project_dir: z.string().describe("HyperFrames project output folder"),
    raw_video_path: z.string().optional().describe("RAW footage to mount in clips"),
    preset: z.enum(["draft", "standard", "high"]).optional(),
    fps: z.number().optional().describe("Target fps (24|25|30|60). Omit = source rate (recommended)."),
    crf: z.number().optional().describe("CRF 0–51 override. Omit = preset curve (recommended)."),
  },
  async ({ edit_plan, project_dir, raw_video_path, preset, fps, crf }) => {
    const project = await buildHyperframesProject(JSON.parse(edit_plan), project_dir, {
      rawVideoPath: raw_video_path,
    });
    const output = await renderVideo(project, {
      preset: (preset ?? "standard") as keyof typeof RENDER_PRESETS,
      ...(typeof fps === "number" ? { fps } : {}),
      ...(typeof crf === "number" ? { crf } : {}),
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ project, output }, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("cutcraft MCP server running (stdio)");

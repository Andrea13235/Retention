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
import { generateEditPlan, type StylePreset } from "./tools_plan.js";
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
  "Step 2 — Transcribe audio with local Whisper (per-segment/per-word timecodes). Language auto-detected (~100 languages).",
  {
    media_path: z.string().describe("Path of the file to transcribe"),
    media_id: z.string().describe("media_id from import_raw_media"),
    model: z.string().optional().describe("Whisper model override (default: auto)"),
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
  "Step 3 — Narrative analysis: hook, sections, fillers, attention dips, highlights, cut candidates (dead air, stutters, filler runs, trims). Reading guide: docs/analysis-guide.md.",
  {
    transcript: z.string().describe("Transcript JSON (transcribe_media output)"),
    longPauseSec: z.number().optional(),
    sectionCount: z.number().optional(),
    deadAirSec: z.number().optional().describe("Word-gap threshold for dead-air cuts (default 0.8, short-form 0.4-0.5)"),
    corrections: z
      .array(z.object({ misheard: z.string(), correct: z.string() }))
      .optional()
      .describe("Fix ASR-mangled words before analysis (e.g. 'raw cut' -> 'CutCraft')"),
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
  "youtube_talking_head",
  "podcast",
  "short_form",
];

server.tool(
  "generate_edit_plan",
  "Step 4 — Generate the Action Plan JSON v1.2: a real KEEP splice (complement of cut_candidates), kept-words-only karaoke captions, act-based motion. Reading guide: docs/analysis-guide.md. Every attention_risk_point gets interrupt coverage.",
  {
    structure: z.string().describe("NarrativeStructure JSON (analyze_transcript output)"),
    transcript: z
      .string()
      .optional()
      .describe("Transcript JSON (transcribe_media output) — word timestamps feed karaoke captions (only kept words render)"),
    style: z.enum(STYLE).optional(),
    sourcePortrait: z.boolean().optional().describe("Set when the source footage is portrait (forces 9:16 short canvas)"),
    interruptEverySec: z.number().optional(),
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
  async ({ structure, transcript, style, sourcePortrait, interruptEverySec, brollSources, attentionRiskPoints, extraCuts, corrections }) => {
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
              interruptEverySec,
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
  "Step 5+6 — Build the HyperFrames project from the Action Plan and render it to MP4.",
  {
    edit_plan: z.string().describe("EditPlan JSON (generate_edit_plan output)"),
    project_dir: z.string().describe("HyperFrames project output folder"),
    raw_video_path: z.string().optional().describe("RAW footage to mount in clips"),
    preset: z.enum(["draft", "standard", "high"]).optional(),
  },
  async ({ edit_plan, project_dir, raw_video_path, preset }) => {
    const project = await buildHyperframesProject(JSON.parse(edit_plan), project_dir, {
      rawVideoPath: raw_video_path,
    });
    const output = await renderVideo(project, {
      preset: (preset ?? "standard") as keyof typeof RENDER_PRESETS,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ project, output }, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("cutcraft MCP server running (stdio)");

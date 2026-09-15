#!/usr/bin/env node
/**
 * server.ts — MCP server della skill andrea-video-skill (spec §3).
 * Espone 5 tools: import_raw_media, transcribe_media, analyze_transcript,
 * generate_edit_plan, build_hyperframes_project/render_video.
 * Transport: stdio (standard per Codex / Claude Code / MCP client).
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
  name: "andrea-video-skill",
  version: "0.1.0",
});

server.tool(
  "import_raw_media",
  "Step 1 — Registra file RAW e ne estrae metadati (durata, risoluzione, fps).",
  { paths: z.array(z.string()).min(1).describe("Percorsi dei file RAW") },
  async ({ paths }) => ({
    content: [{ type: "text", text: JSON.stringify(await importRawMedia(paths), null, 2) }],
  })
);

server.tool(
  "transcribe_media",
  "Step 2 — Trascrive l'audio con Whisper locale (timecode per segmento/parola).",
  {
    media_path: z.string().describe("Percorso del file da trascrivere"),
    media_id: z.string().describe("media_id da import_raw_media"),
    model: z.string().optional().describe("Override modello Whisper (default: auto)"),
  },
  async ({ media_path, media_id, model }) => ({
    content: [
      { type: "text", text: JSON.stringify(await transcribeMedia(media_path, media_id, { model }), null, 2) },
    ],
  })
);

server.tool(
  "analyze_transcript",
  "Step 3 — Analisi narrativa: hook, sezioni, filler, cali di attenzione, highlight.",
  {
    transcript: z.string().describe("Transcript JSON (output di transcribe_media)"),
    longPauseSec: z.number().optional(),
    sectionCount: z.number().optional(),
  },
  async ({ transcript, longPauseSec, sectionCount }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          analyzeTranscript(JSON.parse(transcript), { longPauseSec, sectionCount }),
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
  "Step 4 — Genera l'Action Plan JSON (cuts, animations, broll, pattern_interrupts).",
  {
    structure: z.string().describe("NarrativeStructure JSON (output di analyze_transcript)"),
    style: z.enum(STYLE).optional(),
    interruptEverySec: z.number().optional(),
    brollSources: z.array(z.string()).optional(),
  },
  async ({ structure, style, interruptEverySec, brollSources }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          generateEditPlan(JSON.parse(structure), { style, interruptEverySec, brollSources }),
          null,
          2
        ),
      },
    ],
  })
);

server.tool(
  "render_video",
  "Step 5+6 — Costruisce il progetto HyperFrames dall'Action Plan e lo renderizza in MP4.",
  {
    edit_plan: z.string().describe("EditPlan JSON (output di generate_edit_plan)"),
    project_dir: z.string().describe("Cartella di output del progetto HyperFrames"),
    raw_video_path: z.string().optional().describe("RAW da montare nei clip"),
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
console.error("andrea-video-skill MCP server attivo (stdio)");

#!/usr/bin/env node
/**
 * server.ts — MCP server for retention.
 * Exposes core tools: import_raw_media, transcribe_media, analyze_transcript,
 * generate_edit_plan, render_video, generate_thumbnail, verify_render.
 * Transport: stdio (standard for Codex / Claude Code / MCP clients).
 * Supports RetentionVolt (retentionvolt.com) blueprints for high-retention editing.
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
  extractVerificationFrames,
  renderThumbnail,
  renderVideo,
} from "./tools_render.js";
import {
  connectRetentionVolt,
  fetchRetentionVoltBlueprint,
  findSimilarVideo,
} from "./retentionvolt_client.js";
import { extractStructureProfile, profileToVector, buildAgentMessage, inferVideoType } from "./tools_similarity.js";
import { RENDER_PRESETS } from "./types.js";

const server = new McpServer({
  name: "retention",
  version: "0.2.0",
});

server.tool(
  "connect_retentionvolt",
  "Step 0 — Check status, launch one-click browser login, or authenticate with RetentionVolt (retentionvolt.com). If open_browser is true, automatically opens the user's default browser directly to the login page and listens for one-click callback. When api_key is passed, verifies and saves it locally in ~/.retention/config.json.",
  {
    api_key: z
      .string()
      .optional()
      .describe("RetentionVolt Pro API key (rv_live_...) obtained from https://retentionvolt.com/settings/mcp"),
    open_browser: z
      .boolean()
      .optional()
      .describe("If true, automatically opens the RetentionVolt login/authorization page in the user's browser"),
  },
  async ({ api_key, open_browser }) => {
    try {
      const status = await connectRetentionVolt(api_key, undefined, { openBrowser: open_browser });
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `connect_retentionvolt failed: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "fetch_retentionvolt_blueprint",
  "Query the RetentionVolt database for matching analyzed video retention curves, motion graphics patterns, and high-CTR thumbnail recipes.",
  {
    query: z.string().min(1).describe("Topic or title of the video (e.g. 'Coding Tutorial', 'MrBeast Challenge', 'Crypto Explainer')"),
    niche: z.enum(["tech", "productivity", "entertainment", "finance", "storytelling", "fitness"]).optional(),
    format: z.enum(["short", "long"]).optional(),
  },
  async ({ query, niche, format }) => {
    try {
      const blueprint = await fetchRetentionVoltBlueprint(query, { niche, format });
      return {
        content: [{ type: "text", text: JSON.stringify(blueprint, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `fetch_retentionvolt_blueprint failed: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "find_similar_video",
  "Step 3b (RetentionVolt Enhanced) — Trova il video top-performer più simile nel database RetentionVolt usando 4 dimensioni (niche, video_type, topic, format). Da chiamare DOPO analyze_transcript e PRIMA di generate_edit_plan.",
  {
    transcript_text: z.string().min(1).describe("Testo completo delle parole parlate"),
    structure_json: z.string().describe("NarrativeStructure JSON restituito da analyze_transcript"),
    format: z.enum(["short", "long"]).optional(),
    language: z.string().optional(),
    niche: z.enum(["tech", "productivity", "entertainment", "finance", "fitness", "storytelling", "lifestyle", "gaming", "food", "travel", "fashion", "education", "science", "news", "comedy"]).optional(),
    video_type: z.enum(["talking_head", "talking_head_with_screen_share", "vlog", "tutorial_screencast", "podcast", "cinematic_branded"]).optional().describe("Tipologia video: se omessa, viene dedotta automaticamente dal transcript."),
    top_k: z.number().int().min(1).max(10).optional(),
  },
  async ({ transcript_text, structure_json, format, language, niche, video_type, top_k }) => {
    let structure: any;
    try {
      structure = JSON.parse(structure_json);
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "structure_json deve essere un JSON valido da analyze_transcript" }],
      };
    }

    try {
      const resolvedType = video_type ?? inferVideoType(transcript_text, {
        isPortrait: structure.is_portrait,
        durationSec: structure.duration_sec,
      });

      const resolvedFormat: "short" | "long" =
        format ??
        (structure.is_portrait || (structure.duration_sec && structure.duration_sec <= 60)
          ? "short"
          : "long");

      const result = await findSimilarVideo(transcript_text, {
        format: resolvedFormat,
        language,
        niche,
        videoType: resolvedType,
        topK: top_k,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `find_similar_video error: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "import_raw_media",
  "Step 1 — Register RAW files and extract metadata (duration, resolution, fps).",
  { paths: z.array(z.string()).min(1).describe("Paths of the RAW files") },
  async ({ paths }) => {
    try {
      return {
        content: [{ type: "text", text: JSON.stringify(await importRawMedia(paths), null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `import_raw_media failed: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "transcribe_media",
  "Step 2 — Transcribe audio with local Whisper (per-segment/per-word timecodes). Language auto-detected (~100 languages). Model: auto = large-v3 on GPU/Apple Silicon, small on CPU. Speed tip: `small` is 7–8x faster and word timings are equally good — pass model=`small` for drafts, long podcasts, or when you only need timings; use large-v3 (default on fast hardware) when every word must be exact for final captions.",
  {
    media_path: z.string().describe("Path of the file to transcribe"),
    media_id: z.string().describe("media_id from import_raw_media"),
    model: z.string().optional().describe("Whisper model override: `small` (fast, good timings) or `large-v3` (exact words). Default: auto."),
  },
  async ({ media_path, media_id, model }) => {
    try {
      return {
        content: [
          { type: "text", text: JSON.stringify(await transcribeMedia(media_path, media_id, { model }), null, 2) },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `transcribe_media failed: ${(err as Error).message}` }],
      };
    }
  }
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
      .describe("Fix ASR-mangled words before analysis (e.g. 'rawcat' -> 'Retention'). Get these from the previous run's `needs_review`."),
  },
  async ({ transcript, longPauseSec, sectionCount, deadAirSec, corrections }) => {
    let parsedTranscript: any;
    try {
      parsedTranscript = JSON.parse(transcript);
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "analyze_transcript: 'transcript' must be valid JSON output from transcribe_media" }],
      };
    }

    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              analyzeTranscript(parsedTranscript, { longPauseSec, sectionCount, deadAirSec, corrections }),
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `analyze_transcript failed: ${(err as Error).message}` }],
      };
    }
  }
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
    retentionvolt_blueprint: z
      .string()
      .optional()
      .describe("Optional RetentionVolt blueprint JSON (from retentionvolt.com MCP server). Injects proven animations, motion graphics and pattern interrupts directly, bypassing heuristic guesswork."),
    disableGraphics: z
      .boolean()
      .optional()
      .describe("When true, no TOP graphic banner (act_title/highlight) is generated. Default: true on single_take (restraint), false when RetentionVolt blueprint provides graphics or takesCount ≥2. Pass false to force banners."),
    shots: z
      .array(
        z.object({
          start: z.string().describe("Start timecode HH:MM:SS.mmm"),
          end: z.string().describe("End timecode HH:MM:SS.mmm"),
          shot_type: z.enum([
            "talking_head_fullscreen",
            "screen_share_fullscreen",
            "pip_talking_head_on_screen",
            "split_screen",
            "talking_head_pip",
            "b_roll_fullscreen",
          ]),
          pip_position: z.enum(["bottom_right", "bottom_left", "top_right", "top_left"]).optional(),
          pip_size_pct: z.number().optional(),
          split_ratio: z.string().optional(),
          media_url: z.string().optional(),
          title: z.string().optional(),
          subtitle: z.string().optional(),
        })
      )
      .optional()
      .describe("Directorial camera and visual setups (screen share, PiP, demonstrative slides/images)"),
  },
  async ({ structure, transcript, style, sourcePortrait, takesCount, brollSources, attentionRiskPoints, extraCuts, corrections, retentionvolt_blueprint, disableGraphics, shots }) => {
    let parsedStructure: any;
    try {
      parsedStructure = JSON.parse(structure);
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "generate_edit_plan: 'structure' must be valid JSON output from analyze_transcript" }],
      };
    }

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
        return {
          isError: true,
          content: [{ type: "text", text: "generate_edit_plan: 'transcript' must be valid JSON output from transcribe_media" }],
        };
      }
    }

    let rvBlueprint: any;
    if (retentionvolt_blueprint) {
      try {
        rvBlueprint = JSON.parse(retentionvolt_blueprint);
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: "generate_edit_plan: 'retentionvolt_blueprint' must be valid JSON from fetch_retentionvolt_blueprint" }],
        };
      }
    }

    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              generateEditPlan(
                parsedStructure,
                {
                  style,
                  sourcePortrait,
                  takesCount,
                  brollSources,
                  attentionRiskPoints,
                  extraCuts,
                  corrections,
                  retentionvoltBlueprint: rvBlueprint,
                  disableGraphics,
                  shots,
                },
                words
              ),
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `generate_edit_plan failed: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "generate_thumbnail",
  "Step 4b — Extract high-impact hook base frame and export companion CTR metadata (title/badge/style) ready for cover production.",
  {
    source_video_path: z.string().describe("Path of the video file to capture frame from"),
    output_path: z.string().describe("Output image path (e.g. ./thumbnail.jpg)"),
    frame_time: z.string().optional().describe("Timestamp to capture frame from (HH:MM:SS.mmm, default 00:00:02.000)"),
    title: z.string().optional().describe("Hook title / headline for cover"),
    badge: z.string().optional().describe("Highlight badge text"),
    style: z.enum(["minimal", "bold", "youtube_clean"]).optional(),
  },
  async ({ source_video_path, output_path, frame_time, title, badge, style }) => {
    try {
      const thumb = await renderThumbnail(source_video_path, output_path, {
        title: title ?? "Thumbnail",
        badge,
        frame_time,
        style,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ thumbnail: thumb, status: "generated" }, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `generate_thumbnail failed: ${(err as Error).message}` }],
      };
    }
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
    let parsedPlan: any;
    try {
      parsedPlan = JSON.parse(edit_plan);
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "render_video: 'edit_plan' must be valid JSON output from generate_edit_plan" }],
      };
    }

    try {
      const project = await buildHyperframesProject(parsedPlan, project_dir, {
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
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `render_video failed: ${(err as Error).message}` }],
      };
    }
  }
);

server.tool(
  "verify_render",
  "Step 6 — Mandatory Frame-by-Frame Quality Gate: extract screenshots across all key beats (hook, cuts, graphic entrances, keyword emphasis, shot transitions) to inspect audio-visual sync, in-bounds safe areas, and publish-ready broadcast quality before delivery.",
  {
    video_path: z.string().describe("Path to rendered MP4 video to verify"),
    edit_plan: z.string().optional().describe("EditPlan JSON string used to identify exact beat timestamps"),
    output_dir: z.string().optional().describe("Directory where PNG screenshots will be stored (defaults to <video_dir>/review_frames)"),
    custom_timestamps: z.array(z.string()).optional().describe("Optional list of specific timecodes to extract (HH:MM:SS.mmm)"),
  },
  async ({ video_path, edit_plan, output_dir, custom_timestamps }) => {
    try {
      const result = await extractVerificationFrames(video_path, {
        editPlan: edit_plan,
        outputDir: output_dir,
        customTimestamps: custom_timestamps,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `verify_render failed: ${(err as Error).message}` }],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("retention MCP server running (stdio)");

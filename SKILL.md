---
name: cutcraft
description: Use when the user wants to auto-edit RAW footage into a publish-ready video. Transcribe, narrative analysis, edit plan, HyperFrames render pipeline.
version: 0.1.0
author: Andrea Barretta
license: SEE LICENSE IN LICENSE.md
metadata:
  hermes:
    tags: [video-editing, hyperframes, whisper, mcp, automation]
    related_skills: []
---

# CutCraft — RAW to Publish-Ready Video

## Overview

Turn RAW creator footage into a publish-ready MP4 without an NLE.
The pipeline is fixed and sequential — transcription, narrative analysis,
edit plan, HyperFrames render. Every stage's output feeds the next;
never skip a stage or invent timestamps by hand.

## When to Use

- User provides RAW video/audio and asks for an edited video
- User asks for transcription with timecodes, filler cuts, captions, b-roll
- User wants a YouTube talking-head, podcast, or short-form clip edit

Don't use for:

- Generic text-to-video generation (no source footage involved)
- Manual timeline editing in Premiere/DaVinci (this skill replaces that)
- Image-only or audio-only creative work

## Pipeline (in order, no skipping)

### 0. Format — decide FIRST, before touching any footage

The very first thing: figure out whether the user wants a **short**
or a **long** video. Everything downstream (canvas, style, cadence,
captions) depends on this decision.

1. **Explicit request wins.** If the user already says it ("creami il
   mio short", "un reel verticale", "un video lungo per YouTube",
   "podcast"), route directly — no questions asked:
   - short signals → `style: "short_form"`, `format: "short"` (9:16)
   - long signals → `style: "youtube_talking_head"` (default) or
     `"podcast"`, `format: "long"` (16:9)
2. **Otherwise ASK first.** Before ingest, ask one question — short
   or long? (horizontal 16:9 vs vertical 9:16). Never assume, never
   start the pipeline on an unconfirmed format.
3. **Confirm against the footage.** After `import_raw_media`, check
   `is_portrait` / `display_width` × `display_height`: a portrait RAW
   with a "long" request (or landscape RAW with a "short" request)
   is a mismatch — flag it to the user and confirm how to proceed
   (crop/reframe vs switching format) instead of silently rendering
   the wrong canvas.

Completion: `style` + `format` decided and (if asked) confirmed by
the user before Step 1 runs.

### 1. Ingest — `import_raw_media(paths)`

Register each RAW file. Returns `media_id` + metadata (duration,
resolution, fps, audio streams). Completion: one asset per input file,
all with `duration_sec > 0`.

### 2. Transcribe — `transcribe_media(media_path, media_id)`

Local Whisper transcription with word-level timecodes. The model is
auto-selected (`large-v3` on NVIDIA GPU / Apple Silicon, `small` on CPU).
Whisper auto-detects the spoken language (~100 languages: Italian, English,
Spanish, French, German, …) — no language option needed.
Completion: transcript JSON with `segments[]`, each with `start`/`end`
in `HH:MM:SS.mmm` format, plus the detected `language` code.

### 3. Analyze — `analyze_transcript(transcript, deadAirSec?, corrections?)`

Deterministic narrative analysis: hook (first 30s), thematic sections,
filler segments (≥40% filler words), attention dips (pauses ≥2.5s),
highlights (densest 20%), keywords + hook moment + slow spots —
`cut_candidates` with confidence (dead air, stutters, filler runs,
false starts, head/tail trims), and `needs_review`: likely-mangled
brand/proper nouns the agent MUST confirm. Workflow: run once WITHOUT
corrections, confirm EVERY `needs_review` word, re-run WITH corrections,
only then plan. Completion: structure with `hook`, `sections`,
`fillers`, `attention_dips`, `highlights`, `cut_candidates`,
`needs_review` — all timecodes within media bounds.

> Agent reading guide for this step and the next: [`docs/analysis-guide.md`](docs/analysis-guide.md)
> (cut rules, attention curve, technique catalog, EditPlan reference).

### 4. Plan — `generate_edit_plan(structure, transcript?, style?, sourcePortrait?, takesCount?, extraCuts?, corrections?)`

Build the machine-actionable Edit Plan v1.3. The decision chain is
fixed — follow it in this order, no improvising:

1. **Format** (from Step 0): `short` → 9:16 canvas, hook-first, punch
   every ~4s, captions always on. `long` → 16:9, breathing room.
2. **Register** (`style` param): the rhythm, measured on 4 real
   reference videos — `educational` (default, steady explainer ~5s),
   `show` (MrBeast-grade energy ~2s), `tutorial` (locked-off
   screen-led ~20s), `podcast` (conversation ~60s). Legacy
   `youtube_talking_head` = `educational`. The plan writes back
   `resolvedRegister` — read it, don't assume.
3. **Footage gate** (`takesCount`, default 1 = single_take): with ONE
   take the plan NEVER fakes multi-cam energy — interrupts are
   `caption_pop` only, no `zoom_punch`, no show rhythm. A `show`
   request on a single take is downgraded to `educational` WITH a
   `structure_notes` entry explaining why (never silent). Pass the
   REAL take count: ≥2 unlocks show rhythm and punch zooms.
4. **Cuts** as a real KEEP splice (confidence-gated: ≥0.85 auto,
   0.5–0.85 applied+flagged in `review_cuts`, <0.5 skipped as
   proposal; manual extraCuts always apply).
5. **Captions**: non-overlapping karaoke with only kept, corrected
   words + keyword emphasis, NO zoom on cleanup-cut resumes — hard
   cuts stay naked, slow_zoom opens new acts only, zoom_punch solely
   for explicit agent attentionRiskPoints (with real coverage) or
   section boundaries, veto on any zoom in CUTs/pre-cut masks.
6. **Graphics**: content-aware banners (`act_title` on new acts,
   `number_stat` on spoken numbers, `highlight` on top keywords,
   `quote` recap past midpoint on >8min media) — text ALWAYS
   transcript-verbatim, TOP position (captions live at the bottom),
   max 1 at a time. Read `structure.speech.wpm` to sanity-check the
   register: ~170–190 = educational/show-grade, ≥220 sustained =
   tutorial-grade density (the screen must change, not the face).
`broll` (when sources provided). MANDATORY: read `review_cuts`
before rendering. Pass the transcript JSON so words feed captions.
Completion: valid EditPlan v1.3, KEEP cuts ordered with no gaps, no
zero-length segments, `resolvedRegister` + `takesCount` written.

### 5. Render — `render_video(edit_plan, project_dir, raw_video_path?, preset?)`

Build the HyperFrames standalone composition and render the MP4.
Presets: `draft` (fast iteration), `standard` (default), `high` (delivery).
Completion: output MP4 exists, non-empty, duration matches the plan.

## Style Presets (rhythm registers — measured, not vibes)

| Style | Interrupt cadence | Best for |
|---|---|---|
| `educational` (default) | ~5s | Explainers, talking-head YouTube, product videos |
| `show` | ~2s | High-energy entertainment — NEEDS takesCount ≥2 (downgraded to educational on a single take) |
| `tutorial` | ~20s | Screen-led tutorials (the screen changes, the face stays) |
| `podcast` | ~60s | Long-form conversations |
| `short_form` | ~4s | Vertical clips, reels, shorts |
| `youtube_talking_head` | = educational | Legacy alias (old plans still parse; write `educational` in new work) |

Measured 2026-09-15 on 4 reference videos: MrBeast "100 Days in a
Circle" (28 cuts/min → ~2s), Higgsfield educational (13/min → ~5s),
Higgsfield motion-graphics (9/min → educational), Nate Herk tutorial
(locked-off 30min → ~20s). Speech pace: educational/show ~170–190 wpm,
tutorial ~257 wpm. The single source of truth is `REGISTER_CADENCE`
in `src/types.ts` — this table mirrors it.

## Rules

- Timecodes are always `HH:MM:SS.mmm`. Never invent timestamps; every
  cut/animation references transcript or analysis output.
- The agent may refine wording (titles, captions) but never the timing —
  timing comes from the deterministic tools.
- Render `draft` for iteration, `high` only for final delivery.
- If `setup-check` fails, fix the environment before starting the pipeline.

## Common Pitfalls

1. **Skipping analyze and hand-writing cuts.** The timing must come from
   transcript analysis, not from watching or guessing. Fix: always run
   steps 1→2→3 before planning.
2. **Wrong timecode format.** `MM:SS` or bare seconds break downstream
   tools. Fix: `HH:MM:SS.mmm` everywhere.
3. **Rendering `high` on the first try.** Slow and wasteful when the plan
   is unreviewed. Fix: `draft` first, `high` after approval.
4. **Missing faster-whisper.** `transcribe_media` fails with install
   instructions. Fix: `node scripts/setup-whisper.js`.
5. **No RAW path in render.** Without `raw_video_path` the composition
   renders placeholder cards (fine for layout check, not for delivery).

## Verification Checklist

- [ ] `node scripts/setup-check.js` exits 0
- [ ] `import_raw_media` returns one asset per file with real metadata
- [ ] Transcript covers the full media duration
- [ ] Edit Plan `version` is `"1.3"` with `format`, `resolvedRegister`,
  `takesCount`, KEEP cuts ordered with no gaps, no zero-length cuts
- [ ] `graphics[]` (if present): transcript-verbatim text, max 1 banner
  at a time, TOP position — never over the bottom captions
- [ ] `index.html` contains `data-composition-id`, `__timelines`, no `<template>` wrapper
- [ ] Output MP4 exists, non-empty, duration matches plan

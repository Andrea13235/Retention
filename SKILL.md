---
name: andrea-video-skill
description: Use when the user wants to auto-edit RAW footage into a publish-ready video. Transcribe, narrative analysis, edit plan, HyperFrames render pipeline.
version: 0.1.0
author: Andrea Barretta
license: SEE LICENSE IN LICENSE.md
metadata:
  hermes:
    tags: [video-editing, hyperframes, whisper, mcp, automation]
    related_skills: []
---

# Andrea Video Skill — RAW to Publish-Ready Video

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

### 1. Ingest — `import_raw_media(paths)`

Register each RAW file. Returns `media_id` + metadata (duration,
resolution, fps, audio streams). Completion: one asset per input file,
all with `duration_sec > 0`.

### 2. Transcribe — `transcribe_media(media_path, media_id)`

Local Whisper transcription with word-level timecodes. The model is
auto-selected (`large-v3` on NVIDIA GPU / Apple Silicon, `small` on CPU).
Completion: transcript JSON with `segments[]`, each with `start`/`end`
in `HH:MM:SS.mmm` format.

### 3. Analyze — `analyze_transcript(transcript)`

Deterministic narrative analysis: hook (first 30s), thematic sections,
filler segments (≥40% filler words), attention dips (pauses ≥2.5s),
highlights (densest 20%). Completion: structure with `hook`, `sections`,
`fillers`, `attention_dips`, `highlights` — all timecodes within media bounds.

### 4. Plan — `generate_edit_plan(structure, style?)`

Build the machine-actionable Edit Plan v1.0: `cuts` (keep hook + sections,
mark fillers `TAGLIARE`), `animations` (captions on highlights, zoom-in
on dips), `broll` (when sources provided), `pattern_interrupts` on cadence
(talking-head ~25s, podcast ~60s, short-form ~4s). Completion: valid
EditPlan, cuts ordered, no zero-length segments.

### 5. Render — `render_video(edit_plan, project_dir, raw_video_path?, preset?)`

Build the HyperFrames standalone composition and render the MP4.
Presets: `draft` (fast iteration), `standard` (default), `high` (delivery).
Completion: output MP4 exists, non-empty, duration matches the plan.

## Style Presets

| Style | Interrupt cadence | Best for |
|---|---|---|
| `youtube_talking_head` | ~25s | Talking-head YouTube videos |
| `podcast` | ~60s | Long-form conversations |
| `short_form` | ~4s | Vertical clips, reels, shorts |

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
   instructions. Fix: `pip install -r requirements.txt`.
5. **No RAW path in render.** Without `raw_video_path` the composition
   renders placeholder cards (fine for layout check, not for delivery).

## Verification Checklist

- [ ] `node scripts/setup-check.js` exits 0
- [ ] `import_raw_media` returns one asset per file with real metadata
- [ ] Transcript covers the full media duration
- [ ] Edit Plan `version` is `"1.0"`, cuts ordered, no zero-length cuts
- [ ] `index.html` contains `data-composition-id`, `__timelines`, no `<template>` wrapper
- [ ] Output MP4 exists, non-empty, duration matches plan

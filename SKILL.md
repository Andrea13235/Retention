---
name: Retention.editing
description: Use when the user wants to auto-edit RAW footage into a publish-ready video with maximum audience retention. Transcribe, narrative analysis, 100% native RetentionVolt database matching (85 viral videos, 13,487 cuts, 49 thumbnails, 15 motion graphics, 5 flows), 2.5D B-roll cutaways, animations, motion graphics, HyperFrames render pipeline, and high-CTR thumbnail generation.
version: 0.3.0
author: Andrea Barretta
license: SEE LICENSE IN LICENSE.md
metadata:
  hermes:
    tags: [video-editing, retention, retentionvolt, hyperframes, whisper, mcp, automation, b-roll, motion-graphics]
    related_skills: []
---

# Retention — RAW to Publish-Ready Video (100% Native RetentionVolt Engine)

## Overview

Turn RAW creator footage into a publish-ready MP4 with maximum audience retention, without an NLE.
The pipeline is fixed and sequential — format selection, ingest, transcription,
narrative analysis, **native RetentionVolt similarity search**, **2.5D B-roll cutaway generation**,
edit plan (with guaranteed B-roll, zoom animations, PiP/demonstration shots, and motion graphics),
HyperFrames render, frame-by-frame review, and delivery.

### ⚡ 100% Native RetentionVolt Database (Always Active)
RetentionVolt is **100% natively embedded inside this skill** (`data/` directory) and is **automatically used on every single edited video** with zero external connections, zero API keys, and zero login prompts:
- **`data/retentionvolt_videos.json`**: **85** analyzed viral reference videos with **13,487** frame-accurate shot, cut, B-roll, camera switch, punch-zoom, and motion-graphic events from top creators (MrBeast, Marques Brownlee, Ali Abdaal, Fireship, Alex Hormozi, Cleo Abram, Veritasium, Johnny Harris, etc.).
- **`data/retentionvolt_thumbnails.json`**: **49** analyzed high-CTR thumbnails with emotion, contrast score, color palette, composition type, and prompt recipes.
- **`data/retentionvolt_motion_graphics.json`**: **15** motion graphics specifications (`MG-001` through `MG-015`) with timing, easing, and glassmorphic CSS specs.
- **`data/retentionvolt_flows.json`**: **5** multi-shot retention flows (`hook_0_15s`, `problem_setup`, `interactive_demo`, `sponsor_segue`, `outro_loop`).

## When to Use

- User provides RAW video/audio and asks for an edited video
- User asks for transcription with timecodes, filler cuts, captions, B-roll cutaways, animations, motion graphics, or retention optimization
- User wants a YouTube talking-head, podcast, or short-form vertical reel/TikTok/short
- User wants a high-CTR video thumbnail/cover based on proven retention patterns

Don't use for:

- Generic text-to-video generation (no source footage involved)
- Manual timeline editing in Premiere/DaVinci (this skill replaces that)
- Image-only or audio-only creative work

---

## Pipeline (in order, no skipping)

### 0. Format & Canvas Selection

Determine whether the user wants a **short** (`9:16` vertical) or a **long** (`16:9` horizontal) video. Everything downstream (canvas, style, cadence, captions, B-roll aspect ratio) depends on this decision:
1. **Explicit request or portrait footage wins**:
   - Short signals or portrait video (`is_portrait: true`) → `style: "short_form"`, `format: "short"` (`1080×1920`)
   - Long signals or landscape video → `style: "educational"` (default) or `"podcast"` / `"tutorial"` / `"show"`, `format: "long"` (`1920×1080`)
2. **No external login or API check**: Do **NOT** ask the user to log in or connect to any external server. RetentionVolt is 100% native and runs automatically on every edit.

---

### 1. Ingest — `import_raw_media(paths)`

Register each RAW file. Returns `media_id` + metadata (`duration_sec`, `width`, `height`, `fps`, `audio_streams`, `rotation`, `is_portrait`).
Completion: one asset per input file, all with `duration_sec > 0`.

---

### 2. Transcribe — `transcribe_media(media_path, media_id, model?)`

Local Whisper transcription with word-level timecodes. The model is auto-selected
(`large-v3` on NVIDIA GPU / Apple Silicon, `small` on CPU).
Whisper auto-detects the spoken language (~100 languages: Italian, English, Spanish, French, German, …).
Completion: transcript JSON with `segments[]`, each with word `start`/`end` in `HH:MM:SS.mmm` format.

---

### 3. Analyze — `analyze_transcript(transcript, deadAirSec?, corrections?)`

Deterministic narrative analysis:
- `hook` (first 30s) & `hook_moment`
- `sections` (thematic acts)
- `fillers`, `attention_dips`, `slow_spots`, `highlights`, `keywords`
- `cut_candidates` with confidence (`dead_air`, `stutter`, `filler`, `false_start`, `trim_head`, `trim_tail`)
- `needs_review` (ASR-mangled brand/proper nouns — inspect and pass `corrections` so captions and motion graphics display the exact brand names)
- `cutaway_proposals`: Cut-safe semantic B-roll cutaway windows with `start`, `end`, `topic`, `suggested_prompt`, and `camera_motion` (`zoom_in_drift_right`, `zoom_in_drift_left`, `slow_pull_back`, `cinematic_pan`).

---

### 3b. Native RetentionVolt Similarity Search — `find_similar_video(transcript_text, structure_json, ...)` *(MANDATORY ON EVERY EDIT)*

**Always call `find_similar_video` after `analyze_transcript`** (and note that `generate_edit_plan` also executes it automatically if omitted). It queries the **embedded 85-video RetentionVolt database** across 4 dimensions:

| Dimension | Source | Note |
|---|---|---|
| **Niche** | Auto-inferred (IT + EN) or passed | `tech`, `productivity`, `entertainment`, `finance`, `fitness`, `storytelling`, `education`… |
| **Video Type** | Auto-inferred from transcript signals | `talking_head`, `talking_head_with_screen_share`, `vlog`, `tutorial_screencast`, `podcast`, `cinematic_branded` |
| **Topic** | Semantic keyword & creator matching | Matches against 85 viral videos & 13,487 timeline events |
| **Format** | From `import_raw_media` (`short`/`long`) | `short` (9:16), `long` (16:9) |

**Output (`SimilarVideoResult`)**:
- `matches[]`: top matching reference videos with `creator`, `title`, `similarity_score`, `avg_retention_pct`, `views_count`, and `blueprint`
- `best_blueprint`: rich `RetentionVoltBlueprint` containing:
  - `events[]` (`shot`, `zoom`, `graphic`, `animation`)
  - `animations[]` (`slow_zoom`, `zoom_in`, `zoom_out`)
  - `graphics[]` (`act_title`, `number_stat`, `highlight`, `quote`)
  - `pattern_interrupts[]` (`caption_pop`)
  - `thumbnail` (matched against the 49 high-CTR thumbnails in `data/retentionvolt_thumbnails.json`)
  - `retention_notes[]`

---

### 3c. 2.5D Ken Burns B-Roll Cutaway Generation — `generate_broll_cutaways(proposals, output_dir, aspect_ratio?)` *(MANDATORY ON EVERY EDIT)*

Every edited video **must include B-roll cutaways** with 2.5D Ken Burns camera drift:
1. Call `generate_broll_cutaways` passing `structure.cutaway_proposals` and `<project_dir>/assets` (with `aspect_ratio: "9:16"` for shorts or `"16:9"` for long-form).
2. Pass the returned `customBroll` array into `generate_edit_plan`.
3. Even if `customBroll` is omitted, `generate_edit_plan` automatically populates `plan.broll` from `structure.cutaway_proposals`, and `buildHyperframesProject` automatically synthesizes any missing B-roll visual assets in `<project_dir>/assets/` so **no video is ever rendered without B-roll cutaways**.

---

### 4. Plan — `generate_edit_plan(structure, transcript, style?, customBroll?, retentionvolt_blueprint?, ...)`

Build the machine-actionable `EditPlan v1.3`. Every generated plan is guaranteed to include:
1. **Confidence-Gated KEEP Splice (`cuts`)**: Removes dead air, stutters, and fillers while keeping speech natural.
2. **Kept-Words Karaoke Subtitles (`animations` → `karaoke_caption`)**: Word-by-word highlight at `bottom: 18%` (`z-index: 20`, above all B-roll and graphics) with keyword emphasis pops in `#ffd60a`.
3. **Dynamic Zoom Animations (`animations` → `slow_zoom`, `zoom_in`, `zoom_out`)**: Placed cuts-first (never crossing a cut or violating the 0.8s pre-cut mask / 2.0s post-cut settle) and non-overlapping.
4. **2.5D Ken Burns B-Roll Cutaways (`broll`)**: Clamped to `KEEP` intervals with entrance whip-blur, smooth scale + X/Y camera drift (`zoom_in_drift_right`, `zoom_in_drift_left`, `slow_pull_back`), and clean exit fade.
5. **Directorial Camera & PiP Shots (`shots`)**: `talking_head_fullscreen` hook framing and `pip_talking_head_on_screen` / `screen_share_fullscreen` demonstrative workspaces.
6. **Content-Aware Motion Graphics (`graphics`)**: Always enabled by default (`disableGraphics: false`), relocated to nearby kept slots if a timestamp lands near a cut, and non-overlapping on both source and spliced timelines (`act_title`, `number_stat`, `highlight`, and `quote` / terminal screen overlays).
7. **Pattern Interrupts (`pattern_interrupts`)**: Cadence-driven `caption_pop` / `zoom_punch` visual resets with radial glow pulse (`#punch-i`).
8. **High-CTR Thumbnail Recipe (`thumbnail`)**: Populated from the native RetentionVolt thumbnail database.

---

### 5. Render — `render_video` & `generate_thumbnail`

1. **Video Render (`render_video`)**:
   Builds the HyperFrames standalone composition (`index.html` + `hyperframes.json` + `./assets/`) and renders the MP4.
2. **Cover Generation (`generate_thumbnail`)**:
   Extracts the high-impact hook frame and writes companion CTR metadata (`thumbnail.json`).

---

### 6. Review & The Test — Frame-by-Frame Quality Gate (`verify_render`)

Call `verify_render({ video_path, edit_plan })` to extract PNG screenshots across all key beats (`hook_intro`, `graphic_*`, `shot_*`, `interrupt_*`, `keyword_*`) into `./review_frames/` and verify:
1. 🎯 **Audio-Visual Beat Sync** (subtitles, B-roll cutaways, and motion graphics hit on the exact spoken words)
2. 📐 **Safe Areas & In-Bounds Geometry** (subtitles at `bottom: 18%`, top cards at `top: 6-8%`, B-roll framed cleanly without covering subtitles)
3. 💎 **Professional Aesthetics** (glassmorphic motion cards, topic-aware B-roll visuals, PiP webcam framing)
4. 👤 **Subject Framing & Facial Clearance**
5. 🖼️ **High-CTR Thumbnail Quality**

---

### 7. Deliver

Deliver:
1. Final rendered MP4
2. High-CTR Thumbnail (`thumbnail.jpg` / `thumbnail.png`)
3. Summary report detailing:
   - Source vs output duration (cuts applied)
   - Matched native RetentionVolt reference video & creator formula
   - B-roll cutaways, PiP/demonstration shots, zoom animations, and motion graphics rendered

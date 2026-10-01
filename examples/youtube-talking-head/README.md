# YouTube Talking-Head Example

Classic creator talking-head: educational register (~5s cadence),
keyword caption pops, content-aware banners (act titles, numbers),
slow push-ins on act opens.

## Usage (via MCP tools)

```jsonc
// 1. ingest
{ "tool": "import_raw_media", "paths": ["./vlog-raw.mp4"] }
// 2. transcribe
{ "tool": "transcribe_media", "media_path": "./vlog-raw.mp4", "media_id": "<id>" }
// 3. analyze
{ "tool": "analyze_transcript", "transcript": "<transcript-json>", "sectionCount": 3 }
// 4. plan — style educational (default; legacy name youtube_talking_head still works)
{ "tool": "generate_edit_plan", "structure": "<structure-json>",
  "style": "educational", "takesCount": 1 }
// 5. render — draft first, high for delivery
{ "tool": "render_video", "edit_plan": "<plan-json>",
  "project_dir": "./out/vlog", "raw_video_path": "./vlog-raw.mp4",
  "preset": "draft" }
```

## Why these settings

- `style: educational` — ~5s interrupt cadence measured on real
  explainer videos; breathes, doesn't nag.
- `takesCount: 1` (default) — single-take gate: caption pops and
  banners only, no faked multi-cam energy. Pass your real take count;
  ≥2 unlocks show rhythm and punch zooms.
- Captions sit at bottom 18% (platform safe area), banners TOP —
  never overlapping, face always free.
- Always preview `draft` before spending time on a `high` render
  (preset slow + crf 15).

# YouTube Talking-Head Example

Classic creator talking-head: 25s interrupt cadence, IDEA CHIAVE captions
on highlights, zoom punch-ins on attention dips.

## Usage (via MCP tools)

```jsonc
// 1. ingest
{ "tool": "import_raw_media", "paths": ["./vlog-raw.mp4"] }
// 2. transcribe
{ "tool": "transcribe_media", "media_path": "./vlog-raw.mp4", "media_id": "<id>" }
// 3. analyze
{ "tool": "analyze_transcript", "transcript": "<transcript-json>", "sectionCount": 3 }
// 4. plan — style youtube_talking_head (default)
{ "tool": "generate_edit_plan", "structure": "<structure-json>",
  "style": "youtube_talking_head" }
// 5. render — draft first, high for delivery
{ "tool": "render_video", "edit_plan": "<plan-json>",
  "project_dir": "./out/vlog", "raw_video_path": "./vlog-raw.mp4",
  "preset": "draft" }
```

## Why these settings

- `style: youtube_talking_head` — 25s cadence matches YouTube retention
  curves for 8–15 min videos.
- Captions fire on the densest 20% of segments; zoom-ins land exactly on
  detected pauses ≥2.5s.
- Always preview `draft` before spending time on a `high` render.

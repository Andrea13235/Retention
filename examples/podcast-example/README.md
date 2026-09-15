# Podcast Example

Long-form conversation edit: 60s pattern-interrupt cadence, light captions,
b-roll on middle sections.

## Usage (via MCP tools)

```jsonc
// 1. ingest
{ "tool": "import_raw_media", "paths": ["./episode42-raw.mp4"] }
// 2. transcribe
{ "tool": "transcribe_media", "media_path": "./episode42-raw.mp4", "media_id": "<id>" }
// 3. analyze
{ "tool": "analyze_transcript", "transcript": "<transcript-json>", "sectionCount": 5 }
// 4. plan — style podcast
{ "tool": "generate_edit_plan", "structure": "<structure-json>", "style": "podcast",
  "brollSources": ["./broll/studio-wide.mp4", "./broll/guest-closeup.mp4"] }
// 5. render
{ "tool": "render_video", "edit_plan": "<plan-json>",
  "project_dir": "./out/episode42", "raw_video_path": "./episode42-raw.mp4",
  "preset": "standard" }
```

## Why these settings

- `sectionCount: 5` — podcast episodes have distinct topics; more sections
  keep chapter boundaries clean.
- `style: podcast` — 60s interrupt cadence: sparse enough not to annoy on
  a 60–90 min episode, frequent enough to reset attention.
- `preset: standard` for review, `high` for the published episode.

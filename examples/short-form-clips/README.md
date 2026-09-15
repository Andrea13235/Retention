# Short-Form Clips Example

Vertical reels/shorts/tiktoks cut from a long recording: 4s interrupt
cadence, caption pops, tight keep-only-highlights pacing.

## Usage (via MCP tools)

```jsonc
// 1-3. ingest → transcribe → analyze (same as other examples)
// 4. plan — style short_form
{ "tool": "generate_edit_plan", "structure": "<structure-json>",
  "style": "short_form", "interruptEverySec": 4 }
// 5. render — 1080x1920 vertical is set at build time by the agent
{ "tool": "render_video", "edit_plan": "<plan-json>",
  "project_dir": "./out/clip01", "raw_video_path": "./vlog-raw.mp4",
  "preset": "standard" }
```

## Why these settings

- `style: short_form` — a visual beat every ~4s (caption pop / punch)
  holds swipe-through attention on sub-60s clips.
- Tip: run `generate_edit_plan` once per highlight to get one clip per
  strong moment, then render each plan separately.

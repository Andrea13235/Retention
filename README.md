# andrea-video-skill

AI video editing skill: turn RAW footage into publish-ready video — transcription (Whisper, local), narrative analysis, edit plan, render (HyperFrames). No NLE required. Installable MCP server for Codex, Claude Code, and any MCP-compatible agent.

## Quickstart

**Prerequisites:** Node.js ≥ 22, FFmpeg in PATH, Python 3.9+ (for faster-whisper).

```bash
npm install
node scripts/setup-whisper.js  # dedicated venv + faster-whisper (one-time)
npm run setup-check   # verify environment
npm run build         # compile TypeScript
npm test              # run test suite
```

> You can skip `setup-whisper.js` if faster-whisper is already available in
> a reachable Python (or point `AVSKILL_PYTHON=/path/to/python` at your
> interpreter). Without working faster-whisper, `transcribe_media`
> fails with clear instructions.

## MCP wiring

Add to your MCP client config (`mcpServers`):

```json
{
  "mcpServers": {
    "andrea-video-skill": {
      "command": "/absolute/path/to/andrea-video-skill/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/andrea-video-skill/src/server.ts"]
    }
  }
}
```

Or after build, use the compiled entrypoint: `node /absolute/path/to/andrea-video-skill/dist/server.js`. Restart the client after editing its config.

## Pipeline

| Step | Tool | What it does |
|------|------|--------------|
| 1 | `import_raw_media` | Register RAW files, extract metadata via ffprobe |
| 2 | `transcribe_media` | Local Whisper transcription with word timecodes |
| 3 | `analyze_transcript` | Hook, sections, fillers, attention dips, highlights |
| 4 | `generate_edit_plan` | Machine-actionable Edit Plan v1.0 (cuts, animations, b-roll, interrupts) |
| 5 | `render_video` | HyperFrames composition → MP4 (draft/standard/high) |

See [`SKILL.md`](SKILL.md) for the full agent instructions, [`docs/analysis-guide.md`](docs/analysis-guide.md) for the analysis & planning guide, and [`examples/`](examples/) for ready-made style presets.

## Status

✅ Verified end-to-end: ingest → analyze → plan → HyperFrames project
(`lint` 0 errors) → real MP4 render (10s, 1080p, h264+aac). Test suite:
11/11 passing (`npm test`).

## How it works

- **Whisper** runs 100% locally (faster-whisper, MIT): no API costs, audio never leaves the machine. Model auto-selected by hardware (`large-v3` on GPU/Apple Silicon, `small` on CPU).
- **HyperFrames** (Apache 2.0) renders the edit plan as an HTML composition via headless Chrome + FFmpeg, up to 4K/HDR10.
- The skill ships **no** third-party source code — HyperFrames and Whisper are standard npm/pip dependencies. See CREDITS (coming) for attributions.

## Examples

- `examples/podcast-example/` — long-form conversation, 60s interrupt cadence
- `examples/youtube-talking-head/` — classic talking head, 25s cadence
- `examples/short-form-clips/` — vertical clips, 4s cadence

## License

Free for individuals and teams up to 3 people (even commercial) — paid Team
License for larger for-profit teams. See [LICENSE.md](LICENSE.md).
Third-party attributions in [CREDITS.md](CREDITS.md).

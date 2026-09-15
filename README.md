# 🎥 CutCraft — Professional Video Editor

[![License](https://img.shields.io/badge/License-Free%20up%20to%203%20people-green.svg)](LICENSE.md)
[![MCP Server](https://img.shields.io/badge/MCP-Server-8A63D2)](https://modelcontextprotocol.io)
[![HyperFrames](https://img.shields.io/badge/Built%20for-HyperFrames-00C2A8)](https://www.npmjs.com/package/hyperframes)
[![Whisper](https://img.shields.io/badge/Transcription-Whisper%20local-orange)](https://github.com/SYSTRAN/faster-whisper)
[![Star this repo](https://img.shields.io/github/stars/Andrea13235/cutcraft?style=social)](https://github.com/Andrea13235/cutcraft)

**An open-source AI agent skill + MCP server that turns RAW creator footage into a finished, edited video — transcription, smart cuts, captions, pattern interrupts, and render — from a single prompt.** You drop in a video, your agent (Claude Code, Codex, or any MCP client) edits it like a real editor would, and you get back a publish-ready MP4. No Premiere, no timeline, no manual keyframing.

> If you've ever stared at 40 minutes of RAW footage thinking "I'll edit this tomorrow" — this is the fix. **Shooting is never the bottleneck — editing is.** This skill encodes an editor's craft as deterministic tools plus an AI-guided **transcribe → analyze → plan → render** loop, so the agent finds the best moments, cuts the dead parts, and verifies its own output instead of shipping blind.

## 🎥 Demo — made with this skill

> Demo video coming soon — a real talking-head edit produced end-to-end by this skill (RAW in → finished MP4 out). The [`examples/`](examples/) presets (podcast, talking-head, short-form) already render from source today.

## 🤖 What is this? (TL;DR)

**cutcraft** is a free, open-source skill + [MCP server](https://modelcontextprotocol.io) for AI coding agents. You install it once, point your agent at a RAW video, and ask — in plain English — for an edited video. The agent transcribes the audio, finds hooks and highlights, cuts fillers, adds captions and zoom punches, and renders a finished MP4 using HyperFrames. It handles transcription, narrative analysis, edit planning, and rendering automatically.

## ❓ FAQ

**Can an AI really edit my videos?**
Yes. Out of the box an agent can only chat about video; with this skill it performs a real edit — word-accurate cuts from a transcript, captions on the densest moments, zoom-ins on attention dips, pattern interrupts on cadence — and verifies the render before delivering.

**Do I need Premiere or DaVinci?**
No. Everything runs as code via [HyperFrames](https://www.npmjs.com/package/hyperframes) (HTML + GSAP compositions rendered with headless Chrome + FFmpeg). No timeline software, no manual cutting. You describe the edit; the agent builds and renders it.

**Which agents work?**
Any MCP-compatible client: Claude Code, Codex, Claude Desktop, and others. The skill is model-agnostic — any agent that can call MCP tools can use it.

**Is it free?**
Free for individuals and teams up to 3 people, even commercial. Larger for-profit teams need a Team License — see [LICENSE.md](LICENSE.md). You only need free dependencies (HyperFrames, faster-whisper) plus your agent subscription/API access.

**What languages does it transcribe?**
~100, auto-detected. Italian, English, Spanish, French, German, Portuguese… just speak — Whisper detects the language and transcribes in it. Filler-cutting covers Italian + English out of the box.

**What can it make?**
Edited YouTube talking-heads, podcast episodes, vertical Reels/Shorts/TikToks cut from long recordings, captioned clips with zoom punch-ins, lower thirds on key quotes.

**How is this different from text-to-video models (Sora, Runway, etc.)?**
Those generate pixels and hallucinate. This edits *your real footage* — deterministic, timecode-exact cuts from your actual words, re-renderable forever. Your face, your voice, your content; the AI just does the cutting.

## 🆚 Manual editing vs. with this skill

| Without this skill | With cutcraft |
|---|---|
| Scrub 40 min of footage by hand | Whisper transcribes every word with timecodes |
| Guess where the boring parts are | Filler/pauses/dips detected deterministically |
| Cuts drift off the spoken words | Every cut references transcript timecodes |
| Static talking-head for minutes | Pattern interrupts on cadence + risk-point coverage |
| Captions typed and synced manually | Captions fire on the densest 20% automatically |
| Render, watch, fix, repeat alone | Agent loop: plan → draft render → review → final |

## 🧠 How it works

- **Whisper finds the best moments.** Local transcription (faster-whisper, MIT) turns speech into a word-accurate, timecoded transcript in ~100 languages — no API costs, audio never leaves the machine. Model auto-selected by hardware (`large-v3` on GPU/Apple Silicon, `small` on CPU).
- **Analysis decides what to keep.** Deterministic narrative analysis finds the hook, sections, fillers, attention dips, and highlights — verifiable timing, no hallucinations. An agent reading guide ([`docs/analysis-guide.md`](docs/analysis-guide.md)) adds editor craft: cut rules, the attention curve, and a technique catalog.
- **HyperFrames builds the edit.** The Action Plan becomes a standalone HTML + GSAP composition — mounted RAW footage, caption overlays, slow-zoom motion, lower thirds, zoom punches — rendered to MP4 via headless Chrome + FFmpeg, up to 4K/HDR10.
- The skill ships **no** third-party source code — HyperFrames and Whisper are standard npm/pip dependencies. Attributions in [CREDITS.md](CREDITS.md).

## 📦 What's inside

```
cutcraft/
├── SKILL.md                    # Agent workflow: 5-step pipeline, rules, pitfalls
├── docs/
│   └── analysis-guide.md       # Editor craft: cut rules, attention curve, EditPlan reference
├── src/
│   ├── server.ts               # MCP server (stdio): 5 tools
│   ├── tools_ingest.ts         # Step 1: RAW import + ffprobe metadata
│   ├── tools_transcribe.ts     # Step 2: local Whisper, word timecodes, language detect
│   ├── tools_analyze.ts        # Step 3: hook, sections, fillers, dips, highlights
│   ├── tools_plan.ts           # Step 4: Action Plan v1.0 (cuts, animations, interrupts)
│   └── tools_render.ts         # Step 5+6: HyperFrames composition → MP4
├── scripts/
│   ├── setup-whisper.js        # One-time: dedicated venv + faster-whisper
│   └── setup-check.js          # Verify the environment
├── tests/                      # 14/14 passing (pipeline + real-render e2e)
└── examples/                   # Style presets: podcast, talking-head, short-form
```

## 🚀 Install

**Prerequisites:** Node.js ≥ 22, FFmpeg in PATH, Python 3.9+ (for faster-whisper).

```bash
git clone https://github.com/Andrea13235/cutcraft.git
cd cutcraft
npm install
node scripts/setup-whisper.js  # dedicated venv + faster-whisper (one-time)
npm run setup-check             # verify environment (should print OK)
npm run build                   # compile TypeScript
npm test                        # run test suite (14/14)
```

**Wire it into your agent** — add to your MCP client config (`mcpServers`):

```json
{
  "mcpServers": {
    "cutcraft": {
      "command": "/absolute/path/to/cutcraft/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/cutcraft/src/server.ts"]
    }
  }
}
```

Or after build, use the compiled entrypoint: `node /absolute/path/to/cutcraft/dist/server.js`. Restart the client after editing its config.

**Verify it worked:** ask your agent *"what tools does cutcraft expose?"*. It should list `import_raw_media`, `transcribe_media`, `analyze_transcript`, `generate_edit_plan`, `render_video`. Then hand it a video and say *"edit this"*.

**Update later:** run `git pull` in your clone, then `npm install && npm run build`.

## 🎯 Usage

Just talk to your agent normally — the skill drives the pipeline:

- *"Edit this vlog RAW into a YouTube video, talking-head style"*
- *"Transcribe my podcast episode and cut the fillers"*
- *"Make vertical shorts from this recording, one per highlight"*
- *"Add captions and zoom punch-ins to this clip"*

The agent reads the skill, transcribes with Whisper, analyzes the narrative, builds the Action Plan, renders a `draft` for review, and only then renders `high` for delivery.

## 📐 The pipeline (short version)

| Step | Tool | What it does |
|------|------|--------------|
| 1 | `import_raw_media` | Register RAW files, extract metadata via ffprobe |
| 2 | `transcribe_media` | Local Whisper transcription with word timecodes (~100 languages) |
| 3 | `analyze_transcript` | Hook, sections, fillers, attention dips, highlights |
| 4 | `generate_edit_plan` | Machine-actionable Edit Plan v1.0 (cuts, animations, b-roll, interrupts) |
| 5 | `render_video` | HyperFrames composition → MP4 (draft/standard/high) |

Every stage's output feeds the next; never skip a stage or invent timestamps by hand. Full agent instructions in [`SKILL.md`](SKILL.md), editor craft in [`docs/analysis-guide.md`](docs/analysis-guide.md).

## ✅ Status

Verified end-to-end: ingest → transcribe (real Italian audio) → analyze → plan → HyperFrames project (`lint` 0 errors, 0 warnings) → real MP4 render (h264+aac). Test suite: 14/14 passing (`npm test`).

## 💡 Examples

- `examples/podcast-example/` — long-form conversation, 60s interrupt cadence
- `examples/youtube-talking-head/` — classic talking head, 25s cadence
- `examples/short-form-clips/` — vertical clips, 4s cadence

## ⭐ Star this repo

If this saved you from another night of manual cutting, **[star it](https://github.com/Andrea13235/cutcraft)** — it helps other creators find it.

## 📄 License

Free for individuals and teams up to 3 people (even commercial) — paid Team License for larger for-profit teams. See [LICENSE.md](LICENSE.md). Third-party attributions in [CREDITS.md](CREDITS.md).

---

Made by [Andrea Barretta](https://github.com/Andrea13235) · Sole author of cutcraft

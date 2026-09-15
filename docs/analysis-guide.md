# Analysis & Action Plan Guide

> Read this guide during **transcript analysis** and **Action Plan generation**,
> before handing the plan to the render engine (HyperFrames). It defines the
> rules for deciding where to cut, which animations to insert, and how to keep
> viewer attention high.
>
> Pipeline context: this guide covers Steps 3–4 of the skill
> (`analyze_transcript` → `generate_edit_plan`). The JSON contract below
> matches `EditPlan` in `src/types.ts` exactly — only the fields documented
> here reach the renderer.

## 1. Goal of this phase

Turn a timecoded transcript (produced by Whisper) into a structured
**Action Plan** that:

1. Removes dead parts (fillers, repetitions, excessive pauses).
2. Identifies the content's strong moments (hook, key points, twists).
3. Schedules visual interventions against the natural decay of viewer attention.
4. Expresses every intervention as an instruction the HyperFrames render tools understand.

## 2. Available analysis inputs

- **Timecoded transcript** (Whisper): text split into segments/words with `start`/`end`.
  `Transcript.language` holds the auto-detected BCP-47 code (e.g. `"it"`, `"en"`) —
  filler detection covers Italian + English out of the box; timing-based
  signals (pauses, density, hook position) work in any language.
- **Video metadata**: total duration, resolution, fps, audio stream count.
- **Style preferences** (optional, from the user): tone (professional/casual),
  desired pace, target format — one of `youtube_talking_head`, `podcast`, `short_form`.

## 3. Cut rules

Apply these rules in order, marking every cut with a `reason` in the final JSON:

| Rule | When to apply | Action |
|---|---|---|
| Verbal fillers | Runs of "ehm", "uhm", "like", "you know", immediate repetitions of the same sentence | Cut the segment, join the edges |
| Long pause | Silence > 1.5 s with no relevant visual content | Cut or compress to 0.3–0.5 s |
| Digression | Block disconnected from the main topic that never pays off | Consider removal or move to the end as bonus |
| False start | The speaker restarts a sentence from scratch | Keep only the final take |
| Opening hook | First 3–15 seconds | Never cut impactful opening seconds; if missing, flag it in `structure_notes` and propose moving a strong moment up front (cold open) |

**Never cut** moments containing: cited numbers/statistics, promises made to
the viewer ("in this video we'll see…"), calls to action, twists or reveals.

## 3b. Cut candidates (deterministic, word-level)

`analyze_transcript` emits `cut_candidates` — the actual "taglia qui"
decisions — from Whisper word timestamps. Every candidate carries a
`confidence` (0..1 = planner trust):

| Kind | Signal | Confidence | Example |
|---|---|---|---|
| `trim_head` / `trim_tail` | silence ≥0.3s / ≥0.5s at the edges | 0.99 (always cut) | cold mic, lingering outro |
| `dead_air` ≥2s | long void mid-speech | 0.95 (blank mind) | lost train of thought |
| `dead_air` 1.2–2s | medium gap | 0.8 (applied, verify) | dramatic pause? |
| `dead_air` <1.2s | short gap | 0.6 (applied, verify) | rhetorical breath? |
| `stutter` | immediate same-word repeat | 0.9 | "sul sul tuo" → keep last |
| `filler` | run of ≥2 consecutive fillers | 0.85 | "ehm allora", "cioè ecco" |
| `false_start` | aborted burst (≤3 words) + restart | 0.7 (anaphora?) | "io… io dico" may be deliberate |

The planner's confidence gate: ≥0.85 auto-applied; 0.5–0.85 applied
but listed in `review_cuts` for a rhetoric check; <0.5 skipped and
listed as a proposal. **Never render before reading `review_cuts`** —
a short pause may be deliberate drama, a "false start" may be
anaphora. Promote skipped cuts via `extraCuts` or leave them kept.

## 3c. `needs_review`: the first-take safety net (READ THIS)

Whisper-small mangles exactly the words that matter most on screen:
brand names, proper nouns, neologisms ("rawcat" for CutCraft, "cloud"
for Claude). `analyze_transcript` flags them in `needs_review` —
rare tokens (seen once) that are long, emphasized, or hesitantly
delivered — each with sentence context.

**Mandatory workflow (first take right):**

1. Run `analyze_transcript` WITHOUT corrections.
2. Read `needs_review`. Confirm EVERY flagged word — with the user,
   or from obvious context (the project name, the speaker's product).
3. Re-run `analyze_transcript` WITH `corrections: [{misheard, correct}]`.
4. Only then `generate_edit_plan`.

If you skip this, the raw ASR text burns into the karaoke captions
verbatim and the video ships with "rawcat" on screen. Frequent words
are never flagged (the model gets common speech right); if
`needs_review` has >10 entries the transcript is noise — re-transcribe
with a bigger model instead of correcting one by one.

Guardrails: the first 3s of media are never cut (cold open is sacred);
ASR-artifact words (>2s on a single word — small-model jitter, not real
hesitation) never become cuts; overlaps merge. `generate_edit_plan`
inverts the candidates into a KEEP splice — what is not CUT is content.

Two invisibility guarantees (enforced by construction, not by taste):

- **One caption at a time.** Karaoke card durations are computed from
  the next card's start (minus a 0.08s breath gap), clamped to 1–4s
  short-form / 1–8s long-form. Cards can never overlap even across
  splice points — whichever clock the render uses.
- **Hard cuts for cleanup.** Stutter, dead-air, filler, false-start and
  trim cuts are NET splices — no animation lands on them. A zoom on a
  cleanup resume would tell the viewer "something was hidden here".
  Motion lives ONLY on genuine scene changes: `slow_zoom` opens a new
  act (section boundary), `zoom_punch` fires solely for explicit agent
  `attentionRiskPoints` or section boundaries. No zoom, slow-zoom or
  interrupt may fire in the 0.8s before a CUT or inside one — a punch
  on the seam would spotlight it.
The agent reviews `cut_candidates` and adds `extraCuts` for false starts
and rhetoric the heuristics can't judge (see `review_cuts` in the plan —
mandatory pre-render read).

## 4. Mapping the attention curve

Before writing the plan, estimate the attention curve along the video:

- Any **block with no visual or narrative change for 20–30+ seconds** is an attention-drop risk.
- Every **topic change** is a natural slot for a visual intervention (new section).
- Every **high-information-density moment** (numbers, definitions, technical concepts) is a candidate for on-screen support (text, graphic).

Record these blocks as `attention_risk_points` (on the structure or as the
`attentionRiskPoints` param of `generate_edit_plan`). The planner adds one
dedicated pattern interrupt at each risk point's midpoint — **every risk
point gets coverage** (see the final checklist).

## 5. Anti-drop technique catalog

Choose techniques based on context — not all at once, only where the
attention curve demands them.

### 5.1 Periodic pattern interrupts
- **Slow zoom (in/out)**: during continuous speech blocks with no other cuts, keeps motion without distracting. Recommended: 2–5 % scale per second (`slow_zoom` with `intensity: 3`, `direction: "in"`).
- **Micro jump-cut**: near-invisible cut every 8–12 s to break stillness, especially on fixed talking-head shots. Expressed via the `cuts` list (tight KEEP segments), not as an animation.
- **Simulated shot change**: with a single camera, alternate gentle zoom + slight pan (a `slow_zoom` in, then a `slow_zoom` out) to fake a framing change.

### 5.2 Visual content reinforcement
- **Keyword text overlay**: when the speaker says a key concept, number, or important name, overlay the text for 2–4 s (`text_overlay` / `caption` with `duration`).
- **Explanatory graphic / lower third**: for data, stats, lists — a synced graphic box (`lower_third`, bottom position).
- **Contextual emoji/icon**: for casual content, a small animated-feel glyph next to the text to reinforce tone (as `text_overlay` content).

### 5.3 Rhythm breaks (every 60–90 s)
- **B-roll**: if extra footage is available, insert a 3–6 s insert illustrating the point (`broll` entry with `reason`).
- **Framing scale change**: punch in/out for variety even without b-roll (`zoom_in` / `zoom_out`).
- **Light sound design**: not rendered by the skill (the composition carries video + RAW audio only) — note it in `structure_notes` for the final mix.

### 5.4 Narrative structure
- **Hook in the first 3–8 s**: if the video opens weakly, propose a cold open (move a highlight moment to the front) via `structure_notes`.
- **Section cliffhanger**: before a topic change, keep a hanging question when possible ("in a minute I'll show you why this changes everything").
- **Visual recap**: for long videos (>8 min), add a mid-point text summary to re-engage drifted viewers (`text_overlay` chain).

### 5.5 Short-form pace (Shorts/Reels, <60 s)
- A cut every 2–4 s max.
- Near-constant text overlays (continuous narrative drive, not just keywords).
- Zoom or scale change on every cut — never static for more than 3 s.

## 6. Technique intensity by content type

| Content type | Pattern-interrupt cadence | Overlay style | B-roll |
|---|---|---|---|
| Podcast / long interviews | Low (every 15–20 s) | Only on key quotes/numbers | If available, every 2–3 min |
| Tutorial / educational | Medium (every 10–15 s) | Frequent on technical terms | Screenshots/demo when relevant |
| YouTube talking-head (vlog, commentary) | Medium-high (every 8–10 s) | On keywords and emotions | Every 60–90 s |
| Shorts/Reels/TikTok | Very high (every 2–4 s) | Constant | If available, near every cut |

## 7. Output format: Action Plan JSON (EditPlan v1.2)

Every intervention must be written in this format — field for field what
`buildHyperframesProject` consumes. Unknown fields are ignored by the
renderer, so stick to this contract.

```json
{
  "version": "1.2",
  "style": "youtube_talking_head",
  "format": "long",
  "media_id": "<media_id from import_raw_media>",
  "cuts": [
    {"start": "00:00:00.000", "end": "00:00:15.500", "reason": "opening hook (trimmed)"},
    {"start": "00:00:15.500", "end": "00:00:22.000", "reason": "Section 1"},
    {"start": "00:01:05.000", "end": "00:01:07.200", "reason": "CUT — dead_air: silence of 2.2s mid-speech"}
  ],
  "animations": [
    {
      "time": "00:00:08.000",
      "type": "caption",
      "content": "KEY INSIGHT",
      "position": "bottom",
      "duration": 3
    },
    {
      "time": "00:00:20.000",
      "type": "slow_zoom",
      "target": "face",
      "direction": "in",
      "intensity": 3,
      "duration": 8
    },
    {
      "time": "00:01:45.000",
      "type": "zoom_in",
      "target": "face"
    },
    {
      "time": "00:04:00.000",
      "type": "lower_third",
      "content": "Dr. Rossi — Data scientist",
      "position": "bottom",
      "duration": 5
    }
  ],
  "broll": [
    {"start": "00:04:00.000", "end": "00:04:06.000", "source": "library/screenshot_01.png", "reason": "visual reinforcement of cited statistic"}
  ],
  "pattern_interrupts": [
    {"time": "00:00:25.000", "kind": "zoom_punch", "detail": "interrupt every ~25s"},
    {"time": "00:01:55.000", "kind": "zoom_punch", "detail": "risk-point coverage: 30s static block"}
  ],
  "structure_notes": [
    {"time": "00:00:00.000", "note": "hook missing: consider cold open with moment at 00:03:12"}
  ]
}
```

Field notes:

- `cuts` is a real splice: KEEP ranges (sorted, non-overlapping,
  edge-to-edge) form the output timeline; entries prefixed `CUT —` are
  excluded from the render but kept in the record. The renderer plays
  each KEEP via `data-media-start` and remaps every animation from
  source clock to timeline clock — animations inside CUT ranges are
  dropped, and the output duration is the KEEP sum (shorter than source).
- `format` selects the canvas: `short` → 1080×1920 (9:16),
  `long` → 1920×1080 (16:9). Never render a portrait source as landscape.
- `animations[].type` must be one of: `text_overlay` | `caption` | `karaoke_caption` | `lower_third` | `zoom_in` | `zoom_out` | `slow_zoom` | `transition`. Anything else renders nothing.
- `karaoke_caption.words[]` carry SOURCE timecodes; only kept words
  reach the screen (CUT words are dropped and the rest remapped).
  `emphasis: true` words render as keyword pops.
- `duration` applies to `text_overlay`/`caption`/`lower_third` (0.5–15 s, default 3) and to `slow_zoom` (1–30 s, default 8).
- `broll[].source` is a path to an existing media file; `reason` is advisory.
- `pattern_interrupts[].kind` is advisory (`zoom_punch` / `caption_pop`); placement is what matters.
- `structure_notes` never renders — it is agent-to-human communication.

## 8. Honest mapping: plan → renderer

What the renderer (`buildHyperframesProject` + `hyperframes render`) actually
does with each entry — no more, no less:

| Plan entry | What renders |
|---|---|
| KEEP `cuts` | One `<video>` per KEEP range (`data-start` + `data-duration` on the timeline clock, `data-media-start` on the source clock) — true splice, no gaps; or `CLIP n` placeholder cards when no RAW is mounted |
| `CUT —` cuts | Excluded from the composition AND from duration; every animation inside a CUT range is dropped; the output is shorter than the source |
| `text_overlay` / `caption` | Timed overlay div (fade via timeline), `duration` seconds, top/center/bottom |
| `lower_third` | Left-aligned overlay with accent bar, bottom position |
| `slow_zoom` | Progressive GSAP scale on the active clip (`intensity` %/s for `duration` s) |
| `zoom_in` / `zoom_out` | Quick punch zoom on the active clip (0.25 s in-and-back) |
| `pattern_interrupts` | Subtle scale pulse on a full-frame layer at `time` |
| `transition` | No standalone effect — jump cuts between KEEP clips already provide it |
| `broll` entries | **Listed in the plan but not composited yet** — the renderer mounts a single RAW; multi-source b-roll overlay is on the roadmap |
| `structure_notes` | Never rendered — notes for the human/agent review |

> Current limits to keep in mind: single-RAW compositions (one `raw_video_path`),
> video + RAW audio only (no mixed sound design), overlays are HTML/CSS text
> (no generated charts or emoji sprites). Plan within these bounds — everything
> above is guaranteed to render.

## 9. Final checklist before delivering the plan

- [ ] Every cut has an explicit `reason` (no random cuts).
- [ ] No hook, number, promise, or CTA was cut by mistake.
- [ ] Every `attention_risk_point` has an associated interrupt (the planner adds midpoint coverage automatically — verify it is present in `pattern_interrupts`).
- [ ] Technique frequency matches the target format (see Section 6).
- [ ] Timecodes are `HH:MM:SS.mmm` everywhere, within media bounds, no zero-length segments.
- [ ] The plan is valid JSON with `version: "1.2"`, `format`, and `media_id`, ready for `render_video`.

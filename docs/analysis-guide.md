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

- **Target format (Step 0 — decided BEFORE ingest):** short (9:16,
  `short_form`) or long (16:9, `youtube_talking_head` / `podcast`).
  Explicit user request wins ("creami il mio short" → short, no
  questions); otherwise the agent asked short-vs-long first and got a
  confirmed answer. Every rule below reads differently per format —
  never plan without it.
- **Timecoded transcript** (Whisper): text split into segments/words with start/end timing.
  `Transcript.language` holds the auto-detected BCP-47 code (e.g. `"it"`, `"en"`) —
  filler detection covers Italian + English out of the box; timing-based
  signals (pauses, density, hook position) work in any language.
- **Video metadata**: total duration, resolution, fps, audio stream count,
  plus orientation (is_portrait / display dimensions post-rotation).
  If the footage orientation contradicts the Step-0 format (portrait
  RAW + long request, or landscape RAW + short request), STOP and
  confirm with the user (crop/reframe vs switching format) — never
  silently render the wrong canvas.
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

## 3d. CUTS FIRST: never motion near a cut (READ THIS)

A cut on a zoomed frame is a visible scale jump — the two sides of a
splice meeting at different magnifications. So the strategy is fixed:
**finalize the KEEP splice FIRST, place motion only AFTER, and keep
every zoom's FULL span clear of every CUT edge on BOTH sides:**

- 0.8s BEFORE a CUT starts (pre-cut mask): nothing may start there —
  a punch on the last pre-cut frame spotlights the seam.
- 2.0s AFTER a CUT ends (post-cut settle): nothing may start there —
  the resume must play clean before any scale change.
- NO CROSSING: a zoom span may never contain a CUT inside it — a
  slow_zoom running across a splice lands on the next clip at the
  wrong scale.

One definition, two enforcers (`src/types.ts` `motionSpanAllowed`):
the planner relocates (nearest CUT-clear second within ±6s), clamps a
slow_zoom that overruns the next CUT, or skips with a
`structure_notes` entry — never silent. The renderer rejects any
hand-written plan that violates the rule, with the exact fix in the
error message.

## 3c. `needs_review`: the first-take safety net (READ THIS)

Whisper-small mangles exactly the words that matter most on screen:
brand names, proper nouns, neologisms ("rawcat" for RetentionVolt, "cloud"
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
- **Breathe rule (beingmayy MG-013)**: NO graphic/banner/card hold over 3s may sit static — every long hold gets a breathe loop (scale, glow, or shadow pulse ≤8% amplitude, ease in-out). The reference holds an icon ~9s and survives ONLY because it pulses. The planner covers each >3s hold with a `pattern_interrupts` pulse at its midpoint; the renderer implements it as a subtle scale loop. Static holds >3s with zero motion read as frozen frames, not minimalism.

### 5.5 Short-form pace (Shorts/Reels, <60 s)
- A cut every 2–4 s max.
- Near-constant text overlays (continuous narrative drive, not just keywords).
- Zoom or scale change on every cut — never static for more than 3 s.

## 6. Rhythm registers by content type (measured 2026-09-15)

One table, one truth — the planner reads `REGISTER_CADENCE`
(`src/types.ts`), which mirrors these numbers. Pick the register by
content energy AND by `structure.speech.wpm`, not by gut feeling:

| Content type | Style | Cadence | wpm | Overlay style | B-roll |
|---|---|---|---|---|---|
| High-energy show (MrBeast-grade) | `show` | ~2s | ~182 | Context labels only (DAY counters, place tags) | Constant — the cut IS the energy |
| Explainer / talking-head / product | `educational` | ~5s | ~174–188 | Keyword banners, numbers, act titles | Every 60–90s |
| Screen-led tutorial | `tutorial` | ~20s | ~257 (!) | Headlines + product mockups (the screen carries it) | The screen IS the b-roll |
| Podcast / long interviews | `podcast` | ~60s | conversational | Only on key quotes/numbers | If available, every 2–3 min |
| Shorts/Reels/TikTok | `short_form` | ~4s | dense | Near-constant captions, caption pops | If available, near every cut |

Reference measurements (6 videos, frame-by-frame):
MrBeast "100 Days in a Circle" 16:51 — 479 cuts (28/min, median shot
1.4s), 182 wpm, zero push-ins, zero karaoke, graphics = cartoon
context labels (DAY 4, MIDDLE OF NOWHERE, countdown) lasting ~5–8s.
Higgsfield educational 7:21 — 99 cuts (~13/min, median ~4–5s),
188 wpm, graphics = section hooks ("3 STEPS") + full-screen number
formulas ("100,000 VIEWS = $3,000/MONTH"). Higgsfield
motion-graphics 13:50 — 124 cuts (~9/min), 174 wpm, talking-head
base that never leaves + full-screen typo cards (2–3s, cream +
pastel, payoff in black) + product PiP top-left. Nate Herk tutorial
29:57 — ~38 scene changes (locked-off PiP face, the IDE carries it),
257 wpm, longest pause in 30min = 2.0s, zero push-ins, captions only
on product A-rolls. beingmayy Apple-style motion 0:50 (1024×576
16:9, 30fps) — 11 hard cuts (~13/min, median hold ~2.4s), 206 wpm,
zero gaps >0.4s, FULLY SYNTHETIC (no camera): fast typo cards
0–11.7s (bold grotesque lowercase, coral #E94E5A on off-white,
center-anchored, one phrase per card) → one 17.2s continuous
animated 3D grid world (orthographic grid, 2–3 props, hammer +
drawn bridge; NO hard cut, props swap inside the world) →
fast cards 28.9–46s (mock YouTube player, mock IG profile,
real Apple-YouTube UI ≤3s as evidence, photo card flash ~1.5s,
icon isolate ~9s) → glitch brand outro 46–50.5s (RGB-split reserved
for this ONE beat). Higgsfield kinetic promo 0:33.6 "What if you
could create an entire ad" (VID-06, 1020×576 16:9, 30fps) —
FULLY SYNTHETIC, no cuts to make: 13 spoken phrases → ~13 cards,
71 words EN, ~182 wpm over voiced spans, speech 0–29.44s + dark
logo outro 29.44–33.62s. Luminance map (YAVG @2fps): LIGHT
0–5.5s (hook kinetic type) → DARK 6–20s (product demos) →
LIGHT 20.5–30s (capability cards) → DARK outro. Full recipe in
§6c — read it whenever there is no RAW to cut.

Three lessons that became rules:
1. **The slow push-in appears in NONE of the six.** It is OUR tool
   for static talking-heads the references never needed — use with
   restraint (act opens), never as default motion.
2. **Graphics are always functional**: context (where/when),
   proof (numbers), structure (act titles) — never decoration of
   the spoken word. Every `GraphicBeat` title is transcript-verbatim
   for exactly this reason.
3. **Cadence is not energy (beingmayy lesson).** The Apple-style
   piece runs at show-grade speed (~2.4s median) with zero show
   energy. What keeps it clean: ONE accent color per scene (coral
   OR pink, never both), ONE idea per frame (70–95% negative
   space), mocked-not-screenshotted platform UI (redraw in flat
   vector; real screen footage only for ≤3s evidence beats), and
   206 wpm narration with zero dead air carrying the cuts —
   visuals change UNDER continuous speech, never the reverse.

## 6b. Footage gate: adapt to what you hold (READ THIS)

The register says the RHYTHM. The footage says what is LEGAL.
`takesCount` (default 1) decides `FootageMode`:

- **single_take (1 take): ONE continuous recording.** There is no
  second angle, no coverage, no B-roll — so the plan MUST NOT fake
  any: no shot-change transitions, no multi-cam rhythm, no
  `zoom_punch` (punching every 2s on the same frame reads as a
  glitch, not energy). Legal: cleanup hard cuts, caption pops,
  graphic banners, slow push-ins on act opens. A `show` request is
  downgraded to `educational` WITH a `structure_notes` entry — the
  agent reads WHY, never silent.
- **multi_take (≥2 takes): real coverage exists.** The agent can cut
  between takes, so `show` rhythm (~2s) and `zoom_punch` on agent
  risk points / scene changes are legal.

MrBeast publishes show rhythm because he SHOOTS show coverage
(10 takes, B-roll, crew) — the rhythm follows the material, never
the reverse. Never promise what the footage cannot deliver.

## 6c. Kinetic promo: when there is NOTHING to cut (VID-06 recipe)

**When this applies.** The user asks for a promo/trailer/ad for a
product — and hands you NO footage to cut (no RAW, or a single
still). There are no `cut_candidates`, no attention dips, no wpm
to measure against §6: the video is 100% graphics timed to a
voiceover/TTS script. Do NOT force the §3–§5 pipeline onto this —
no fake dead-air cuts, no talking-head karaoke, no lower-thirds.
Build it beat by beat from the STRUCTURE below, then map each beat
to a plan field EXACTLY as §6c.5 says. (Current renderer limits:
single-RAW compositions with HTML/CSS overlays — a VID-06 clone
needs HyperFrames blocks/components, see §6c.6. Plan the cards,
the copy, and the timing NOW; they survive any renderer.)

**Source numbers (all measured, none guessed).** VID-06 = TikTok
SaaS promo "What if you could create an entire ad without filming
anything?" for Higgsfield: 1020×576 16:9, 30fps, 33.62s,
1020×576@30fps H.264. Audio: EN voiceover, 13 phrases, 71 words,
speech 0–29.44s then music-only dark logo outro 29.44–33.62s
(~4.2s). Pace: ~182 wpm over voiced spans — educational/show
grade, but with ZERO dead air (phrase gaps 0.6–0.9s, the voice
never rambles, so carry the energy with card swaps, not cuts).
Scene detection finds NO hard cuts to make (the whole piece is
continuous motion inside cards — the only measurable signal is
luminance: YAVG @2fps alternates LIGHT↔DARK↔LIGHT↔DARK). Beat map
from the real transcript (faster-whisper small, EN 0.993):

| # | Speech (verbatim) | sec | Card |
|---|---|---|---|
| 1 | What if you could create an entire ad | 0.00–2.08 | LIGHT kinetic hook (black/gray words, lime blobs) |
| 2 | without filming anything? | 2.08–3.40 | LIGHT payoff (`Anything` lime, zoom) |
| 3 | That's one of the things Higgs Field can do. | 4.24–6.22 | TRANSITION (lime-circle wipe → dark) |
| 4 | Upload a product and turn it | 6.88–8.64 | DARK prompt card (glass, lime glow) |
| 5 | into a professional looking advertisement. | 8.64–10.56 | DARK resize gesture (cursor + `editor` pill) |
| 6 | Need a spokesperson? | 11.32–12.12 | DARK avatar grid (3×3, `editor` badge) |
| 7 | Create an AI character. | 12.94–14.24 | GLASS typewriter band (prompt typing) |
| 8 | Need them to talk? | 14.88–15.66 | LIGHT capability pile (photo cluster) |
| 9 | Add dialogue and generate the video. | 16.20–18.24 | DARK AE screen (proof of workflow) |
| 10 | You can also transform images, | 18.96–20.86 | LIGHT `Images` card (collage + lime aura) |
| 11 | create different visual styles | 21.42–22.92 | LIGHT style list (pill header + 5 rows) |
| 12 | and generate content for social media. | 23.44–25.32 | LIGHT platform card + giant glossy icons |
| 13 | Editors, grab the After Effects project file on | 25.32–29.44 | LIGHT CTA (bicolor line + folder icon) |
| — | (music only) | 29.44–33.62 | DARK logo outro (dot-grid + lime lockup) |

One spoken phrase = one card = one idea on screen. Card swaps
land ON the phrase boundary (±0.15s), never mid-phrase.

### 6c.1 The luminance heartbeat (mandatory alternation)

The video breathes LIGHT↔DARK↔LIGHT↔DARK across 33s — that
alternation IS the retention mechanic (each swap re-grabs the eye
without a single hard cut). Rule: **alternate luminance at HALF
level — never place two LIGHT halves or two DARK halves back to
back.** Inside a half, cards share the family luminance for
several cards in a row (that is the measured data, not a
violation: hook = 2 LIGHT cards, demos = 3 DARK cards,
capabilities = 4 LIGHT cards). Sequence from the measurement:
LIGHT hook (0–5.5s) → DARK demos (6–20s) → LIGHT capabilities
(20.5–30s) → DARK outro (29.44–33.62s). The DARK→LIGHT return at
~20.5s (`You can also transform images`) is the mid-video wake-up
— plan it as a deliberate beat, not a palette accident. Inside
each half, cards change but the luminance family holds for
several cards in a row (DARK runs ~14s, second LIGHT ~9s).

### 6c.2 Palette discipline (measured hex, one accent per card)

- Base LIGHT: off-white `#F5F6F4`–`#F8F8F8`, never pure `#FFFFFF`
  (flat white reads cheap on phone screens).
- Base DARK: near-black `#0A0F14`–`#0A0A0A` + dot-grid texture
  (tiny pale dots) + lime aurora glow low in frame.
- THE accent: lime/chartreuse `#A6E000`–`#C6FF00` (blobs, glows,
  pills, cursor, logo disc). Second accent ONLY for small UI
  truth: folder blue `#2D9DD1` on `#0E4E73`, social red/gradient
  on the platform card. Never two accents on one card.
- Type on LIGHT: black `#000000` for spoken words; lime ONLY for
  the single payoff word per card (`Anything`, `Grab the`) or the
  pill header. Type on DARK: white `#FFFFFF` on glass.
- Reserve RGB-split/glitch for the outro-adjacent brand beat at
  most (same "one loud beat" rule as §6 lesson 3) — VID-06 itself
  stays clean to the end; the logo lockup carries the close.

### 6c.3 Typography (three sizes, never mixed on one card)

1. **Kinetic statement** (hook + payoffs): extrabold rounded
   grotesque (Poppins Bold / Montserrat ExtraBold), lowercase
   except the payoff capital (`Anyth…`), 2–5 words per card,
   center-anchored, cropped by frame edges at peak zoom.
2. **UI voice** (demo cards): ALL-CAPS bold condensed white for
   the prompt headline (`CLIFFSY, WHAT ARE WE CREA…`), regular
   small white for the typed prompt body, tiny lowercase white
   in the `editor` pill.
3. **List voice** (capability cards): black bold left-aligned
   rows (`Retro / Cyberpunk / Brutalist / Anime / Hyper
   realism`), pill header + left accent bar in lime.
One card = one voice. Never kinetic type over a UI mockup.

### 6c.4 The five beats (build in this order, drop none)

1. **Kinetic hook (0–3.4s, LIGHT).** Two cards: Q-line
   (`What if you…`) with per-word fade-in (spoken word lights at
   100%, upcoming words wait at ~40% gray) over drifting lime
   blobs — then payoff word (`Anything`) zooming toward camera.
   No people, no UI: type + color only.
2. **Iris transition (~4.2–6.2s).** Full-bleed lime circle
   expands to cover the frame (ghost of the hook text visible
   mid-wipe = cross-dissolve, NOT a hard cut), black doodle
   stroke rides it, lands on DARK. Budget 0.3–0.6s — it is a
   blink, not a scene.
3. **DARK demo run (6–20s).** THREE mock-UI cards, each a
   redrawn (never screenshotted) interface: prompt card with
   glass border + lime glow → gesture card (oversized cursor
   drags a resize handle, `editor` pill labels it) → avatar grid
   (3×3, `editor` badge breaks the grid = the eye magnet).
   Cursor does ONE action per card (click / drag / select).
4. **LIGHT capability run (20.5–30s).** THREE–FOUR white cards
   proving breadth: photo pile (`Images`, collage + lime aura) →
   style list (pill header + 5 rows + accent bar) → platform
   card (giant glossy 3D social icons) → CTA (`Editors` black +
   `Grab the…` lime + folder icon entering cropped from below).
   Card depth: ONE tilt (MG-006 grammar, 2–3°), ONE glow, ONE
   sparkle max — 70–95% negative space always.
5. **DARK logo outro (last ~4s).** Speech ENDS, music carries:
   dot-grid black + lime circle-disc lockup, center, hold still.
   Nothing moves except a breathe pulse (MG-013 rule ≤8%).

### 6c.5 Plan mapping (field-by-field, no new fields)

- Each BANNER card (hook, capability header, payoff, CTA) = one
  `graphics[]` beat (`act_title` for hook/capability headers,
  `number_stat` for any spoken number, `highlight` for the payoff
  word, `quote` for the CTA replay) with `time` = phrase start,
  `duration` = phrase length. Text transcript-verbatim.
- Each MOCK-UI card (prompt card, gesture, avatar grid, typewriter
  band, screen proof) = one `structure_notes` entry with timestamp
  + the UI to build + the spoken line for timing — NEVER a
  `graphics[]` beat (banner text is transcript-verbatim; interface
  copy is built in HyperFrames, see §6c.6). No card gets both.
- Card swaps = `pattern_interrupts` (`caption_pop`) at each phrase
  boundary — NOT `cuts` (there is no footage to splice; `cuts`
  stays a single KEEP `[0, mediaEnd]`).
- The iris wipe (§6c.4 beat 2) gets NO plan entry of its own: it
  lives inside a speech gap (or overlapping the bridge phrase),
  and the two `caption_pop` swaps bracketing it already mark the
  handoff. Gaps ≤1.0s between phrases are delivery pauses, NOT
  `dead_air` cuts.
- The music-only outro gets NO `graphics[]` beat (no phrase, no
  verbatim text): `cuts` KEEP simply extends through it
  (`[0, mediaEnd]` with mediaEnd = end of music), and ONE
  `structure_notes` entry records the lockup ("logo outro,
  dot-grid black + lime disc, breathe pulse only").
- `cuts` KEEP anchoring without RAW: `mediaEnd` = the voiceover
  script length (TTS/VO duration) + outro hold (~4s). The single
  KEEP is `[00:00:00.000, mediaEnd]` — never invent a media id.
- `duration` precedence: for promos §6c.5 WINS over the
  `GraphicBeat` comment defaults (act 2.5 / number 3.5 /
  highlight 3 / quote 4) — `duration` = the spoken phrase length,
  always. The comment values apply to talking-head banners only.
- Per-word light-up inside the hook = `karaoke_caption` words with
  `emphasis: true` on the payoff word (renderer already fades
  40%→100% + keyword pop — same mechanic, keynote styling).
- Cursor click/drag/typewriter moments = `structure_notes`
  (renderer mounts a single RAW; the gesture is built in
  HyperFrames, not in this plan — note the timestamp + action so
  the build step places it). This INCLUDES the iris wipe beat and
  every mock-UI card from §6c.4 beat 3 — merged into the same
  `structure_notes` convention: timestamp + what to build + spoken
  line for timing.
- `speech.wpm` check: ~170–190 over voiced spans CONFIRMS promo
  pace (voice carries, cards swap under it — visuals change UNDER
  continuous speech, never the reverse). Gaps >1.0s between
  phrases are delivery pauses, NOT `dead_air` cuts.

### 6c.6 HyperFrames build notes (verified names, hyperframes 0.8.40)

Resolve against the REAL catalog (`hyperframes catalog`, 393
items) — these names were verified 2026-09-15, never invent
variants. Blobs behind hook type: `mk-background` (soft-blob
gradient, frosted-glass mode) or `vfx-liquid-background`
(displaced-plane liquid). Glass demo cards: `vfx-liquid-glass`.
Word light-up: `per-word-crossfade` (calm keynote fade + drift)
— NOT `caption-highlight` (red TikTok sweep = wrong register),
NOT `caption-kinetic-slam` (full-screen slam = single-word
beats only). Single-word payoff zoom: `parallax-zoom` or
`zoom-through-transition`. Typewriter prompt band: `typewriter`
or `typed-prompt`. Cursor gesture: `oversized-cursor` (drag) /
`press-ripple` (click) / `simulated-cursor` (walkthrough).
Avatar grid: `mk-placeholder-grid` (3×3, staggered box-in).
Style list: `mk-specs-list` (staggered rows + accent sweep).
Prompt glow/aurora behind dark cards: `aurora-drift`. Card
entrance/exit: `fade-through` or `transitions-blur` (blur =
transition language of this piece: words resolve blur→sharp,
scenes dissolve through blur). NEVER `caption-glitch-rgb`,
`rgb-glitch-text`, `whip-pan-cut` mid-video — the register is
clean/restrained at show speed; glitch is outro-only.

## 7. Output format: Action Plan JSON (EditPlan v1.3)

Every intervention must be written in this format — field for field what
`buildHyperframesProject` consumes. Unknown fields are ignored by the
renderer, so stick to this contract.

```json
{
  "version": "1.3",
  "style": "educational",
  "format": "long",
  "media_id": "<media_id from import_raw_media>",
  "resolvedRegister": "educational",
  "takesCount": 1,
  "speech": {"wpm": 181.5, "totalWords": 1240},
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
    {"time": "00:00:05.000", "kind": "caption_pop", "detail": "interrupt every ~5s"},
    {"time": "00:01:55.000", "kind": "caption_pop", "detail": "risk-point coverage: 30s static block"}
  ],
  "graphics": [
    {"time": "00:00:10.500", "kind": "act_title", "title": "TRE SEGRETI", "subtitle": "Section 2", "duration": 2.5},
    {"time": "00:01:20.000", "kind": "number_stat", "title": "$3,000 / MONTH", "duration": 3.5}
  ],
  "structure_notes": [
    {"time": "00:00:00.000", "note": "hook missing: consider cold open with moment at 00:03:12"}
  ]
}
```

Graphic kinds (all transcript-verbatim, TOP banners, max 1 at a time):
`act_title` (new act opens — section's own words, ≤6, UPPERCASE),
`number_stat` (spoken number worth reading — digit keyword, accent
color), `highlight` (top non-numeric keyword as context label, clear
of numbers ±20s), `quote` (hook replay past midpoint, >8min media
only). Beats inside CUTs/masks are dropped; overlapping banners fail
loud in the renderer — same contract as karaoke.

Field notes:

- `cuts` is a real splice: KEEP ranges (sorted, non-overlapping,
  edge-to-edge) form the output timeline; entries prefixed `CUT —` are
  excluded from the render but kept in the record. The renderer plays
  each KEEP via `data-media-start` and remaps every animation from
  source clock to timeline clock — animations inside CUT ranges are
  dropped, and the output duration is the KEEP sum (shorter than source).
- `format` selects the canvas: `short` → 1080×1920 (9:16),
  `long` → 1920×1080 (16:9). Never render a portrait source as landscape.
- `animations[].type` must be one of: `text_overlay` | `caption` | `karaoke_caption` | `lower_third` | `zoom_in` | `zoom_out` | `slow_zoom` | `transition` | `graphic_card`. Anything else renders nothing.
- `resolvedRegister` is the register that RAN (alias folded, downgrade
  applied) — trust it over the requested `style`. `takesCount` is what
  the gate saw. `speech.wpm` is the measured pace (compare §6).
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
- [ ] Technique frequency matches the target register (see Section 6:
  show ~2s / educational ~5s / tutorial ~20s / podcast ~60s /
  short ~4s) AND the footage gate (§6b: single_take = caption pops
  only, no faked coverage).
- [ ] Timecodes are `HH:MM:SS.mmm` everywhere, within media bounds, no zero-length segments.
- [ ] The plan is valid JSON with `version: "1.3"`, `format`,
  `resolvedRegister`, `takesCount`, and `media_id`, ready for `render_video`.
- [ ] After rendering: review frames before delivering — hook (first
  3s), one mid-KEEP section, every banner timestamp. Face free,
  captions legible on the real background, banners TOP + verbatim,
  cuts invisible, duration ≈ sum of KEEP ranges. Fix the plan and
  re-render on any defect (`draft` until it passes, `high` only for
  the approved final). Deliver the reviewed render with a short
  summary — never an unseen first render.

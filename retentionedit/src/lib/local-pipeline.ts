/**
 * RetentionEdit — Local M1 pipeline runner (SERVER ONLY).
 *
 * upload → transcribe (Muse Voice API, real words) → cuts (silencedetect) →
 * render-base (ffmpeg H.264+AAC, caption+zoom, NO broll) →
 * broll-submit → broll-poll (Higgsfield SOUL, resumable across invocations) →
 * finalize (concat broll overlay) → done.
 *
 * Serverless design: each invocation runs advanceJob() with a deadline
 * (~25s per status poll). Long steps (SOUL 90s) span multiple polls via
 * persisted `soul` state — submit once, poll until done. Every mutation
 * persists via the injected save() (R2 on serverless, fs locally).
 *
 * No invented content anywhere:
 *  - STT fails → proceed with silence-only cuts (transcriptWords = 0).
 *  - silence fails/no-audio → normalize re-encode, MP4 always playable.
 *  - SOUL fails → video ships without B-roll (fail-soft).
 */
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { loadLocalJob, saveLocalJob, localFilePath, type LocalJob } from "./local-jobs";
import { transcribeLocalFile } from "./local-stt";
import { detectSilences, spansToCuts } from "./local-silence";
import { cutsToKeep, probeMedia, renderLocalCut } from "./local-render";

const IN_FLIGHT = new Set<string>();

function stamp(jobId: string, msg: string): string {
  return `[${new Date().toLocaleTimeString()}] [${jobId.slice(-6)}] ${msg}`;
}

export interface AdvanceOpts {
  /** Stop starting NEW steps after this epoch ms (finish current touch first). */
  deadlineMs?: number;
  /** Persist hook (R2 on serverless). Defaults to filesystem save. */
  save?: (job: LocalJob) => Promise<void> | void;
  /** Pre-computed keep segments (recomputed when absent). */
  keepOverride?: Array<{ start: number; end: number }>;
}

function timeLeft(opts: AdvanceOpts): number {
  if (!opts.deadlineMs) return Infinity;
  return opts.deadlineMs - Date.now();
}

/**
 * Advance a job by as many steps as fit before deadlineMs.
 * Idempotent per stage: re-running a completed stage is a no-op because
 * each block checks job.stage first. Returns the (mutated) job.
 */
export async function advanceJob(
  job: LocalJob,
  jobId: string,
  userIdHint: string,
  opts: AdvanceOpts = {}
): Promise<LocalJob> {
  const save = opts.save ?? ((j: LocalJob) => saveLocalJob(j));
  const touch = async (patch: Partial<LocalJob>, log?: string) => {
    Object.assign(job, patch);
    if (log) job.log.push(stamp(jobId, log));
    await save(job);
  };

  // ---- TRANSCRIBE (Meta Muse Voice API, real words) ----
  if (job.stage === "upload") {
    await touch({ stage: "transcribe", progress: 12 }, "Trascrizione Muse Voice avviata (API Meta, $0.18/h)");
    const t0 = Date.now();
    const stt = await transcribeLocalFile(job.sourcePath).catch(() => null);
    if (stt) {
      const words = stt.transcript.segments.flatMap((s) => s.words);
      const preview = stt.transcript.segments.slice(0, 3).map((s) => s.text).join(" │ ").slice(0, 220);
      await touch(
        {
          language: stt.language,
          transcriptWords: words.length,
          transcriptPreview: preview,
          segments: stt.transcript.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
          // Real word timestamps for M2 captions (cap 2000, persisted).
          words: words
            .slice(0, 2000)
            .map((w) => ({ word: w.word, start: w.start, end: w.end })),
          progress: 45,
        },
        `Trascritto: ${words.length} parole (${stt.language}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );
    } else {
      await touch({ transcriptWords: 0, progress: 45 }, "STT non disponibile — proseguo con soli tagli silenzi");
    }
  }

  // ---- CUTS (real silencedetect + Opus extra cuts) ----
  if (job.stage === "transcribe") {
    if (timeLeft(opts) < 5_000) return job; // resume next poll
    await touch({ stage: "cuts", progress: 55 }, "Rilevamento silenzi reali (ffmpeg silencedetect)");
    const probed = await probeMedia(job.sourcePath);
    const duration = probed?.duration ?? 60;
    const sil = await detectSilences(job.sourcePath).catch(() => []);
    const silenceCuts = spansToCuts(sil, { mediaDuration: duration });

    // ---- OPUS REGISTA (verdetto centrale, Vault come riferimento) ----
    // Opus riceve parole reali + silenzi reali + match Vault e decide TUTTO:
    // tagli extra, zoom, caption, graphics, broll, cover. Parola finale sua.
    const transcriptText0 = (job.segments || []).map((s) => s.text).join(" ").slice(0, 4000);
    let voltForOpus: import("./retentionvolt-client").VoltMatch | null = null;
    try {
      const { findVoltMatch } = await import("./retentionvolt-client");
      voltForOpus = await findVoltMatch({ format: job.format, transcriptText: transcriptText0 });
    } catch {
      voltForOpus = null;
    }
    let verdict: import("./opus-director").DirectorVerdict;
    try {
      const { directFullEdit } = await import("./opus-director");
      verdict = await directFullEdit({
        transcriptText: transcriptText0,
        words: (job.words || []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
        silences: sil.map((s) => ({ start: s.start, end: s.end })),
        format: job.format,
        duration,
        volt: voltForOpus,
      });
    } catch {
      const { heuristicVerdict } = await import("./opus-director");
      verdict = heuristicVerdict({
        transcriptText: transcriptText0,
        words: (job.words || []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
        format: job.format,
        duration,
        volt: voltForOpus,
      });
    }
    // Tagli Opus (extraCuts) si SOMMANO ai silenzi — clamp dentro durata.
    const opusCuts = (verdict.extraCuts || [])
      .filter((c) => c.end > c.start && c.start < duration && c.end > 0)
      .map((c) => ({
        start: Math.max(0, c.start),
        end: Math.min(duration, c.end),
      }));
    const cuts = [...silenceCuts, ...opusCuts]
      .sort((a, b) => a.start - b.start)
      .slice(0, 60);
    const { keep, saved } = cutsToKeep(cuts, duration);
    await touch(
      {
        silences: sil.slice(0, 60),
        cuts: cuts.slice(0, 60),
        keepCount: keep.length,
        sourceDuration: Number(duration.toFixed(2)),
        verdict: {
          editorialVerdict: verdict.editorialVerdict,
          hookStrengthScore: verdict.hookStrengthScore,
          reason: verdict.reason,
          vaultReference: verdict.vaultReference,
          opusLive: verdict.opusLive,
          extraCuts: verdict.extraCuts.length,
          zooms: verdict.zooms.length,
          graphics: verdict.graphics.length,
          brolls: verdict.brolls.length,
          caption: { ...verdict.caption },
          opusZooms: verdict.zooms.map((z) => ({ at: z.at, peak: z.peak })),
          cover: { ...verdict.cover },
        },
        opusGraphics: verdict.graphics.map((g) => ({ ...g })),
        opusBrolls: verdict.brolls.map((b) => ({ ...b })),
      },
      verdict.opusLive
        ? `Opus regista: “${verdict.editorialVerdict.slice(0, 80)}” hook ${verdict.hookStrengthScore}/10 (+${verdict.extraCuts.length} tagli, ${verdict.graphics.length} card, ${verdict.brolls.length} B-roll)`
        : `Regia locale: ${verdict.reason} (+${verdict.extraCuts.length} disfluenze tagliate)`
    );
    await touch(
      {
        timeSavedSec: saved,
        progress: 65,
      },
      cuts.length > 0
        ? `Trovati ${cuts.length} tagli reali → rimossi ${saved.toFixed(1)}s`
        : "Nessun silenzio da tagliare — normalizzo senza tagli"
    );
    // stash keep for render step (recomputed deterministically at render too)
    (job as unknown as { _keep?: typeof keep })._keep = keep;
    await save(job);
  }

    // ---- RENDER-BASE (real ffmpeg: cuts + captions + zooms, NO broll yet) ----
    if (job.stage === "cuts") {
      if (timeLeft(opts) < 5_000) return job; // resume next poll
      await touch({ stage: "render", progress: 72 }, "Render MP4 reale (H.264 + AAC, loudnorm)");
      // Recompute keep deterministically from persisted cuts (survives reloads).
      const persistedCuts = (job.cuts || []).map((c) => ({ start: c.start, end: c.end }));
      const duration = job.sourceDuration ?? 60;
      const keep =
        opts.keepOverride ??
        (job as unknown as { _keep?: Array<{ start: number; end: number }> })._keep ??
        cutsToKeep(persistedCuts, duration).keep;
      // M4-first: RetentionVolt match PRIMA delle caption — Opus lo usa come
      // RIFERIMENTO per decidere la caption policy (resto in M2). La parola
      // finale è sempre di Opus, mai del Vault. NEVER decides cuts.
      let voltForOpus: import("./retentionvolt-client").VoltMatch | null = null;
      {
        const transcriptText = (job.segments || []).map((s) => s.text).join(" ").slice(0, 4000);
        try {
          const { findVoltMatch } = await import("./retentionvolt-client");
          voltForOpus = await findVoltMatch({ format: job.format, transcriptText });
        } catch {
          voltForOpus = null;
        }
      }
      // Caption dal VERDETTO (Opus ha già deciso in CUTS: on/off, maxWords,
      // keywords). Qui solo esecuzione: parole reali → cue → remap FINAL.
      // Il verdetto persistito non ha i testi keyword → li riusa da M1 policy
      // solo se il verdetto manca (job legacy). Mai due registi.
      let finalCues: Array<{ start: number; end: number; text: string; words?: Array<{ word: string; start: number; end: number; emphasis?: boolean }> }> = [];
      let captionReason = "";
      // Zoom Opus (source clock → FINAL): picchi del verdetto + scene reali.
      let opusZoomAt: Array<{ at: number; peak: number }> = [];
      try {
        const realWords = (job.words || []).filter(
          (w) => w && typeof w.word === "string" && w.word.length > 0 && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start
        );
        if (realWords.length > 0) {
          const v = job.verdict;
          // Caption policy DAL VERDETTO (Opus ha deciso in CUTS). Solo per job
          // legacy senza verdetto si usa M1 decideCaptionPolicy. Mai due registi.
          const transcriptText = (job.segments || []).map((s) => s.text).join(" ");
          if (!v || !v.caption) {
            const { decideCaptionPolicy } = await import("./opus-caption-director");
            const policy = await decideCaptionPolicy({ transcriptText: transcriptText.slice(0, 4000), format: job.format, volt: null }).catch(() => null);
            captionReason = policy ? `Opus: ${policy.reason}` : "";
            if (policy && !policy.enabled) {
              await touch({ progress: 77 }, `Caption spente — ${captionReason}`);
            } else {
              const { wordsToCues, remapCuesToFinal } = await import("./local-captions");
              finalCues = remapCuesToFinal(
                wordsToCues(realWords.map((w) => ({ word: w.word, start: w.start, end: w.end, confidence: 1 })), policy?.maxWords ?? (job.format === "short" ? 5 : 8), policy?.keywords?.length ? new Set(policy.keywords) : undefined),
                keep
              );
            }
          } else if (!v.caption.enabled) {
            captionReason = v.opusLive ? "Opus regista: caption spente (musica/montaggio)" : `Regia locale: ${v.reason}`;
            await touch({ progress: 77 }, `Caption spente — ${captionReason}`);
          } else {
            captionReason = v.opusLive
              ? `Opus regista${v.vaultReference ? ` (rif. Vault: “${v.vaultReference.slice(0, 40)}”)` : ""}`
              : `Regia locale: ${v.reason}`;
            const { wordsToCues, remapCuesToFinal } = await import("./local-captions");
            finalCues = remapCuesToFinal(
              wordsToCues(realWords.map((w) => ({ word: w.word, start: w.start, end: w.end, confidence: 1 })), v.caption.maxWords, v.caption.keywords.length > 0 ? new Set(v.caption.keywords) : undefined),
              keep
            );
          }
          // Zoom Opus (source clock → FINAL): picchi del verdetto mappati sui keep.
          opusZoomAt = (v?.opusZooms || []).filter((z) => Number.isFinite(z.at) && z.at >= 0).map((z) => ({ at: z.at, peak: z.peak }));
        }
      } catch {}
      let fontStatus = "fallback";
      try {
        fontStatus = (await import("./local-captions")).captionFontStatus();
      } catch {}
      await touch(
        { captions: finalCues.slice(0, 400), progress: 78 },
        finalCues.length > 0
          ? `Caption karaoke: ${finalCues.length} cue da parole trascritte (font ${fontStatus})${captionReason ? ` — ${captionReason}` : ""}`
          : captionReason
            ? `Nessuna caption — ${captionReason}`
            : "Nessuna caption (STT assente)"
      );
      // Zoom: Opus PRIMA (picchi del verdetto, mappati su FINAL), scene reali,
      // Vault pacing solo dove manca tutto. Cuts-first: mai a cavallo di un taglio.
      let finalZooms: Array<{ finalStart: number; finalEnd: number; peak: number }> = [];
      // source→final mapper (stesso dei remap caption).
      const srcToFinal = (src: number): number | null => {
        let off = 0;
        for (const k of keep) {
          if (src >= k.start && src < k.end) return off + (src - k.start);
          off += k.end - k.start;
        }
        return null; // dentro un taglio — scartato
      };
      try {
        const { detectScenes, remapScenesToFinal, planZooms } = await import("./local-scenes");
        const scenes = await detectScenes(job.sourcePath).catch(() => []);
        const finalSceneTimes = remapScenesToFinal(scenes, keep);
        const finalDur = keep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
        finalZooms = planZooms(finalSceneTimes, finalDur);
        // Zoom Opus: picchi source → finestre FINAL (2.2s, clamp durata).
        let opusAdded = 0;
        for (const z of opusZoomAt) {
          const f = srcToFinal(z.at);
          if (f === null || f < 1 || f > finalDur - 1) continue;
          if (finalZooms.some((e) => Math.abs(e.finalStart - f) < 3)) continue;
          finalZooms.push({ finalStart: Number(f.toFixed(2)), finalEnd: Number(Math.min(finalDur, f + 2.2).toFixed(2)), peak: Math.min(1.3, Math.max(1.05, z.peak)) });
          opusAdded++;
          if (opusAdded >= 8) break;
        }
        finalZooms.sort((a, b) => a.finalStart - b.finalStart);
        await touch(
          { scenes: scenes.slice(0, 60), zooms: finalZooms, progress: 80 },
          scenes.length > 0
            ? `Scene reali: ${scenes.length} stacchi → ${finalZooms.length} zoom dinamici`
            : opusAdded > 0
              ? `Opus: ${opusAdded} zoom ritmici su single-take`
              : "Nessuno stacco reale — nessuno zoom (single-take)"
        );
      } catch {
        await touch({ scenes: [], zooms: [], progress: 80 }, "Scene detect non disponibile — nessuno zoom");
      }
      // Pacing zooms dal match Vault (solo dove il locale non ha trovato nulla).
      // NEVER decides cuts — only adds pacing zooms where local found none.
      try {
        const { voltZoomsFromMatch } = await import("./retentionvolt-client");
        const match = voltForOpus;
        if (match) {
          const finalDur = keep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
          const extra = voltZoomsFromMatch(match, finalDur, finalZooms, keep);
          finalZooms = [...finalZooms, ...extra].sort((a, b) => a.finalStart - b.finalStart);
          await touch(
            {
              volt: {
                title: match.title,
                creator: match.creator,
                youtubeUrl: match.youtubeUrl,
                thumbnailUrl: match.thumbnailUrl,
                niche: match.niche,
                retentionScore: match.retentionScore,
                views: match.views,
                hookTactic: match.hookTactic,
                bodyPacing: match.bodyPacing,
                voltZooms: extra.length,
              },
              zooms: finalZooms,
              progress: 82,
            },
            `RetentionVolt: montato come "${match.title.slice(0, 40)}" ★${match.retentionScore} (+${extra.length} zoom pacing)`
          );
        } else {
          await touch({ volt: null, progress: 82 }, "RetentionVolt non disponibile — solo motore locale");
        }
      } catch {
        await touch({ volt: null, progress: 82 }, "RetentionVolt non disponibile — solo motore locale");
      }
      // ---- B-ROLL SUBMIT (Opus decide: fino a 3 slot, prompt pronti) ----
      // Submit once → persist `souls[]` → later polls resume via pollSoulImage.
      // Finestre Opus (source→FINAL via srcToFinal), fallback: centro longest keep.
      // Fail-soft: any error → brolls [] (video still ships without them).
      try {
        const { submitSoulImage, higgsfieldConfigured } = await import("./higgsfield-soul");
        const finalDur = keep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
        if (job.souls && job.souls.length > 0) {
          // Already submitted in a previous invocation — polling happens below.
        } else if (higgsfieldConfigured() && finalDur >= 6) {
          const slots: Array<{ prompt: string; finalStart: number; finalEnd: number; layout: string }> = [];
          // Slot Opus (max 3): at source → FINAL, durata clamp, niente overlap.
          for (const b of (job.opusBrolls || []).slice(0, 3)) {
            const f = srcToFinal(b.at);
            if (f === null) continue;
            const dur = Math.min(6, Math.max(1.5, b.duration || 3.5));
            const fs = Math.max(0.5, Math.min(finalDur - dur - 0.3, f - dur / 2));
            if (slots.some((s) => Math.abs(s.finalStart - fs) < dur + 1)) continue;
            slots.push({ prompt: b.prompt, finalStart: Number(fs.toFixed(2)), finalEnd: Number((fs + dur).toFixed(2)), layout: b.layout === "pip" ? "pip" : "fullscreen" });
          }
          // Fallback: nessun slot Opus valido → centro longest keep (come M1).
          if (slots.length === 0) {
            const longest = [...keep].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
            const idx = keep.indexOf(longest);
            const finalOffset = keep.slice(0, idx).reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
            const keepLen = longest.end - longest.start;
            const bDur = Math.min(3.5, Math.max(1.5, keepLen - 1.0));
            const srcStart = longest.start + Math.max(0.5, (keepLen - bDur) / 2);
            const finalStart = Number((finalOffset + (srcStart - longest.start)).toFixed(2));
            const winWords = (job.words || [])
              .filter((w) => w.start >= srcStart - 2 && w.start <= srcStart + bDur + 2)
              .map((w) => w.word);
            const kw = winWords
              .map((w) => w.toLowerCase().replace(/[^a-zà-ÿ']/g, ""))
              .filter((w) => w.length > 3 && !/^(this|that|with|from|have|has|are|was|were|very|just|like|know|cosa|come|della|nella|sono|molto|molti|anche|quando|questo|questa|nella|perch|quindi)$/.test(w));
            const uniq = [...new Set(kw)].slice(0, 5);
            const topic = uniq.length > 0 ? uniq.join(", ") : ((job.segments || []).map((s) => s.text).join(" ").slice(0, 120) || "creator talking to camera");
            slots.push({
              prompt: `cinematic photorealistic illustration of ${topic.slice(0, 160)}, warm cinematic light, high detail, no text, no watermark`,
              finalStart,
              finalEnd: Number((finalStart + bDur).toFixed(2)),
              layout: "fullscreen",
            });
          }
          const aspect = job.format === "short" ? "9:16" : "16:9";
          const submitted: NonNullable<LocalJob["souls"]> = [];
          for (let i = 0; i < slots.length; i++) {
            await touch({ progress: 84 }, `Higgsfield SOUL ${i + 1}/${slots.length}: genero B-roll (“${slots[i].prompt.slice(0, 50)}…”)`);
            const pending = await submitSoulImage({ prompt: slots[i].prompt, aspectRatio: aspect }).catch(() => null);
            if (pending) {
              submitted.push({
                requestId: pending.requestId,
                prompt: pending.prompt,
                aspectRatio: pending.aspectRatio,
                finalStart: slots[i].finalStart,
                finalEnd: slots[i].finalEnd,
                brollPrompt: slots[i].prompt,
                layout: slots[i].layout,
                slot: i,
              });
            }
          }
          if (submitted.length > 0) {
            await touch({ souls: submitted, soulSubmittedAt: Date.now(), progress: 85 }, `${submitted.length} B-roll sottomessi — controllo avanzamento al prossimo poll`);
          } else {
            await touch({ brolls: [], souls: [], progress: 88 }, "Higgsfield non disponibile — video senza B-roll");
          }
        } else {
          await touch({ brolls: [], souls: [], progress: 88 }, finalDur < 6 ? "Video troppo breve per B-roll — solo tagli/caption/zoom" : "Higgsfield non configurato — video senza B-roll");
        }
      } catch {
        await touch({ brolls: [], souls: [], progress: 88 }, "B-roll non disponibile — video senza B-roll");
      }

      // ---- RENDER-BASE OUTPUT (no broll): always render now so the video
      // exists even if SOUL never completes. Saved as base.mp4 in job dir;
      // finalize() overlays broll later when ready.
      if (timeLeft(opts) < 8_000) return job; // render needs seconds — resume next poll
      {
        const outDir = path.dirname(localFilePath(job, "final"));
        const res = await renderLocalCut({
          sourcePath: job.sourcePath,
          keep,
          format: job.format,
          outDir,
          basename: "base",
          captions: job.captions ?? [],
          zooms: job.zooms ?? [],
          brolls: [],
        });
        await touch(
          {
            finalDuration: res.durationSec,
            bytes: res.bytes,
            captionsBurned: res.captionsBurned,
            zoomsApplied: res.zoomsApplied,
            progress: 90,
          },
          `Base pronta: MP4 ${(res.bytes / 1048576).toFixed(1)}MB, ${res.durationSec}s`
        );
      }
    }

    // ---- BROLL-POLL + FINALIZE ----
    if (job.stage === "render") {
      const persistedCuts = (job.cuts || []).map((c) => ({ start: c.start, end: c.end }));
      const duration = job.sourceDuration ?? 60;
      const keep =
        opts.keepOverride ??
        (job as unknown as { _keep?: Array<{ start: number; end: number }> })._keep ??
        cutsToKeep(persistedCuts, duration).keep;

      // No pending SOUL → finalize immediately from base (fail-soft path).
      if (!job.souls || job.souls.length === 0) {
        if (timeLeft(opts) < 5_000) return job;
        await finalizeFromBase(job, jobId, keep, [], touch);
        return job;
      }

      // Pending SOULs (max 3) → poll ciascuno (cheap GET, resumable).
      // Fail-soft timeout: SOUL 720p ≈ 40s; se dopo 6 minuti non è pronto,
      // consegna la base (video reale montato) invece di restare al 91%.
      const SOUL_FAILSOFT_MS = 6 * 60_000;
      const soulWaited = Date.now() - (job.soulSubmittedAt || Date.now());
      const { pollSoulImage } = await import("./higgsfield-soul");
      const jobDir = path.dirname(localFilePath(job, "final"));
      const ready: NonNullable<LocalJob["brolls"]> = [...(job.brolls || [])];
      const stillPending: NonNullable<LocalJob["souls"]> = [];
      for (const s of job.souls) {
        // Già pronto in un poll precedente (stesso slot) → skip.
        if (ready.some((r) => Math.abs(r.finalStart - s.finalStart) < 0.05)) continue;
        const outPng = path.join(jobDir, `broll_soul_${s.slot}.png`);
        const got = await pollSoulImage(
          { requestId: s.requestId, prompt: s.prompt, aspectRatio: s.aspectRatio },
          outPng,
          30_000 // poll brevi per slot: 3 slot × 30s dentro i budget serverless
        ).catch(() => ({ done: false as const }));
        if (got.done && "image" in got && got.image) {
          ready.push({ localPath: got.image.localPath, finalStart: s.finalStart, finalEnd: s.finalEnd, prompt: s.brollPrompt, bytes: got.image.bytes, layout: s.layout });
          try {
            const { persistBroll } = await import("./local-jobs-r2");
            await persistBroll(job, got.image.localPath);
          } catch {}
        } else {
          stillPending.push(s);
        }
      }
      if (stillPending.length > 0) {
        await touch({ brolls: ready, souls: stillPending, progress: 91 }, `Higgsfield: ${ready.length} pronti, ${stillPending.length} in generazione — ricontrollo al prossimo poll`);
        if (soulWaited > SOUL_FAILSOFT_MS) {
          await touch({ souls: [], progress: 94 }, "Higgsfield troppo lento (>6 min) — consegno con i B-roll pronti");
        } else {
          return job;
        }
      } else if (ready.length > 0) {
        await touch(
          { brolls: ready, souls: [], progress: 94 },
          `B-roll Higgsfield pronti (${ready.length}, ${ready.map((r) => `${(r.finalEnd - r.finalStart).toFixed(1)}s da t=${r.finalStart}s`).join(" + ")})`
        );
      } else {
        await touch({ brolls: [], souls: [], progress: 94 }, "Higgsfield fallito — video senza B-roll");
      }

      if (timeLeft(opts) < 8_000) return job; // finalize next poll
      const overlays: Array<{ imagePath: string; finalStart: number; finalEnd: number; layout?: string }> = [];
      // Re-materialize the PNGs when this invocation runs on another instance.
      for (const b of (job.brolls || [])) {
        let local: string | null = null;
        try {
          const { ensureBrollLocal } = await import("./local-jobs-r2");
          local = await ensureBrollLocal(job);
        } catch {
          local = null;
        }
        // Last-resort local path (single-instance flows without R2).
        if (!local) {
          try {
            const { existsSync } = await import("node:fs");
            if (existsSync(b.localPath)) local = b.localPath;
          } catch {}
        }
        if (local) overlays.push({ imagePath: local, finalStart: b.finalStart, finalEnd: b.finalEnd, layout: b.layout });
      }
      if (overlays.length === 0 && (job.brolls || []).length > 0) {
        await touch({ brolls: [], progress: 94 }, "B-roll non recuperabili — video senza B-roll");
      }
      await finalizeFromBase(job, jobId, keep, overlays, touch);
      return job;
    }

    return job;
}

/**
 * Finalize: re-render base timeline + broll overlay → final.mp4 / cover.jpg → done.
 * Base render already proved the timeline; this adds the Ken Burns overlay.
 *
 * Poi (stesso finalize, mai un job separato):
 *  - Titolo YouTube: Claude (transcript reale + match Vault) → job.youtubeTitle.
 *  - Cover Higgsfield: SOUL text-to-image ad-hoc (headline dal titolo, stile
 *    dal match Vault) → job.youtubeCoverPath. Poll SOLO dentro i budget
 *    serverless (90s submit+poll una tantum); in fail → frame ffmpeg.
 */
async function finalizeFromBase(
  job: LocalJob,
  jobId: string,
  keep: Array<{ start: number; end: number }>,
  brollOverlays: Array<{ imagePath: string; finalStart: number; finalEnd: number; layout?: string }>,
  touch: (patch: Partial<LocalJob>, log?: string) => Promise<void>
): Promise<void> {
  const outDir = path.dirname(localFilePath(job, "final"));
  // Graphics Opus (source→FINAL via keep): banner TOP content-aware (M3).
  const srcToFinalF = (src: number): number | null => {
    let off = 0;
    for (const k of keep) {
      if (src >= k.start && src < k.end) return off + (src - k.start);
      off += k.end - k.start;
    }
    return null;
  };
  const finalGraphics: Array<{ kind: string; title: string; subtitle?: string; tag?: string; at: number; duration: number }> = [];
  for (const g of (job.opusGraphics || []).slice(0, 3)) {
    const f = srcToFinalF(g.at);
    if (f === null || f < 0.5) continue;
    if (finalGraphics.some((e) => Math.abs(e.at - f) < 4)) continue;
    finalGraphics.push({ kind: g.kind, title: g.title, subtitle: g.subtitle, tag: g.tag, at: Number(f.toFixed(2)), duration: Math.min(6, Math.max(1, g.duration || 3)) });
  }
  const res = await renderLocalCut({
    sourcePath: job.sourcePath,
    keep,
    format: job.format,
    outDir,
    basename: "edit",
    captions: job.captions ?? [],
    zooms: job.zooms ?? [],
    brolls: brollOverlays.map((b) => ({ imagePath: b.imagePath, finalStart: b.finalStart, finalEnd: b.finalEnd })),
    graphics: finalGraphics,
  });
  // Normalize filenames to final.mp4 / cover.jpg
  const finalDst = localFilePath(job, "final");
  const coverDst = localFilePath(job, "cover");
  if (res.mp4Path !== finalDst && existsSync(res.mp4Path)) copyFileSync(res.mp4Path, finalDst);
  if (res.coverPath !== coverDst && existsSync(res.coverPath)) copyFileSync(res.coverPath, coverDst);

  // ---- TITOLO YOUTUBE (Claude regista + Vault, transcript reale) ----
  // Non blocca mai la consegna: fallback euristico se Claude/Vault falliscono.
  try {
    const transcriptText = (job.segments || []).map((s) => s.text).join(" ").slice(0, 4000);
    const { resolveYouTubeTitle } = await import("./claude-title");
    const yt = await resolveYouTubeTitle({
      rawTitle: job.title,
      transcriptText,
      niche: job.volt?.niche,
    }).catch(() => job.title);
    if (yt && yt.trim().length >= 8) {
      await touch({ youtubeTitle: yt.trim().slice(0, 100) }, `Titolo YouTube: “${yt.trim().slice(0, 60)}”`);
    }
  } catch {
    // fallback = job.title (mai bloccare)
  }

  // ---- COVER HIGGSFIELD (concept Opus: headline+stile dal verdetto) ----
  // Headline/stile dal verdetto regista (Opus ha deciso in CUTS guardando il
  // Vault). Budget 90s dentro questo finalize; in fail → frame ffmpeg.
  try {
    const { submitSoulImage, pollSoulImage, higgsfieldConfigured } = await import("./higgsfield-soul");
    if (higgsfieldConfigured()) {
      const title = job.youtubeTitle || job.title;
      const vCover = job.verdict && (job.verdict as { cover?: { headline?: string; style?: string } }).cover;
      const headline = (vCover?.headline || title.replace(/[()]/g, "").split(/\s+/).slice(0, 5).join(" ")).toUpperCase().slice(0, 28) || "VIRAL EDIT";
      const style = ((vCover?.style || job.volt?.niche || "creator").replace(/[^a-z0-9 ]/gi, " ").trim().slice(0, 40) || "creator");
      const hook = (job.segments || []).map((s) => s.text).join(" ").slice(0, 140);
      const orientation = job.format === "short" ? "vertical 9:16 portrait" : "horizontal 16:9 wide";
      const prompt = [
        `High-CTR ${orientation} YouTube cover thumbnail, ${style} aesthetic`,
        `expressive creator face in close-up looking straight at camera, strong emotion, neon emerald rim light, dark luxury background with subtle depth of field`,
        `minimal bold headline text "${headline}" in heavy condensed sans-serif, huge, high contrast white with yellow glow accent, single line, top-safe placement`,
        `small badge pill "VIRAL HOOK"`,
        `photorealistic 85mm, cinematic studio lighting, 8k, no watermark, no extra text`,
        hook ? `context: ${hook}` : "",
      ].filter(Boolean).join(". ");
      const pending = await submitSoulImage({
        prompt,
        aspectRatio: job.format === "short" ? "9:16" : "16:9",
      }).catch(() => null);
      if (pending) {
        const coverPng = path.join(outDir, "youtube_cover.png");
        const got = await pollSoulImage(
          { requestId: pending.requestId, prompt: pending.prompt, aspectRatio: pending.aspectRatio },
          coverPng,
          90_000
        ).catch(() => ({ done: false as const }));
        if (got.done && "image" in got && got.image) {
          await touch({ youtubeCoverPath: got.image.localPath }, `Cover Higgsfield pronta (${(got.image.bytes / 1024).toFixed(0)}KB)`);
          try {
            const { persistYoutubeCover } = await import("./local-jobs-r2");
            await persistYoutubeCover(job, got.image.localPath);
          } catch {}
        } else {
          await touch({ youtubeCoverPath: null }, "Cover Higgsfield non pronta — uso frame video");
        }
      } else {
        await touch({ youtubeCoverPath: null }, "Higgsfield non disponibile — uso frame video");
      }
    } else {
      await touch({ youtubeCoverPath: null }, "Higgsfield non configurato — uso frame video");
    }
  } catch {
    // cover = frame ffmpeg (mai bloccare)
  }

  // ---- QUALITY GATE (5 pilastri skill parity, prima di consegnare) ----
  // Verifica il MP4 finale con ffprobe: esistenza, durata, caption/zoom/broll
  // applicati come da verdetto. Non rigenera (fail-soft), ma registra il gate
  // nel log così la card mostra cosa è stato verificato.
  try {
    const gate: string[] = [];
    gate.push(res.bytes > 50_000 ? "file-ok" : "file-piccolo");
    gate.push(res.durationSec >= 2 ? "durata-ok" : "durata-corta");
    gate.push(res.captionsBurned > 0 ? `${res.captionsBurned}-caption` : "no-caption");
    gate.push(res.zoomsApplied > 0 ? `${res.zoomsApplied}-zoom` : "no-zoom");
    gate.push(res.brollsApplied > 0 ? `${res.brollsApplied}-broll` : "no-broll");
    gate.push(res.graphicsApplied > 0 ? `${res.graphicsApplied}-card` : "no-card");
    await touch({ progress: 98 }, `Quality gate: ${gate.join(" · ")}`);
  } catch {}

  await touch(
    {
      stage: "done",
      progress: 100,
      finalDuration: res.durationSec,
      bytes: res.bytes,
      captionsBurned: res.captionsBurned,
      zoomsApplied: res.zoomsApplied,
      brollsApplied: res.brollsApplied,
    },
    `Pronto: MP4 ${(res.bytes / 1048576).toFixed(1)}MB, ${res.durationSec}s (risparmiati ${res.timeSavedSec}s${res.captionsBurned > 0 ? `, ${res.captionsBurned} caption` : ""}${res.zoomsApplied > 0 ? `, ${res.zoomsApplied} zoom` : ""}${res.brollsApplied > 0 ? `, ${res.brollsApplied} B-roll Higgsfield` : ""}${res.graphicsApplied > 0 ? `, ${res.graphicsApplied} card Opus` : ""})`
  );
}

/**
 * Legacy fire-and-forget runner (local dev single-invocation flows).
 * Loads the job from the filesystem store and advances without deadline.
 */
export async function runLocalJob(jobId: string, userIdHint?: string): Promise<void> {
  if (!userIdHint) return;
  if (IN_FLIGHT.has(jobId)) return;
  IN_FLIGHT.add(jobId);
  try {
    const job = loadLocalJob(userIdHint, jobId);
    if (!job) return;
    await advanceJob(job, jobId, userIdHint);
  } catch (err: unknown) {
    try {
      const job = loadLocalJob(userIdHint!, jobId);
      if (job && job.stage !== "done") {
        job.stage = "error";
        job.error = (err instanceof Error ? err.message : "render failed").slice(0, 300);
        job.log.push(stamp(jobId, `Errore: ${job.error}`));
        saveLocalJob(job);
      }
    } catch {}
  } finally {
    IN_FLIGHT.delete(jobId);
  }
}

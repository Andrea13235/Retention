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

  // ---- CUTS (real silencedetect) ----
  if (job.stage === "transcribe") {
    if (timeLeft(opts) < 5_000) return job; // resume next poll
    await touch({ stage: "cuts", progress: 55 }, "Rilevamento silenzi reali (ffmpeg silencedetect)");
    const probed = await probeMedia(job.sourcePath);
    const duration = probed?.duration ?? 60;
    const sil = await detectSilences(job.sourcePath).catch(() => []);
    const cuts = spansToCuts(sil, { mediaDuration: duration });
    const { keep, saved } = cutsToKeep(cuts, duration);
    await touch(
      {
        silences: sil.slice(0, 60),
        cuts: cuts.slice(0, 60),
        keepCount: keep.length,
        sourceDuration: Number(duration.toFixed(2)),
        timeSavedSec: saved,
        progress: 65,
      },
      cuts.length > 0
        ? `Trovati ${cuts.length} silenzi reali → rimossi ${saved.toFixed(1)}s`
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
      // M2 captions: real words → cues → remap to FINAL timeline.
      let finalCues: Array<{ start: number; end: number; text: string }> = [];
      try {
        const realWords = (job.words || []).filter(
          (w) => w && typeof w.word === "string" && w.word.length > 0 && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start
        );
        if (realWords.length > 0) {
          const { wordsToCues, remapCuesToFinal } = await import("./local-captions");
          const srcCues = wordsToCues(
            realWords.map((w) => ({ word: w.word, start: w.start, end: w.end, confidence: 1 })),
            6
          );
          finalCues = remapCuesToFinal(srcCues, keep);
        }
      } catch {}
      let fontStatus = "fallback";
      try {
        fontStatus = (await import("./local-captions")).captionFontStatus();
      } catch {}
      await touch(
        { captions: finalCues.slice(0, 400), progress: 78 },
        finalCues.length > 0 ? `Caption reali: ${finalCues.length} cue da parole trascritte (font ${fontStatus})` : "Nessuna caption (STT assente)"
      );
      // M3 zoom: real scene cuts → remap to FINAL → plan windows.
      let finalZooms: Array<{ finalStart: number; finalEnd: number; peak: number }> = [];
      try {
        const { detectScenes, remapScenesToFinal, planZooms } = await import("./local-scenes");
        const scenes = await detectScenes(job.sourcePath).catch(() => []);
        const finalSceneTimes = remapScenesToFinal(scenes, keep);
        const finalDur = keep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
        finalZooms = planZooms(finalSceneTimes, finalDur);
        await touch(
          { scenes: scenes.slice(0, 60), zooms: finalZooms, progress: 80 },
          scenes.length > 0
            ? `Scene reali: ${scenes.length} stacchi → ${finalZooms.length} zoom dinamici`
            : "Nessuno stacco reale — nessuno zoom (single-take)"
        );
      } catch {
        await touch({ scenes: [], zooms: [], progress: 80 }, "Scene detect non disponibile — nessuno zoom");
      }
      // M4 RetentionVolt: real reference match (own DB, read-only, ~0 cost).
      // NEVER decides cuts — only adds pacing zooms where local found none.
      try {
        const { findVoltMatch, voltZoomsFromMatch } = await import("./retentionvolt-client");
        const transcriptText = (job.segments || []).map((s) => s.text).join(" ").slice(0, 4000);
        const match = await findVoltMatch({ format: job.format, transcriptText });
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
      // M7 B-roll SUBMIT: ONE Higgsfield SOUL image (only generator).
      // Submit once → persist `soul` → later polls resume via pollSoulImage.
      // Prompt from transcript keywords (never invented text). Window: mid-video
      // 3.5s, kept clear of cut boundaries by construction (center of longest keep).
      // Fail-soft: any error → broll null (video still ships without it).
      try {
        const { submitSoulImage, higgsfieldConfigured } = await import("./higgsfield-soul");
        const finalDur = keep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
        if (job.soul) {
          // Already submitted in a previous invocation — polling happens below.
        } else if (higgsfieldConfigured() && finalDur >= 6) {
          // Longest keep wins → safest window for a 3.5s fullscreen overlay.
          const longest = [...keep].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
          // Map longest-keep SOURCE time to FINAL time (offset of keeps before it).
          const idx = keep.indexOf(longest);
          const finalOffset = keep.slice(0, idx).reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
          const keepLen = longest.end - longest.start;
          const bDur = Math.min(3.5, Math.max(1.5, keepLen - 1.0));
          const srcStart = longest.start + Math.max(0.5, (keepLen - bDur) / 2);
          const finalStart = Number((finalOffset + (srcStart - longest.start)).toFixed(2));
          // Prompt: transcript keywords in the window (real words only).
          const winWords = (job.words || [])
            .filter((w) => w.start >= srcStart - 2 && w.start <= srcStart + bDur + 2)
            .map((w) => w.word);
          const kw = winWords
            .map((w) => w.toLowerCase().replace(/[^a-zà-ÿ']/g, ""))
            .filter((w) => w.length > 3 && !/^(this|that|with|from|have|has|are|was|were|very|just|like|know|cosa|come|della|nella|sono|molto|molti|anche|quando|questo|questa|nella|perch|quindi)$/.test(w));
          const uniq = [...new Set(kw)].slice(0, 5);
          const topic = uniq.length > 0 ? uniq.join(", ") : ((job.segments || []).map((s) => s.text).join(" ").slice(0, 120) || "creator talking to camera");
          const brollPrompt = `cinematic photorealistic illustration of ${topic.slice(0, 160)}, warm cinematic light, high detail, no text, no watermark`;
          await touch({ progress: 84 }, `Higgsfield SOUL: genero B-roll (“${topic.slice(0, 50)}…”)`);
          const pending = await submitSoulImage({
            prompt: brollPrompt,
            aspectRatio: job.format === "short" ? "9:16" : "16:9",
          }).catch(() => null);
          if (pending) {
            await touch(
              {
                soul: {
                  requestId: pending.requestId,
                  prompt: pending.prompt,
                  aspectRatio: pending.aspectRatio,
                  finalStart,
                  finalEnd: Number((finalStart + bDur).toFixed(2)),
                  brollPrompt,
                },
                soulSubmittedAt: Date.now(),
                progress: 85,
              },
              "B-roll sottomesso — controllo avanzamento al prossimo poll"
            );
          } else {
            await touch({ broll: null, soul: null, progress: 88 }, "Higgsfield non disponibile — video senza B-roll");
          }
        } else {
          await touch({ broll: null, soul: null, progress: 88 }, finalDur < 6 ? "Video troppo breve per B-roll — solo tagli/caption/zoom" : "Higgsfield non configurato — video senza B-roll");
        }
      } catch {
        await touch({ broll: null, soul: null, progress: 88 }, "B-roll non disponibile — video senza B-roll");
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
      if (!job.soul) {
        if (timeLeft(opts) < 5_000) return job;
        await finalizeFromBase(job, jobId, keep, null, touch);
        return job;
      }

      // Pending SOUL → single status check (cheap GET, resumable).
      // Fail-soft timeout: SOUL 720p ≈ 40s; se dopo 6 minuti non è pronto,
      // consegna la base (video reale montato) invece di restare al 91%.
      const SOUL_FAILSOFT_MS = 6 * 60_000;
      const soulWaited = Date.now() - (job.soulSubmittedAt || Date.now());
      const { pollSoulImage } = await import("./higgsfield-soul");
      const jobDir = path.dirname(localFilePath(job, "final"));
      const outPng = path.join(jobDir, "broll_soul.png");
      const got = await pollSoulImage(
        { requestId: job.soul.requestId, prompt: job.soul.prompt, aspectRatio: job.soul.aspectRatio },
        outPng,
        90_000 // SOUL 720p ≈ 40s di generazione: un singolo poll deve poter aspettare
      ).catch(() => ({ done: false as const }));
      if (!got.done) {
        if (soulWaited > SOUL_FAILSOFT_MS) {
          await touch(
            { broll: null, soul: null, progress: 94 },
            "Higgsfield troppo lento (>6 min) — consegno il video senza B-roll"
          );
          // Fall through to finalizeFromBase with overlay=null below.
        } else {
          await touch({ progress: 91 }, "Higgsfield sta generando — ricontrollo al prossimo poll");
          return job;
        }
      } else if (got.done && got.image) {
        const s = job.soul;
        await touch(
          {
            broll: { localPath: got.image.localPath, finalStart: s.finalStart, finalEnd: s.finalEnd, prompt: s.brollPrompt, bytes: got.image.bytes },
            soul: null,
            progress: 94,
          },
          `B-roll Higgsfield pronto (${(got.image.bytes / 1048576).toFixed(1)}MB, ${(s.finalEnd - s.finalStart).toFixed(1)}s da t=${s.finalStart}s)`
        );
        // Persist PNG to R2 — finalize may run on another instance (/tmp is per-instance).
        try {
          const { persistBroll } = await import("./local-jobs-r2");
          await persistBroll(job, got.image.localPath);
        } catch {}
      } else {
        await touch({ broll: null, soul: null, progress: 94 }, "Higgsfield fallito — video senza B-roll");
      }

      if (timeLeft(opts) < 8_000) return job; // finalize next poll
      const b = job.broll;
      // Re-materialize the PNG when this invocation runs on another instance.
      let overlay: { imagePath: string; finalStart: number; finalEnd: number } | null = null;
      if (b) {
        try {
          const { ensureBrollLocal } = await import("./local-jobs-r2");
          const local = await ensureBrollLocal(job);
          if (local) overlay = { imagePath: local, finalStart: b.finalStart, finalEnd: b.finalEnd };
          else {
            await touch({ broll: null, progress: 94 }, "B-roll non recuperabile — video senza B-roll");
          }
        } catch {
          overlay = null;
        }
        // Last-resort local path (single-instance flows without R2).
        if (!overlay) {
          try {
            const { existsSync } = await import("node:fs");
            if (existsSync(b.localPath)) overlay = { imagePath: b.localPath, finalStart: b.finalStart, finalEnd: b.finalEnd };
          } catch {}
        }
      }
      await finalizeFromBase(job, jobId, keep, overlay, touch);
      return job;
    }

    return job;
}

/**
 * Finalize: re-render base timeline + broll overlay → final.mp4 / cover.jpg → done.
 * Base render already proved the timeline; this adds the Ken Burns overlay.
 */
async function finalizeFromBase(
  job: LocalJob,
  jobId: string,
  keep: Array<{ start: number; end: number }>,
  brollOverlay: { imagePath: string; finalStart: number; finalEnd: number } | null,
  touch: (patch: Partial<LocalJob>, log?: string) => Promise<void>
): Promise<void> {
  const outDir = path.dirname(localFilePath(job, "final"));
  const res = await renderLocalCut({
    sourcePath: job.sourcePath,
    keep,
    format: job.format,
    outDir,
    basename: "edit",
    captions: job.captions ?? [],
    zooms: job.zooms ?? [],
    brolls: brollOverlay ? [brollOverlay] : [],
  });
  // Normalize filenames to final.mp4 / cover.jpg
  const finalDst = localFilePath(job, "final");
  const coverDst = localFilePath(job, "cover");
  if (res.mp4Path !== finalDst && existsSync(res.mp4Path)) copyFileSync(res.mp4Path, finalDst);
  if (res.coverPath !== coverDst && existsSync(res.coverPath)) copyFileSync(res.coverPath, coverDst);
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
    `Pronto: MP4 ${(res.bytes / 1048576).toFixed(1)}MB, ${res.durationSec}s (risparmiati ${res.timeSavedSec}s${res.captionsBurned > 0 ? `, ${res.captionsBurned} caption` : ""}${res.zoomsApplied > 0 ? `, ${res.zoomsApplied} zoom` : ""}${res.brollsApplied > 0 ? `, ${res.brollsApplied} B-roll Higgsfield` : ""})`
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

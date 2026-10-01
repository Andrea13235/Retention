/**
 * tools_similarity.ts — Video Similarity Engine per RetentionVolt.
 * Estrae il VideoStructureProfile dal NarrativeStructure (output di analyze_transcript)
 * e prepara i parametri per la query find_similar_video all'API RetentionVolt.
 */
import type { NarrativeStructure } from "./types.js";
import type { VideoStructureProfile, SimilarVideoResult } from "./types.js";
import { timecodeToSec } from "./types.js";

/**
 * Estrae il VideoStructureProfile dall'output di analyze_transcript.
 * Tutti i campi sono deterministici — nessuna IA coinvolta.
 */
export function extractStructureProfile(structure: NarrativeStructure): VideoStructureProfile {
  const hookDuration = structure.hook
    ? timecodeToSec(structure.hook.end) - timecodeToSec(structure.hook.start)
    : 0;

  const sections = structure.sections ?? [];
  const sectionsCount = sections.length;
  const avgSectionLength =
    sectionsCount > 0
      ? sections.reduce((sum, s) => sum + (timecodeToSec(s.end) - timecodeToSec(s.start)), 0) / sectionsCount
      : 0;

  // Filler ratio: stima da fillers / durata totale
  const totalDuration = structure.duration_sec ?? 60;
  const fillerDuration = (structure.fillers ?? []).reduce(
    (sum, f) => sum + (timecodeToSec(f.end) - timecodeToSec(f.start)),
    0
  );
  const fillerRatio = totalDuration > 0 ? Math.min(1, fillerDuration / totalDuration) : 0;

  const attentionDipsCount = (structure.attention_dips ?? []).length;

  // Highlight density: highlights per minuto
  const highlightDensity =
    totalDuration > 0
      ? ((structure.highlights ?? []).length / totalDuration) * 60
      : 0;

  // CTA detection: cerca parole chiave CTA nell'ultima sezione
  const lastSection = sections[sections.length - 1];
  const ctaKeywords = ["subscribe", "follow", "like", "comment", "iscriviti", "link", "click", "check"];
  const ctaPresent = lastSection
    ? ctaKeywords.some((kw) => lastSection.summary?.toLowerCase().includes(kw))
    : false;

  return {
    hook_duration_sec: hookDuration,
    sections_count: sectionsCount,
    avg_section_length_sec: avgSectionLength,
    filler_ratio: fillerRatio,
    attention_dips_count: attentionDipsCount,
    highlight_density: highlightDensity,
    cta_present: ctaPresent,
    speech_wpm: structure.speech?.wpm,
    inferred_video_type: undefined, // sarà calcolato separatamente con inferVideoType()
  };
}

/**
 * Serializza il VideoStructureProfile in un vettore numerico normalizzato (dimensione 8).
 * Usato come `structure_embedding` approssimato lato client quando non si ha un modello di embedding.
 * NON è un vero embedding semantico — è un feature vector deterministico per il matching strutturale.
 * Il server RetentionVolt può usarlo direttamente nella query pgvector (cosine similarity).
 */
export function profileToVector(profile: VideoStructureProfile): number[] {
  // Normalizzazione per portare ogni dimensione approssimativamente in [0, 1]
  return [
    Math.min(profile.hook_duration_sec / 60, 1),            // hook ratio (cap 60s)
    Math.min(profile.sections_count / 10, 1),               // sections (cap 10)
    Math.min(profile.avg_section_length_sec / 300, 1),      // avg section length (cap 5min)
    profile.filler_ratio,                                    // filler ratio (già 0-1)
    Math.min(profile.attention_dips_count / 10, 1),         // dips count (cap 10)
    Math.min(profile.highlight_density / 5, 1),             // highlights/min (cap 5/min)
    profile.cta_present ? 1 : 0,                            // CTA boolean
    Math.min((profile.speech_wpm ?? 150) / 300, 1),         // speech pace (cap 300 wpm)
  ];
}

/**
 * Infers the VideoType from the transcript text and media metadata.
 * Uses keyword heuristics on the transcript — no AI needed.
 *
 * Detection priority:
 * 1. screen_share signals → 'talking_head_with_screen_share'
 * 2. multi-location/vlog signals → 'vlog'
 * 3. screencast signals (no face) → 'tutorial_screencast'
 * 4. podcast signals (multi-person dialogue) → 'podcast'
 * 5. Default → 'talking_head'
 */
export function inferVideoType(
  transcriptText: string,
  opts?: { isPortrait?: boolean; durationSec?: number }
): import("./types.js").VideoType {
  const text = transcriptText.toLowerCase();

  // Screen share signals — tech/tutorial content with screen interaction
  const screenShareSignals = [
    "vedi qui", "vedi qua", "guarda qui", "apro", "clicco", "click",
    "schermo", "vi mostro lo schermo", "condivido lo schermo",
    "see here", "i'll show you", "on screen", "let me open", "i'm clicking",
    "i'll navigate", "on my screen", "over here on the screen",
    "let me share", "you can see here", "as you can see on screen"
  ];
  const screenShareScore = screenShareSignals.filter(s => text.includes(s)).length;
  if (screenShareScore >= 2) return "talking_head_with_screen_share";

  // Vlog signals — location changes, movement, outdoor
  const vlogSignals = [
    "siamo qui", "sono qui", "arriviamo", "andiamo", "stiamo andando",
    "we're here", "we arrived", "let's go", "we're going to", "on the road",
    "behind me you can see", "as you can see behind me", "we just got to",
    "dietro di me", "come vedete sono", "vi porto con me"
  ];
  const vlogScore = vlogSignals.filter(s => text.includes(s)).length;
  if (vlogScore >= 2) return "vlog";

  // Screencast signals — screen only, no talking head
  const screencastSignals = [
    "in this tutorial", "in questo tutorial", "step by step", "passo dopo passo",
    "open your terminal", "apri il terminale", "type the following", "digita",
    "install", "installa", "configure", "configura",
    "run the command", "esegui il comando"
  ];
  const screencastScore = screencastSignals.filter(s => text.includes(s)).length;
  // Only screencast if also long-form (>= 5 min)
  if (screencastScore >= 3 && (opts?.durationSec ?? 0) >= 300) return "tutorial_screencast";

  // Podcast signals — conversational, multi-person
  const podcastSignals = [
    "ospite", "guest", "benvenuto", "welcome to the show", "welcome to the podcast",
    "today i have", "oggi ho con me", "let me introduce", "vi presento",
    "what do you think about", "cosa pensi di", "interview", "intervista"
  ];
  const podcastScore = podcastSignals.filter(s => text.includes(s)).length;
  // Podcast also needs long duration (>= 10 min)
  if (podcastScore >= 2 && (opts?.durationSec ?? 0) >= 600) return "podcast";

  // Default: standard talking head
  return "talking_head";
}

/**
 * Genera il messaggio human-readable che l'agente mostrerà all'utente.
 * Il messaggio è in italiano se il video è in italiano, inglese altrimenti.
 */
export function buildAgentMessage(
  matches: SimilarVideoResult["matches"],
  language: string
): string {
  if (matches.length === 0) return "";
  const top = matches[0];
  const pct = Math.round(top.similarity_score * 100);
  const retention = top.avg_retention_pct ? `${Math.round(top.avg_retention_pct)}% retention` : "";
  const views = top.views_count ? `${(top.views_count / 1_000_000).toFixed(1)}M views` : "";
  const stats = [retention, views].filter(Boolean).join(", ");

  if (language === "it") {
    return (
      `🎯 **Video di riferimento trovato nel database RetentionVolt!**\n\n` +
      `**"${top.title}" — ${top.creator}** (similarità: ${pct}%)\n` +
      (stats ? `- Performance: ${stats}\n` : "") +
      `\nUso il suo blueprint per il montaggio del tuo video.` +
      (matches.length > 1
        ? `\n\n*(Altri ${matches.length - 1} video simili trovati — puoi chiedere di vederne altri.)*`
        : "")
    );
  }

  return (
    `🎯 **Reference video found in the RetentionVolt database!**\n\n` +
    `**"${top.title}" — ${top.creator}** (similarity: ${pct}%)\n` +
    (stats ? `- Performance: ${stats}\n` : "") +
    `\nUsing its blueprint for your video edit.` +
    (matches.length > 1
      ? `\n\n*(${matches.length - 1} more similar video${matches.length > 2 ? "s" : ""} found — ask to see more.)*`
      : "")
  );
}

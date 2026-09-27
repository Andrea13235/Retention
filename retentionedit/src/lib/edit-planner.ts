import {
  EditPlan,
  GenAIBRoll,
  GenAITier,
  MetaMuseTranscript,
  NarrativeAnalysis,
  RetentionBlueprint,
  VideoFormat,
  WordTimestamp,
} from "./types";
import { NativeRetentionVolt } from "./retentionvolt-native";

export class EditPlanner {
  /**
   * Builds the machine-actionable EditPlan v1.3.
   * Adheres to broadcast quality gates and safe area standards.
   */
  public static generatePlan(params: {
    format: VideoFormat;
    tier: GenAITier;
    transcript: MetaMuseTranscript;
    analysis: NarrativeAnalysis;
    blueprint: RetentionBlueprint;
    brolls: GenAIBRoll[];
  }): EditPlan {
    const { format, tier, transcript, analysis, blueprint, brolls } = params;

    // 1. Calculate cuts: inverted keep intervals
    const cuts = analysis.cut_candidates.map((c) => ({
      start: c.start,
      end: c.end,
      keep: false,
    }));

    const sourceDuration = transcript.duration_sec;
    const targetDuration = Math.max(1, sourceDuration - analysis.dead_air_sec);

    // 2. Safe blueprint adaptation (Cuts First)
    const adaptedEvents = NativeRetentionVolt.adaptBlueprintToTimeline(blueprint, targetDuration, cuts);

    // 3. Extract Zooms and Punches across the ENTIRE duration
    const zooms = adaptedEvents
      .filter((e) => e.type === "zoom")
      .map((e) => ({
        time: e.at_sec,
        type: e.sub_type || "zoom_punch",
        scale: (e.parameters?.scale as number) || 1.15,
        duration: (e.parameters?.duration as number) || 0.8,
      }));

    // Ensure rhythmic punch zooms occur throughout the ENTIRE timeline (every 2.8 - 3.8s)
    let zoomCursor = 1.0;
    while (zoomCursor < targetDuration - 1.2) {
      const alreadyHasZoom = zooms.some((z) => Math.abs(z.time - zoomCursor) < 1.8);
      if (!alreadyHasZoom) {
        const isBigPunch = zooms.length % 2 === 0;
        zooms.push({
          time: Number(zoomCursor.toFixed(2)),
          type: isBigPunch ? "zoom_punch" : "slow_zoom",
          scale: isBigPunch ? 1.18 : 1.14,
          duration: isBigPunch ? 0.75 : 1.5,
        });
      }
      zoomCursor += 3.2;
    }
    zooms.sort((a, b) => a.time - b.time);

    // 4. Extract and Generate RetentionVolt TOP Motion Graphics
    const graphics: EditPlan["graphics"] = [];

    // Add events from adapted blueprint
    for (const e of adaptedEvents) {
      if (e.type === "graphic") {
        graphics.push({
          time: Number(e.at_sec.toFixed(2)),
          duration: (e.parameters?.duration as number) || 3.0,
          type: e.sub_type || "act_title_banner",
          text: e.label || "KEY TAKEAWAY",
          position: (e.parameters?.position as "top" | "center" | "bottom") || "top",
          tag: (e.parameters?.tag as string) || "VIRAL HOOK",
          icon: (e.parameters?.icon as string) || "⚡",
          subtitle: (e.parameters?.subtitle as string) || "Curva di Ritenzione Virale",
          isScreen: e.sub_type === "screen_overlay",
        });
      }
    }

    // Ensure content-aware TOP banners throughout the entire video (Retention skill specification)
    const targetGfxTimes = [
      { t: 0.8, dur: 3.2, tag: "VIRAL HOOK", icon: "⚡", text: blueprint.thumbnail.title || "IL SEGRETO DELLA RITENZIONE", sub: "Pacing & Pattern Interrupts 2026", type: "act_title_banner" },
      { t: 9.0, dur: 3.2, tag: "METRICA CHIAVE", icon: "📈", text: "+300% WATCH TIME", sub: "Ritmo Serrato e Jump Cuts Decisi", type: "number_stat" },
      { t: 17.5, dur: 3.4, tag: "AI WORKFLOW", icon: "🤖", text: "RETENTIONVOLT ENGINE", sub: "Blueprints Reverse-Engineered", type: "screen_overlay" },
      { t: 26.0, dur: 3.0, tag: "KEY TAKEAWAY", icon: "💡", text: "ZERO TEMPI MORTI", sub: "Massimizza la Visione e la Retention", type: "act_title_banner" },
    ];

    for (const def of targetGfxTimes) {
      if (def.t < targetDuration - 2.0) {
        const overlaps = graphics.some((g) => Math.abs(g.time - def.t) < 4.5);
        const nearCut = cuts.some((c) => Math.abs(c.start - def.t) < 0.8 || Math.abs(c.end - def.t) < 0.8);
        if (!overlaps && !nearCut) {
          graphics.push({
            time: Number(def.t.toFixed(2)),
            duration: def.dur,
            type: def.type,
            text: def.text,
            position: "top",
            tag: def.tag,
            icon: def.icon,
            subtitle: def.sub,
            isScreen: def.type === "screen_overlay",
          });
        }
      }
    }
    graphics.sort((a, b) => a.time - b.time);

    // 5. Build Word Timestamps for Captions (Filtered by CUTS + Keyword Emphasis)
    const EMPHASIS_KEYWORDS = new Set([
      "segreto", "esplosivo", "sbaglia", "attenzione", "raddoppia", "decollare", "valore", "subito",
      "ritenzione", "risultato", "guarda", "300%", "incredibile", "mai", "soldi", "fondamentale"
    ]);

    const allWords: WordTimestamp[] = [];
    for (const seg of transcript.segments) {
      for (const w of seg.words) {
        // Skip words inside cut segments
        const isCut = cuts.some((c) => w.start >= c.start && w.end <= c.end);
        if (!isCut) {
          const clean = w.word.toLowerCase().replace(/[^a-z0-9%]/g, "");
          allWords.push({
            ...w,
            emphasis: w.emphasis || EMPHASIS_KEYWORDS.has(clean),
          });
        }
      }
    }

    // 6. Demonstrative Visual Shots and PiP Setup
    const shots: EditPlan["shots"] = [
      {
        start: 0,
        end: Number(targetDuration.toFixed(2)),
        type: "talking_head_fullscreen",
      },
    ];

    if (targetDuration >= 20) {
      const pipStart = Math.min(13.5, targetDuration * 0.42);
      const pipDur = Math.min(5.5, targetDuration - pipStart - 2.5);
      if (pipDur >= 3.0) {
        shots.push({
          start: Number(pipStart.toFixed(2)),
          end: Number((pipStart + pipDur).toFixed(2)),
          type: "pip_talking_head_on_screen",
          title: "DEMONSTRATIVE WORKSPACE",
          subtitle: "Analisi Dinamica del Grafico di Ritenzione",
          pip_position: "bottom_right",
        });
      }
    }

    // 7. Safe Area Placement: 18% bottom for 9:16 Shorts/TikToks, 10% for 16:9
    const bottomPct = format === "short" ? 18 : 10;

    return {
      version: "1.3",
      format,
      genai_tier: tier,
      source_duration: Number(sourceDuration.toFixed(2)),
      target_duration: Number(targetDuration.toFixed(2)),
      cuts,
      shots,
      zooms,
      graphics,
      captions: {
        style: "karaoke_bold",
        words: allWords,
        bottom_pct: bottomPct,
      },
      brolls,
      thumbnail: {
        title: blueprint.thumbnail.title,
        badge: blueprint.thumbnail.badge,
        style: blueprint.thumbnail.style,
        frame_time: blueprint.thumbnail.frame_time,
      },
    };
  }
}

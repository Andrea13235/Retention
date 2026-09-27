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

    // 4. Extract Graphics and Banners
    const graphics = adaptedEvents
      .filter((e) => e.type === "graphic")
      .map((e) => ({
        time: e.at_sec,
        duration: (e.parameters?.duration as number) || 3.0,
        type: e.sub_type || "act_title_banner",
        text: e.label || "KEY TAKEAWAY",
        position: (e.parameters?.position as "top" | "center" | "bottom") || "top",
      }));

    // 5. Build Word Timestamps for Captions
    const allWords: WordTimestamp[] = [];
    for (const seg of transcript.segments) {
      for (const w of seg.words) {
        // Skip words inside cut segments
        const isCut = cuts.some((c) => w.start >= c.start && w.end <= c.end);
        if (!isCut) {
          allWords.push(w);
        }
      }
    }

    // 6. Safe Area Placement: 18% bottom for 9:16 Shorts/TikToks, 10% for 16:9
    const bottomPct = format === "short" ? 18 : 10;

    return {
      version: "1.3",
      format,
      genai_tier: tier,
      source_duration: Number(sourceDuration.toFixed(2)),
      target_duration: Number(targetDuration.toFixed(2)),
      cuts,
      shots: [
        {
          start: 0,
          end: Number(targetDuration.toFixed(2)),
          type: "talking_head_fullscreen",
        },
      ],
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

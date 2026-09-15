/**
 * tools_plan.ts — Step 4: generazione Action Plan (spec §4).
 * Trasforma la NarrativeStructure in EditPlan machine-actionable:
 * cuts, animations, broll, pattern_interrupts.
 */
import {
  secToTimecode,
  timecodeToSec,
  type EditPlan,
  type NarrativeStructure,
} from "./types.js";

export type StylePreset =
  | "youtube_talking_head"
  | "podcast"
  | "short_form";

export interface PlanOptions {
  style?: StylePreset;
  /** Ogni quanti secondi un pattern interrupt (default per stile). */
  interruptEverySec?: number;
  /** Sorgenti b-roll disponibili (path). */
  brollSources?: string[];
}

const DEFAULT_INTERRUPT: Record<StylePreset, number> = {
  youtube_talking_head: 25,
  podcast: 60,
  short_form: 4,
};

export function generateEditPlan(
  structure: NarrativeStructure,
  opts: PlanOptions = {}
): EditPlan {
  const style = opts.style ?? "youtube_talking_head";
  const every = opts.interruptEverySec ?? DEFAULT_INTERRUPT[style];
  const endSec = timecodeToSec(
    structure.sections[structure.sections.length - 1]?.end ??
      structure.hook.end
  );

  // Cuts: tieni hook + sezioni, taglia filler e dips.
  // Il piano elenca i segmenti da TENERE (start/end + motivo).
  const cuts: EditPlan["cuts"] = [
    {
      start: structure.hook.start,
      end: structure.hook.end,
      reason: "hook iniziale",
    },
    ...structure.sections.map((s) => ({
      start: s.start,
      end: s.end,
      reason: s.title,
    })),
  ];
  for (const f of structure.fillers) {
    cuts.push({ start: f.start, end: f.end, reason: `TAGLIARE — ${f.reason}` });
  }

  // Animations: caption sugli highlight + zoom sui dips (per risvegliare).
  const animations: EditPlan["animations"] = [
    ...structure.highlights.slice(0, 10).map((h) => ({
      time: h.start,
      type: "caption" as const,
      content: "IDEA CHIAVE",
      position: "bottom" as const,
    })),
    ...structure.attention_dips.slice(0, 10).map((d) => ({
      time: d.start,
      type: "zoom_in" as const,
      target: "face",
    })),
  ];

  // B-roll: distribuisci le sorgenti sulle sezioni centrali.
  const broll: EditPlan["broll"] = [];
  const sources = opts.brollSources ?? [];
  if (sources.length > 0 && structure.sections.length > 1) {
    structure.sections.slice(1, -1).forEach((s, i) => {
      const sStart = timecodeToSec(s.start);
      const sEnd = timecodeToSec(s.end);
      if (sEnd - sStart >= 8) {
        broll.push({
          start: secToTimecode(sStart + 2),
          end: secToTimecode(Math.min(sStart + 12, sEnd)),
          source: sources[i % sources.length],
        });
      }
    });
  }

  // Pattern interrupts a cadenza regolare.
  const pattern_interrupts: EditPlan["pattern_interrupts"] = [];
  for (let t = every; t < endSec; t += every) {
    pattern_interrupts.push({
      time: secToTimecode(t),
      kind: style === "short_form" ? "caption_pop" : "zoom_punch",
      detail: `interrupt ogni ~${every}s`,
    });
  }

  return {
    version: "1.0",
    style,
    media_id: structure.media_id,
    cuts,
    animations,
    broll,
    pattern_interrupts,
  };
}

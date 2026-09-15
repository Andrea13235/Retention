/**
 * tools_plan.ts — Step 4: Action Plan generation.
 * Turns the NarrativeStructure into a machine-actionable EditPlan:
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
  /** Pattern-interrupt cadence in seconds (default per style). */
  interruptEverySec?: number;
  /** Available b-roll sources (paths). */
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

  // Cuts: keep hook + sections, cut fillers and dips.
  // The plan lists segments to KEEP (start/end + reason).
  const cuts: EditPlan["cuts"] = [
    {
      start: structure.hook.start,
      end: structure.hook.end,
      reason: "opening hook",
    },
    ...structure.sections.map((s) => ({
      start: s.start,
      end: s.end,
      reason: s.title,
    })),
  ];
  for (const f of structure.fillers) {
    cuts.push({ start: f.start, end: f.end, reason: `CUT — ${f.reason}` });
  }

  // Animations: captions on highlights + zoom-ins on dips (to re-engage).
  const animations: EditPlan["animations"] = [
    ...structure.highlights.slice(0, 10).map((h) => ({
      time: h.start,
      type: "caption" as const,
      content: "KEY INSIGHT",
      position: "bottom" as const,
    })),
    ...structure.attention_dips.slice(0, 10).map((d) => ({
      time: d.start,
      type: "zoom_in" as const,
      target: "face",
    })),
  ];

  // B-roll: spread sources across middle sections.
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

  // Pattern interrupts on a regular cadence.
  const pattern_interrupts: EditPlan["pattern_interrupts"] = [];
  for (let t = every; t < endSec; t += every) {
    pattern_interrupts.push({
      time: secToTimecode(t),
      kind: style === "short_form" ? "caption_pop" : "zoom_punch",
      detail: `interrupt every ~${every}s`,
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

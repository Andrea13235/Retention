import { describe, expect, it } from "vitest";
import { inferVideoType, buildAgentMessage } from "../src/tools_similarity.js";
import { findSimilarVideo } from "../src/retentionvolt_client.js";
import { generateEditPlan } from "../src/tools_plan.js";
import type { NarrativeStructure, RetentionVoltBlueprint } from "../src/types.js";

describe("inferVideoType", () => {
  it("detects talking_head_with_screen_share from screen interaction signals", () => {
    const text = "Ciao a tutti, oggi vi mostro lo schermo del mio computer e vedi qui cosa succede.";
    expect(inferVideoType(text)).toBe("talking_head_with_screen_share");
  });

  it("detects vlog from movement/outdoor signals", () => {
    const text = "Oggi siamo qui per una nuova avventura, andiamo a esplorare questa città.";
    expect(inferVideoType(text)).toBe("vlog");
  });

  it("detects tutorial_screencast from terminal/install cues with long duration", () => {
    const text = "In questo tutorial passo dopo passo apri il terminale ed esegui il comando install.";
    expect(inferVideoType(text, { durationSec: 400 })).toBe("tutorial_screencast");
  });

  it("detects podcast from conversational cues with long duration", () => {
    const text = "Oggi abbiamo un ospite speciale, benvenuto nel podcast, cosa ne pensi del futuro dell'AI?";
    expect(inferVideoType(text, { durationSec: 700 })).toBe("podcast");
  });

  it("defaults to talking_head when no special cues are present", () => {
    const text = "Oggi voglio raccontarvi i 3 principi chiave della produttività personale.";
    expect(inferVideoType(text)).toBe("talking_head");
  });
});

describe("buildAgentMessage", () => {
  it("formats Italian message with retention stats and percentage", () => {
    const message = buildAgentMessage(
      [
        {
          video_id: "test-id",
          creator: "Ali Abdaal",
          title: "My Notion Setup",
          niche: "productivity",
          video_type: "talking_head",
          format: "long",
          language: "it",
          duration_sec: 600,
          similarity_score: 0.88,
          avg_retention_pct: 71,
          views_count: 1500000,
          rank: 1,
          blueprint: {},
        },
      ],
      "it"
    );

    expect(message).toContain("🎯 **Video di riferimento trovato nel database RetentionVolt!**");
    expect(message).toContain("Ali Abdaal");
    expect(message).toContain("88%");
    expect(message).toContain("71% retention");
    expect(message).toContain("1.5M views");
  });

  it("formats English message correctly", () => {
    const message = buildAgentMessage(
      [
        {
          video_id: "test-id",
          creator: "MrBeast",
          title: "Surviving 7 Days",
          niche: "entertainment",
          video_type: "talking_head",
          format: "long",
          language: "en",
          duration_sec: 900,
          similarity_score: 0.92,
          rank: 1,
          blueprint: {},
        },
      ],
      "en"
    );

    expect(message).toContain("🎯 **Reference video found in the RetentionVolt database!**");
    expect(message).toContain("MrBeast");
    expect(message).toContain("92%");
  });
});

describe("findSimilarVideo offline fallback", () => {
  it("returns fallback blueprint safely with zero lock when unauthenticated or network unreachable", async () => {
    const res = await findSimilarVideo("Questo è un video di test senza connessione", {
      format: "short",
      language: "it",
      niche: "tech",
      endpoint: "http://127.0.0.1:1/invalid",
    });

    expect(res).toBeDefined();
    expect(res.source).toBe("local_fallback");
    expect(res.high_confidence).toBe(false);
    expect(res.best_blueprint).toBeDefined();
    expect(res.best_blueprint.thumbnail).toBeDefined();
  });
});

describe("generateEditPlan with Blueprint events", () => {
  const dummyStructure: NarrativeStructure = {
    media_id: "m-test",
    duration_sec: 60,
    hook: { start: "00:00:00.000", end: "00:00:05.000", summary: "Hook" },
    sections: [
      { index: 1, start: "00:00:00.000", end: "00:00:30.000", summary: "Intro" },
      { index: 2, start: "00:00:30.000", end: "00:01:00.000", summary: "Details" },
    ],
    fillers: [],
    attention_dips: [],
    highlights: [],
    cut_candidates: [],
    needs_review: [],
  };

  it("applies blueprint events, creates shots, and sets retentionvolt_applied to true", () => {
    const bp: RetentionVoltBlueprint = {
      pattern_id: "viral-tech-01",
      events: [
        {
          at_sec: 2,
          type: "shot",
          shot_type: "screen_share_fullscreen",
          duration_sec: 5,
        },
        {
          at_sec: 10,
          type: "zoom",
          kind: "slow_zoom",
          direction: "in",
          duration_sec: 4,
        },
      ],
    };

    const plan = generateEditPlan(dummyStructure, {
      retentionvoltBlueprint: bp,
    });

    expect(plan.retentionvolt_applied).toBe(true);
    expect(plan.shots).toBeDefined();
    expect(plan.shots?.length).toBeGreaterThan(0);
    expect(plan.shots?.[0].shot_type).toBe("screen_share_fullscreen");
  });

  it("injects contextual graphics and animations from blueprint events", () => {
    const bp: RetentionVoltBlueprint = {
      pattern_id: "viral-tech-02",
      events: [
        {
          at_sec: 5,
          type: "animation",
          text_source: "Intro Context",
          duration_sec: 3,
        },
        {
          at_sec: 32,
          type: "graphic",
          graphic_kind: "act_title_banner",
          section_index: 2,
          duration_sec: 3,
        },
        {
          at_sec: 45,
          type: "graphic",
          graphic_kind: "caption_pop",
        },
      ],
    };

    const plan = generateEditPlan(dummyStructure, {
      retentionvoltBlueprint: bp,
    });

    expect(plan.retentionvolt_applied).toBe(true);
    expect(plan.animations.some((a) => a.type === "lower_third")).toBe(true);
    expect(plan.graphics?.some((g) => g.kind === "act_title")).toBe(true);
    expect(plan.pattern_interrupts.some((p) => p.kind === "caption_pop")).toBe(true);
  });
});

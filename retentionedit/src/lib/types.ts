export type VideoFormat = "short" | "long";

export type GenAITier = "eco" | "balanced" | "cinematic";

export type StageId =
  | "ingest"
  | "transcribe"
  | "analyze"
  | "retentionvolt"
  | "plan"
  | "render"
  | "verify";

export type StageState = "pending" | "running" | "completed" | "failed";

export interface StageInfo {
  id: StageId;
  label: string;
  description: string;
  state: StageState;
  progress: number; // 0 - 100
  startedAt?: number;
  completedAt?: number;
  error?: string;
  details?: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
  emphasis?: boolean;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  speaker?: string;
}

export interface MetaMMSTranscript {
  provider: "meta_mms" | "meta_muse_voice";
  language: string;
  duration_sec: number;
  segments: TranscriptSegment[];
  speakers: string[];
}

export type MetaMuseTranscript = MetaMMSTranscript;

export interface CutCandidate {
  start: number;
  end: number;
  reason: "filler" | "silence" | "repetition" | "dead_air";
  confidence: number;
}

export interface NarrativeSection {
  id: string;
  name: string;
  start: number;
  end: number;
  importance: "hook" | "core" | "climax" | "cta";
}

export interface NarrativeAnalysis {
  hook: { start: number; end: number; score: number };
  sections: NarrativeSection[];
  cut_candidates: CutCandidate[];
  filler_count: number;
  dead_air_sec: number;
  estimated_time_saved_sec: number;
}

export interface BlueprintEvent {
  at_sec: number;
  type: "shot" | "zoom" | "graphic" | "caption" | "animation" | "broll";
  sub_type?: string;
  label?: string;
  parameters?: Record<string, any>;
}

export interface RetentionBlueprint {
  id: string;
  title: string;
  creator: string;
  niche: string;
  video_type: string;
  pacing_interval_sec: number;
  events: BlueprintEvent[];
  thumbnail: {
    title: string;
    badge: string;
    style: string;
    frame_time: number;
  };
}

export interface GenAIBRoll {
  id: string;
  timeline_start: number;
  timeline_end: number;
  source_url: string;
  type: "image_ken_burns" | "genai_higgsfield" | "hyperframes_motion";
  prompt: string;
  camera_motion:
    | "zoom_in_drift_right"
    | "zoom_in_drift_left"
    | "slow_pull_back"
    | "subtle_drift_up"
    | "cinematic_pan"
    | "dramatic_zoom_in"
    | "orbit_360"
    | "static";
  cost_est_usd: number;
  motion_params?: {
    scale_start: number;
    scale_end: number;
    drift_x: number;
    drift_y: number;
    ease: string;
    duration: number;
  };
}

export interface EditPlan {
  version: "1.3";
  format: VideoFormat;
  genai_tier: GenAITier;
  source_duration: number;
  target_duration: number;
  cuts: Array<{ start: number; end: number; keep: boolean }>;
  shots: Array<{ start: number; end: number; type: string; media_url?: string }>;
  zooms: Array<{ time: number; type: string; scale: number; duration: number }>;
  graphics: Array<{ time: number; duration: number; type: string; text: string; position: "top" | "center" | "bottom" }>;
  captions: {
    style: "karaoke_bold" | "clean_white" | "minimal";
    words: WordTimestamp[];
    bottom_pct: number;
  };
  brolls: GenAIBRoll[];
  thumbnail: {
    title: string;
    badge: string;
    style: string;
    frame_time: number;
  };
}

export interface QualityGateResult {
  passed: boolean;
  score: number;
  pillars: {
    beat_sync: boolean;
    safe_areas: boolean;
    typography_contrast: boolean;
    facial_clearance: boolean;
    thumbnail_magnetism: boolean;
  };
  checked_frames_count: number;
  verified_timestamp: string;
}

export interface PipelineJob {
  id: string;
  title: string;
  createdAt: number;
  format: VideoFormat;
  genaiTier: GenAITier;
  rawVideoUrl: string;
  rawDuration: number;
  currentStage: StageId | "done" | "error";
  stages: Record<StageId, StageInfo>;
  transcript?: MetaMuseTranscript;
  analysis?: NarrativeAnalysis;
  blueprint?: RetentionBlueprint;
  editPlan?: EditPlan;
  renderedVideoUrl?: string;
  thumbnailUrl?: string;
  qualityGate?: QualityGateResult;
  stats?: {
    cutsCount: number;
    timeSavedSec: number;
    retentionScore: number;
    brollCount: number;
    zoomCount: number;
  };
  logs: string[];
}

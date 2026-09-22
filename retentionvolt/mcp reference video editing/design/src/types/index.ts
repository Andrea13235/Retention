// ============================================================
// CYBERMCP / RETENTIONVOLT TYPES
// Replicating the Mobbin Reference Architecture for Video Editing
// ============================================================

export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
  logprob?: number;
}

export interface ElevenLabsTranscriptionResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words: ElevenLabsWord[];
  calculatedMetrics?: {
    totalWords: number;
    durationSeconds: number;
    wordsPerMinute: number;
    deadAirCount: number;
    deadAirTotalSec: number;
    deadAirPercentage: number;
    hookWpm: number;
  };
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  subscribers: string;
  niche: string;
}

export type VisualEventType = 
  | 'camera_angle_switch'
  | 'punch_zoom' 
  | 'slow_push_in'
  | 'slow_pull_out'
  | 'camera_drift'
  | 'jump_cut_reframe'
  | 'jump_cut' 
  | 'motion_graphic' 
  | 'b_roll' 
  | 'b_roll_cutaway'
  | 'audio_riser' 
  | 'talking_head' 
  | 'screen_recording' 
  | 'whip_pan';

export type CutType = VisualEventType;

export type MotionIntentType = 
  | 'proof_callout'
  | 'kinetic_text'
  | 'countdown_timer'
  | 'data_statistic'
  | 'comparison_table'
  | 'topic_transition'
  | 'curiosity_teaser';

export type ScreenPositionType = 'lower_third' | 'center_overlay' | 'top_banner' | 'split_screen';

export interface MotionDesignIntent {
  intent: MotionIntentType;
  recommendedDurationSec: number;
  screenPosition: ScreenPositionType;
  retentionRole: string;
}

export interface CutPoint {
  timeSeconds: number;
  label: string;
  type: VisualEventType;
  description?: string;
  scaleChange?: string; // e.g. "+15%", "100% -> 106% (Slow Push-In)", "Wide -> Close-up"
  cameraAngle?: string; // e.g. "Cam A (Frontal)", "Cam B (Side 45°)", "Top-Down"
  movementDurationSec?: number; // For slow push-ins/drifts: duration of the continuous move in seconds
  motionIntent?: MotionDesignIntent;
}

export interface Shot {
  id: string;
  videoId: string;
  shotIndex: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  cutType: CutType;
  patternId?: string;
  label: string;
  visualDescription?: string;
  transcriptSnippet?: string;
  frameImageUrl?: string;
  sfxLayer?: string;
  register?: 'clean/restrained' | 'loud/energetic' | 'documentary';
}

export interface RetentionFlow {
  id: string;
  title: string;
  objective: 'hook_0_15s' | 'problem_setup' | 'sponsor_segue' | 'outro_loop' | 'interactive_demo';
  description: string;
  videoId: string;
  creatorId: string;
  shotIds: string[];
  whyItWorks: string;
  retentionImpact: string;
}

export interface ThumbnailAnalysis {
  layoutComposition: string; // e.g. 'hero_centered_depth', 'split_screen_vs', 'rule_of_thirds', 'extreme_close_up', 'dramatic_perspective'
  focalPoint: string;
  facialExpressionAndGaze: string;
  textOverlay: {
    hasText: boolean;
    text?: string;
    wordCount: number;
    textStyle?: string;
    reason?: string;
  };
  colorPalette: string[];
  contrastRatio: string;
  curiosityTrigger: string;
  aiPromptBlueprint: string; // Production-ready prompt for Midjourney v6 / Flux / Ideogram
}

export interface VideoData {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  creator: {
    name: string;
    avatarUrl: string;
    subscribers: string;
    handle: string;
  };
  duration: string;
  durationSeconds: number;
  cpm: number; // Cuts per minute overall
  cpmIntro: number; // CPM in first 30 seconds
  averageShotLengthSec: number;
  wordsPerMinute: number;
  deadAirPercentage?: number;
  visualStimulusIntervalSec?: number; // VSI: average time between visual events / stimuli
  maxStaticHoldSec?: number; // Maximum seconds the screen remains completely unchanged
  cameraSwitchesCount?: number;
  punchZoomsCount?: number;
  slowPushInsCount?: number;
  retentionScore: number; // 0 - 100
  hookDurationSec: number;
  category: 'long_form' | 'shorts' | 'ads' | 'documentary' | 'talking_head';
  niche: 'tech' | 'productivity' | 'entertainment' | 'finance' | 'storytelling' | 'fitness' | 'science' | 'podcast' | 'filmmaking' | 'motivation';
  tags: string[];
  thumbnailUrl: string;
  thumbnailAnalysis?: ThumbnailAnalysis;
  aspectRatio: '16:9' | '9:16';
  views: string;
  editingAdvice: {
    hookTactic: string;
    bodyPacing: string;
    soundDesign: string;
    motionStyle: string;
  };
  cuts: CutPoint[];
  shots?: Shot[];
  retentionFlows?: RetentionFlow[];
  motionGraphicIds?: string[];
  transcriptRaw?: ElevenLabsWord[];
  transcriptText?: string;
  isLocked?: boolean;
}

export interface ThumbnailData {
  id: string;
  youtubeId: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  views: string;
  ctrEstimate: string;
  niche: string;
  faceEmotion: 'shock' | 'excitement' | 'curiosity' | 'serious' | 'none';
  compositionType: 'rule_of_thirds' | 'split_screen' | 'centered_face' | 'minimalist' | 'object_focus';
  colorDominant: string;
  textCountWords: number;
  tags: string[];
  analysisBreakdown: string[];
  promptMidjourney?: string;
}

export interface MotionGraphicItem {
  id: string; // e.g. MG-001
  title: string;
  register: 'clean/restrained' | 'loud/energetic' | 'documentary' | 'minimal';
  category: 'kinetic_text' | 'timer_card' | 'player_mockup' | 'transition' | 'data_viz' | '3d_metaphor' | 'breathe_loop';
  sourceCreator: string;
  sourceTimestamp: string;
  description: string;
  durationSec: number;
  rebuildFormula: string;
  codeSnippet: string;
  previewType: 'text_pop' | 'timer_ring' | 'mockup' | 'chart' | 'whip_pan';
  accentColor: string;
}

export interface VideoAuditResult {
  url: string;
  title: string;
  durationSeconds: number;
  estimatedCpm: number;
  averageShotLength: number;
  estimatedWpm: number;
  retentionScore: number;
  riskZones: { timestamp: string; issue: string; suggestion: string }[];
  positiveHighlights: string[];
  benchmarkComparison: {
    metric: string;
    yourScore: string;
    topAverage: string;
    status: 'good' | 'warning' | 'critical';
  }[];
}

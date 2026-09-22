-- ============================================================
-- CYBERMCP / RETENTIONVOLT — SUPABASE POSTGRESQL SCHEMA
-- The Mobbin Architecture for Video Editing & Motion Graphics
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. CREATORS / CHANNELS (Mobbin Level 1: App / Brand)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  platform TEXT NOT NULL DEFAULT 'youtube', -- 'youtube', 'tiktok', 'instagram'
  subscribers TEXT,
  niche TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. VIDEOS / PRODUCTIONS (Mobbin Level 2: Media Asset)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_id TEXT NOT NULL UNIQUE,
  youtube_url TEXT NOT NULL,
  title TEXT NOT NULL,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'long_form', -- 'long_form', 'shorts', 'ads', 'documentary', 'talking_head'
  aspect_ratio TEXT NOT NULL DEFAULT '16:9', -- '16:9', '9:16'
  duration TEXT NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  cpm NUMERIC NOT NULL, -- Cuts per minute overall
  cpm_intro NUMERIC NOT NULL, -- First 30s CPM
  average_shot_length_sec NUMERIC NOT NULL,
  words_per_minute NUMERIC NOT NULL,
  dead_air_percentage NUMERIC DEFAULT 0,
  visual_stimulus_interval_sec NUMERIC DEFAULT 2.5,
  max_static_hold_sec NUMERIC DEFAULT 3.0,
  camera_switches_count INT DEFAULT 0,
  punch_zooms_count INT DEFAULT 0,
  slow_push_ins_count INT DEFAULT 0,
  retention_score NUMERIC NOT NULL DEFAULT 85,
  hook_duration_sec NUMERIC DEFAULT 5,
  category TEXT NOT NULL,
  niche TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  views TEXT,
  editing_advice JSONB DEFAULT '{}'::jsonb,
  thumbnail_analysis JSONB DEFAULT '{}'::jsonb,
  transcript_text TEXT,
  transcript_raw JSONB DEFAULT '[]'::jsonb, -- ElevenLabs word-level timestamps { text, start, end, type }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. MOTION DESIGN PATTERNS (Mobbin Level 4: UI Elements / Design System)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motion_patterns (
  id TEXT PRIMARY KEY, -- e.g. 'MG-001'
  title TEXT NOT NULL,
  register TEXT NOT NULL, -- 'clean/restrained', 'loud/energetic', 'documentary', 'minimal'
  category TEXT NOT NULL, -- 'kinetic_text', 'timer_card', 'player_mockup', 'transition', 'data_viz', '3d_metaphor', 'breathe_loop'
  source_creator TEXT,
  source_timestamp TEXT,
  description TEXT NOT NULL,
  duration_sec NUMERIC NOT NULL,
  rebuild_formula TEXT NOT NULL,
  code_snippet TEXT NOT NULL,
  preview_type TEXT NOT NULL, -- 'text_pop', 'timer_ring', 'mockup', 'chart', 'whip_pan'
  accent_color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. SHOTS / SCENES (Mobbin Level 3: The Atomic "Screen" Unit)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  shot_index INT NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  cut_type TEXT NOT NULL, -- 'camera_angle_switch', 'punch_zoom', 'jump_cut_reframe', 'jump_cut', 'motion_graphic', 'b_roll', 'audio_riser', 'talking_head'
  pattern_id TEXT REFERENCES motion_patterns(id) ON DELETE SET NULL,
  camera_angle TEXT, -- 'Cam A (Front)', 'Cam B (Side 45°)', 'Top-Down'
  scale_change TEXT, -- '+15% scale', 'Wide -> Close-up'
  movement_duration_sec NUMERIC, -- Duration of smooth move in seconds for slow push-ins/drifts
  label TEXT NOT NULL,
  visual_description TEXT,
  transcript_snippet TEXT,
  frame_image_url TEXT,
  sfx_layer TEXT,
  register TEXT DEFAULT 'clean/restrained',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 5. RETENTION FLOWS (Mobbin Level 3: Flows / User Journey)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  objective TEXT NOT NULL, -- 'hook_0_15s', 'problem_setup', 'sponsor_segue', 'outro_loop'
  description TEXT NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  shot_ids UUID[] DEFAULT '{}',
  why_it_works TEXT NOT NULL,
  retention_impact TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- 6. THUMBNAILS (Visual Packaging Intelligence)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thumbnails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  creator_name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  views TEXT,
  ctr_estimate TEXT,
  niche TEXT NOT NULL,
  face_emotion TEXT NOT NULL, -- 'shock', 'excitement', 'curiosity', 'serious', 'none'
  composition_type TEXT NOT NULL, -- 'rule_of_thirds', 'split_screen', 'centered_face', 'minimalist', 'object_focus'
  color_dominant TEXT NOT NULL,
  text_count_words INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  analysis_breakdown TEXT[] DEFAULT '{}',
  prompt_midjourney TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- INDEXES FOR FAST MOBBIN-STYLE FACET SEARCH
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_niche ON videos(niche);
CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_cpm ON videos(cpm);
CREATE INDEX IF NOT EXISTS idx_videos_retention_score ON videos(retention_score);
CREATE INDEX IF NOT EXISTS idx_shots_video ON shots(video_id);
CREATE INDEX IF NOT EXISTS idx_shots_cut_type ON shots(cut_type);
CREATE INDEX IF NOT EXISTS idx_shots_pattern ON shots(pattern_id);
CREATE INDEX IF NOT EXISTS idx_retention_flows_objective ON retention_flows(objective);
CREATE INDEX IF NOT EXISTS idx_thumbnails_emotion ON thumbnails(face_emotion);
CREATE INDEX IF NOT EXISTS idx_thumbnails_composition ON thumbnails(composition_type);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE motion_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

-- Allow Public Read Access for all tables
DROP POLICY IF EXISTS "Public read creators" ON creators;
CREATE POLICY "Public read creators" ON creators FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read videos" ON videos;
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read shots" ON shots;
CREATE POLICY "Public read shots" ON shots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read motion_patterns" ON motion_patterns;
CREATE POLICY "Public read motion_patterns" ON motion_patterns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read retention_flows" ON retention_flows;
CREATE POLICY "Public read retention_flows" ON retention_flows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read thumbnails" ON thumbnails;
CREATE POLICY "Public read thumbnails" ON thumbnails FOR SELECT USING (true);

-- Allow Service Role full access
DROP POLICY IF EXISTS "Service role write creators" ON creators;
CREATE POLICY "Service role write creators" ON creators FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role write videos" ON videos;
CREATE POLICY "Service role write videos" ON videos FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role write shots" ON shots;
CREATE POLICY "Service role write shots" ON shots FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role write motion_patterns" ON motion_patterns;
CREATE POLICY "Service role write motion_patterns" ON motion_patterns FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role write retention_flows" ON retention_flows;
CREATE POLICY "Service role write retention_flows" ON retention_flows FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role write thumbnails" ON thumbnails;
CREATE POLICY "Service role write thumbnails" ON thumbnails FOR ALL USING (auth.role() = 'service_role');

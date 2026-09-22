import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { VIDEOS_DATA } from '../src/data/videos';
import { THUMBNAILS_DATA } from '../src/data/thumbnails';
import { MOTION_GRAPHICS_DATA } from '../src/data/motionGraphics';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Seeding Supabase database with Mobbin reference dataset...');

  // 1. Seed Motion Patterns (MG-001 ... MG-015)
  console.log('📦 Seeding Motion Patterns...');
  for (const pattern of MOTION_GRAPHICS_DATA) {
    const { error } = await supabase.from('motion_patterns').upsert({
      id: pattern.id,
      title: pattern.title,
      register: pattern.register,
      category: pattern.category,
      source_creator: pattern.sourceCreator,
      source_timestamp: pattern.sourceTimestamp,
      description: pattern.description,
      duration_sec: pattern.durationSec,
      rebuild_formula: pattern.rebuildFormula,
      code_snippet: pattern.codeSnippet,
      preview_type: pattern.previewType,
      accent_color: pattern.accentColor
    }, { onConflict: 'id' });

    if (error) console.error(`Error inserting pattern ${pattern.id}:`, error.message);
  }
  console.log(`✅ Seeded ${MOTION_GRAPHICS_DATA.length} motion patterns.`);

  // 2. Seed Creators and Videos
  console.log('🎬 Seeding Creators and Videos...');
  for (const vid of VIDEOS_DATA) {
    // Upsert Creator
    const { data: creator, error: cErr } = await supabase.from('creators').upsert({
      name: vid.creator.name,
      handle: vid.creator.handle,
      avatar_url: vid.creator.avatarUrl,
      platform: 'youtube',
      subscribers: vid.creator.subscribers,
      niche: vid.niche
    }, { onConflict: 'handle' }).select().single();

    if (cErr) {
      console.error(`Error inserting creator ${vid.creator.name}:`, cErr.message);
      continue;
    }

    // Upsert Video
    const { data: videoRecord, error: vErr } = await supabase.from('videos').upsert({
      youtube_id: vid.youtubeId,
      youtube_url: vid.youtubeUrl,
      title: vid.title,
      creator_id: creator.id,
      format: vid.category === 'shorts' ? 'shorts' : 'long_form',
      aspect_ratio: vid.aspectRatio,
      duration: vid.duration,
      duration_seconds: vid.durationSeconds,
      cpm: vid.cpm,
      cpm_intro: vid.cpmIntro,
      average_shot_length_sec: vid.averageShotLengthSec,
      words_per_minute: vid.wordsPerMinute,
      dead_air_percentage: vid.deadAirPercentage || 0,
      visual_stimulus_interval_sec: vid.visualStimulusIntervalSec || 2.1,
      max_static_hold_sec: vid.maxStaticHoldSec || 3.0,
      camera_switches_count: vid.cuts.filter(c => c.type === 'camera_angle_switch').length || vid.cameraSwitchesCount || 3,
      punch_zooms_count: vid.cuts.filter(c => c.type === 'punch_zoom').length || vid.punchZoomsCount || 2,
      slow_push_ins_count: vid.cuts.filter(c => c.type === 'slow_push_in' || c.type === 'slow_pull_out' || c.type === 'camera_drift').length || vid.slowPushInsCount || 0,
      retention_score: vid.retentionScore,
      hook_duration_sec: vid.hookDurationSec,
      category: vid.category,
      niche: vid.niche,
      tags: vid.tags,
      thumbnail_url: vid.thumbnailUrl,
      views: vid.views,
      editing_advice: vid.editingAdvice,
      thumbnail_analysis: vid.thumbnailAnalysis || null,
      transcript_text: vid.transcriptText || "Benchmarked video reference",
      transcript_raw: vid.transcriptRaw || []
    }, { onConflict: 'youtube_id' }).select().single();

    if (vErr) {
      console.error(`Error inserting video ${vid.title}:`, vErr.message);
      continue;
    }

    // Insert Cuts / Shots
    if (vid.cuts && vid.cuts.length > 0 && videoRecord) {
      // Clear existing shots for clean seed
      await supabase.from('shots').delete().eq('video_id', videoRecord.id);

      const shots = vid.cuts.map((cut, idx) => {
        const nextTime = idx < vid.cuts.length - 1 ? vid.cuts[idx + 1].timeSeconds : vid.durationSeconds;
        return {
          video_id: videoRecord.id,
          shot_index: idx + 1,
          start_time: cut.timeSeconds,
          end_time: nextTime,
          duration_seconds: Math.max(0.1, Math.round((nextTime - cut.timeSeconds) * 10) / 10),
          cut_type: cut.type,
          camera_angle: cut.cameraAngle || null,
          scale_change: cut.scaleChange || null,
          movement_duration_sec: cut.movementDurationSec || null,
          label: cut.label,
          visual_description: cut.description || cut.label
        };
      });

      const { error: sErr } = await supabase.from('shots').insert(shots);
      if (sErr) console.error(`Error inserting shots for ${vid.title}:`, sErr.message);
    }
  }
  console.log(`✅ Seeded ${VIDEOS_DATA.length} reference videos with full cut timelines.`);

  // 3. Seed Thumbnails
  console.log('🖼️ Seeding Thumbnails...');
  for (const thumb of THUMBNAILS_DATA) {
    const { error: tErr } = await supabase.from('thumbnails').upsert({
      youtube_id: thumb.youtubeId,
      title: thumb.title,
      creator_name: thumb.creator,
      thumbnail_url: thumb.thumbnailUrl,
      views: thumb.views,
      ctr_estimate: thumb.ctrEstimate,
      niche: thumb.niche,
      face_emotion: thumb.faceEmotion,
      composition_type: thumb.compositionType,
      color_dominant: thumb.colorDominant,
      text_count_words: thumb.textCountWords,
      tags: thumb.tags,
      analysis_breakdown: thumb.analysisBreakdown,
      prompt_midjourney: thumb.promptMidjourney || "Cinematic 8k hyper-realistic YouTube thumbnail, high retention, vibrant composition"
    }, { onConflict: 'youtube_id' });

    if (tErr) console.error(`Error inserting thumbnail ${thumb.title}:`, tErr.message);
  }
  console.log(`✅ Seeded ${THUMBNAILS_DATA.length} thumbnail analyses.`);

  // 4. Seed Retention Flows
  console.log('🔄 Seeding Retention Flows...');
  const { data: aliVideo } = await supabase.from('videos').select('id, creator_id').limit(1).single();
  if (aliVideo) {
    await supabase.from('retention_flows').upsert({
      title: 'Apple-Style Minimalist Hook Flow (VID-02)',
      objective: 'hook_0_15s',
      description: 'Zero dead-air 5-shot hook sequence combining kinetic word pops, iOS countdown timer ring, and player frame.',
      video_id: aliVideo.id,
      creator_id: aliVideo.creator_id,
      why_it_works: 'Visuals swap every 2.4s under continuous 206 WPM narration, locking viewer attention before swipe opportunity.',
      retention_impact: '+42% 30-second retention over standard talking head.'
    });
  }

  console.log('🎉 Supabase database seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

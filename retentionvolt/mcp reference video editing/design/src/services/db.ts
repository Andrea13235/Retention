import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { VIDEOS_DATA } from '@/data/videos';
import { THUMBNAILS_DATA } from '@/data/thumbnails';
import { MOTION_GRAPHICS_DATA } from '@/data/motionGraphics';
import { VideoData, ThumbnailData, MotionGraphicItem, Shot, RetentionFlow } from '@/types';

function mapSupabaseRowToVideo(row: any): VideoData {
  return {
    id: row.youtube_id || row.id,
    youtubeId: row.youtube_id,
    youtubeUrl: row.youtube_url,
    title: row.title,
    creator: {
      name: row.creator?.name || 'Unknown Creator',
      handle: row.creator?.handle || '',
      avatarUrl: row.creator?.avatar_url || '',
      subscribers: row.creator?.subscribers || ''
    },
    duration: row.duration,
    durationSeconds: Number(row.duration_seconds || 0),
    cpm: Number(row.cpm || 0),
    cpmIntro: Number(row.cpm_intro || 0),
    averageShotLengthSec: Number(row.average_shot_length_sec || 0),
    wordsPerMinute: Number(row.words_per_minute || 0),
    deadAirPercentage: Number(row.dead_air_percentage || 0),
    visualStimulusIntervalSec: Number(row.visual_stimulus_interval_sec || 2.1),
    maxStaticHoldSec: Number(row.max_static_hold_sec || 3.0),
    cameraSwitchesCount: Number(row.camera_switches_count || 0),
    punchZoomsCount: Number(row.punch_zooms_count || 0),
    slowPushInsCount: Number(row.slow_push_ins_count || 0),
    retentionScore: Number(row.retention_score || 85),
    hookDurationSec: Number(row.hook_duration_sec || 5),
    category: row.category,
    niche: row.niche,
    tags: row.tags || [],
    thumbnailUrl: row.thumbnail_url,
    thumbnailAnalysis: row.thumbnail_analysis || undefined,
    aspectRatio: row.aspect_ratio || '16:9',
    views: row.views || '0',
    editingAdvice: row.editing_advice || {},
    motionGraphicIds: row.motion_graphic_ids || [],
    cuts: Array.isArray(row.shots) ? row.shots.sort((a: any, b: any) => a.shot_index - b.shot_index).map((s: any) => {
      let motionIntent: any = undefined;
      const desc = s.visual_description || '';
      const match = desc.match(/\[([a-z_]+)\s*\|\s*([a-z_]+)\s*\|\s*([0-9.]+)s\]\s*(.*)/);
      if (match) {
        motionIntent = {
          intent: match[1],
          screenPosition: match[2],
          recommendedDurationSec: parseFloat(match[3]),
          retentionRole: match[4]
        };
      }
      return {
        timeSeconds: Number(s.start_time),
        label: s.label,
        type: s.cut_type,
        cameraAngle: s.camera_angle || undefined,
        scaleChange: s.scale_change || undefined,
        movementDurationSec: s.movement_duration_sec ? Number(s.movement_duration_sec) : undefined,
        description: s.visual_description || undefined,
        motionIntent
      };
    }) : []
  };
}

function mapSupabaseRowToMotionPattern(row: any): MotionGraphicItem {
  return {
    id: row.id,
    title: row.title,
    register: row.register,
    category: row.category,
    sourceCreator: row.source_creator || row.sourceCreator || '',
    sourceTimestamp: row.source_timestamp || row.sourceTimestamp || '',
    description: row.description,
    durationSec: Number(row.duration_sec ?? row.durationSec ?? 0),
    rebuildFormula: row.rebuild_formula || row.rebuildFormula || '',
    codeSnippet: row.code_snippet || row.codeSnippet || '',
    previewType: row.preview_type || row.previewType || 'text_pop',
    accentColor: row.accent_color || row.accentColor || '#ffffff'
  };
}

function mapSupabaseRowToThumbnail(row: any): ThumbnailData {
  return {
    id: row.id,
    youtubeId: row.youtube_id || row.youtubeId || '',
    title: row.title,
    creator: row.creator_name || row.creator || '',
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl || '',
    views: row.views || '0',
    ctrEstimate: row.ctr_estimate || row.ctrEstimate || '0%',
    niche: row.niche || '',
    faceEmotion: row.face_emotion || row.faceEmotion || 'none',
    compositionType: row.composition_type || row.compositionType || 'rule_of_thirds',
    colorDominant: row.color_dominant || row.colorDominant || '#000000',
    textCountWords: Number(row.text_count_words ?? row.textCountWords ?? 0),
    tags: row.tags || [],
    analysisBreakdown: row.analysis_breakdown || row.analysisBreakdown || [],
    promptMidjourney: row.prompt_midjourney || row.promptMidjourney
  };
}

export class VideoDbService {
  /**
   * Search videos with Mobbin-style faceted filters
   */
  public async searchVideos(filters: {
    query?: string;
    category?: string;
    niche?: string;
    format?: 'long_form' | 'shorts';
    minCpm?: number;
    maxCpm?: number;
  }): Promise<VideoData[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('videos').select('*, creator:creators(*), shots(*)');

      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.niche) {
        query = query.ilike('niche', `%${filters.niche}%`);
      }
      if (filters.format) {
        query = query.eq('format', filters.format);
      }
      if (filters.minCpm) {
        query = query.gte('cpm', filters.minCpm);
      }
      if (filters.maxCpm) {
        query = query.lte('cpm', filters.maxCpm);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        let mapped = data.map(mapSupabaseRowToVideo);
        if (filters.query) {
          const q = filters.query.toLowerCase();
          mapped = mapped.filter(v =>
            v.title.toLowerCase().includes(q) ||
            v.creator.name.toLowerCase().includes(q) ||
            v.niche.toLowerCase().includes(q) ||
            v.tags?.some(t => t.toLowerCase().includes(q))
          );
        }
        return mapped;
      }
    }

    // Fallback to in-memory seed data
    let results = [...VIDEOS_DATA];
    const q = (filters.query || '').toLowerCase();

    if (q) {
      results = results.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.creator.name.toLowerCase().includes(q) ||
        v.niche.toLowerCase().includes(q) ||
        v.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (filters.category) {
      results = results.filter(v => v.category === filters.category);
    }
    if (filters.niche) {
      results = results.filter(v => v.niche.toLowerCase() === filters.niche!.toLowerCase());
    }
    if (filters.minCpm) {
      results = results.filter(v => v.cpm >= filters.minCpm!);
    }
    if (filters.maxCpm) {
      results = results.filter(v => v.cpm <= filters.maxCpm!);
    }

    return results;
  }

  /**
   * Get a single video by ID or creator handle
   */
  public async getVideoById(idOrCreator: string): Promise<VideoData | null> {
    const lower = idOrCreator.toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCreator);
      let query = supabase.from('videos').select('*, creator:creators(*), shots(*)');

      if (isUuid) {
        query = query.eq('id', idOrCreator);
      } else {
        query = query.eq('youtube_id', idOrCreator);
      }

      let { data } = await query.maybeSingle();

      if (!data) {
        // Try title match
        const { data: titleMatch } = await supabase
          .from('videos')
          .select('*, creator:creators(*), shots(*)')
          .ilike('title', `%${idOrCreator}%`)
          .limit(1)
          .maybeSingle();
        if (titleMatch) data = titleMatch;
      }

      if (!data) {
        const localMatch = VIDEOS_DATA.find(v => 
          v.id === idOrCreator || 
          v.youtubeId === idOrCreator ||
          v.creator.name.toLowerCase().includes(lower) ||
          v.creator.handle.toLowerCase().includes(lower)
        );
        if (localMatch) {
          const { data: matchedData } = await supabase
            .from('videos')
            .select('*, creator:creators(*), shots(*)')
            .eq('youtube_id', localMatch.youtubeId)
            .maybeSingle();
          if (matchedData) data = matchedData;
        }
      }

      if (data) {
        return mapSupabaseRowToVideo(data);
      }
    }

    // Local fallback
    const found = VIDEOS_DATA.find(v => 
      v.id === idOrCreator || 
      v.youtubeId === idOrCreator ||
      v.creator.name.toLowerCase().includes(lower) ||
      v.creator.handle.toLowerCase().includes(lower)
    );

    return found || null;
  }

  /**
   * Get motion graphic pattern by ID or category
   */
  public async getMotionPattern(patternId?: string, category?: string): Promise<MotionGraphicItem | null> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('motion_patterns').select('*');
      if (patternId) {
        query = query.ilike('id', patternId);
      } else if (category) {
        query = query.ilike('category', category);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return mapSupabaseRowToMotionPattern(data);
      }
    }

    const found = MOTION_GRAPHICS_DATA.find(m => 
      (patternId && m.id.toLowerCase() === patternId.toLowerCase()) || 
      (category && m.category.toLowerCase() === category.toLowerCase())
    );

    return found || MOTION_GRAPHICS_DATA[0];
  }

  /**
   * Get thumbnail intelligence by niche or emotion
   */
  public async getThumbnails(niche?: string, emotion?: string): Promise<ThumbnailData[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('thumbnails').select('*');
      if (niche) query = query.ilike('niche', `%${niche}%`);
      if (emotion) query = query.ilike('face_emotion', emotion);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(mapSupabaseRowToThumbnail);
      }
    }

    let results = [...THUMBNAILS_DATA];
    if (niche) {
      results = results.filter(t => t.niche.toLowerCase().includes(niche.toLowerCase()));
    }
    if (emotion) {
      results = results.filter(t => t.faceEmotion.toLowerCase() === emotion.toLowerCase());
    }
    return results;
  }

  /**
   * Ingest a newly analyzed video reference into Supabase
   */
  public async ingestVideo(video: VideoData): Promise<{ success: boolean; id: string }> {
    const dbClient = supabaseAdmin || supabase;
    if (!isSupabaseConfigured || !dbClient) {
      return { 
        success: true, 
        id: video.id || `local-${Date.now()}` 
      };
    }

    // Robust creator lookup: try to find existing or insert
    let creatorId: string | null = null;
    try {
      // Check if creator already exists by handle
      const { data: existingCreator } = await dbClient
        .from('creators')
        .select('id')
        .eq('handle', video.creator.handle)
        .maybeSingle();

      if (existingCreator?.id) {
        creatorId = existingCreator.id;
      } else {
        // Insert new creator
        const { data: newCreator, error: cErr } = await dbClient
          .from('creators')
          .insert({
            name: video.creator.name,
            handle: video.creator.handle,
            avatar_url: video.creator.avatarUrl || '',
            platform: 'youtube',
            subscribers: video.creator.subscribers || '1M',
            niche: video.niche
          })
          .select('id')
          .single();

        if (cErr) {
          console.warn(`⚠️ Creator insert warning (continuing without FK): ${cErr.message}`);
        } else {
          creatorId = newCreator?.id || null;
        }
      }
    } catch (cErr: any) {
      console.warn(`⚠️ Creator lookup failed (continuing without FK): ${cErr.message}`);
    }

    // Build the full video payload
    const videoPayloadRow = {
      youtube_id: video.youtubeId,
      youtube_url: video.youtubeUrl,
      title: video.title,
      creator_id: creatorId,
      format: video.category === 'shorts' ? 'shorts' : 'long_form',
      aspect_ratio: video.aspectRatio,
      duration: video.duration,
      duration_seconds: video.durationSeconds,
      cpm: video.cpm,
      cpm_intro: video.cpmIntro,
      average_shot_length_sec: video.averageShotLengthSec,
      words_per_minute: video.wordsPerMinute,
      dead_air_percentage: video.deadAirPercentage || 0,
      visual_stimulus_interval_sec: video.visualStimulusIntervalSec || 2.1,
      max_static_hold_sec: video.maxStaticHoldSec || 3.0,
      camera_switches_count: video.cuts.filter(c => c.type === 'camera_angle_switch').length || video.cameraSwitchesCount || 0,
      punch_zooms_count: video.cuts.filter(c => c.type === 'punch_zoom').length || video.punchZoomsCount || 0,
      slow_push_ins_count: video.cuts.filter(c => c.type === 'slow_push_in' || c.type === 'slow_pull_out' || c.type === 'camera_drift').length || video.slowPushInsCount || 0,
      retention_score: video.retentionScore,
      category: video.category,
      niche: video.niche,
      tags: video.tags,
      thumbnail_url: video.thumbnailUrl,
      thumbnail_analysis: video.thumbnailAnalysis || null,
      views: video.views,
      editing_advice: video.editingAdvice,
      transcript_text: video.transcriptText,
      transcript_raw: video.transcriptRaw || []
    };

    // Check if video already exists
    const { data: existing } = await dbClient
      .from('videos')
      .select('id')
      .eq('youtube_id', video.youtubeId)
      .maybeSingle();

    let videoRecord: any;
    let vidErr: any;

    if (existing?.id) {
      // UPDATE existing record with all fresh analysis values
      const { data, error } = await dbClient
        .from('videos')
        .update(videoPayloadRow)
        .eq('id', existing.id)
        .select()
        .single();
      videoRecord = data;
      vidErr = error;
    } else {
      // INSERT new record
      const { data, error } = await dbClient
        .from('videos')
        .insert(videoPayloadRow)
        .select()
        .single();
      videoRecord = data;
      vidErr = error;
    }

    if (vidErr) {
      throw new Error(`Failed to insert video: ${vidErr.message}`);
    }

    // Insert cut points as shots
    if (video.cuts && video.cuts.length > 0 && videoRecord) {
      // Clear previous shots for idempotency
      await dbClient.from('shots').delete().eq('video_id', videoRecord.id);

      const shotsToInsert = video.cuts.map((cut, idx) => {
        const nextTime = idx < video.cuts.length - 1 ? video.cuts[idx + 1].timeSeconds : video.durationSeconds;
        const visualDesc = cut.motionIntent 
          ? `[${cut.motionIntent.intent} | ${cut.motionIntent.screenPosition} | ${cut.motionIntent.recommendedDurationSec}s] ${cut.motionIntent.retentionRole}`
          : (cut.description || cut.label);

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
          pattern_id: null,
          visual_description: visualDesc
        };
      });

      const { error: shotErr } = await dbClient.from('shots').insert(shotsToInsert);
      if (shotErr) {
        console.warn(`⚠️ Warning inserting shots for video ${videoRecord.id}: ${shotErr.message}`);
      }
    }

    return { success: true, id: videoRecord.id };
  }
}

export const videoDbService = new VideoDbService();

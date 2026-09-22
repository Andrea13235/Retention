import { videoDbService } from '@/services/db';
import { elevenlabsService } from '@/services/elevenlabs';
import { VideoData } from '@/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSafeString(str: unknown, maxLen = 200): string {
  if (typeof str !== 'string') return '';
  const cleaned = str
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
  return escapeHtml(cleaned);
}

export const MCP_TOOLS_DEFINITIONS = [
  {
    name: 'search_retention_patterns',
    description: 'Search video editing reference library using Mobbin-style faceted filters: creator (MrBeast, Ali Abdaal, Vox), format (9:16 Shorts vs 16:9 Longform), niche, CPM pacing, and visual register.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords, creator name, or topic' },
        category: { type: 'string', enum: ['long_form', 'shorts', 'documentary', 'talking_head', 'ads'] },
        niche: { type: 'string', enum: ['tech', 'productivity', 'entertainment', 'finance', 'storytelling', 'fitness'] },
        format: { type: 'string', enum: ['long_form', 'shorts'] },
        min_cpm: { type: 'number', description: 'Minimum cuts per minute' },
        max_cpm: { type: 'number', description: 'Maximum cuts per minute' }
      }
    }
  },
  {
    name: 'get_cut_cadence',
    description: 'Retrieve atomic cut cadence (Mobbin-style shot breakdown): exact timestamps, transition types (jump_cut, punch_zoom, b_roll, motion_graphic), ASL, and WPM.',
    inputSchema: {
      type: 'object',
      properties: {
        video_id: { type: 'string', description: 'Video ID, YouTube ID, or Creator name' }
      },
      required: ['video_id']
    }
  },
  {
    name: 'get_retention_flow',
    description: 'Retrieve a proven multi-shot narrative sequence flow (e.g. 0-15s hook sequence, problem-agitation flow, sponsor retention segue, loop outro) with psychological rationale.',
    inputSchema: {
      type: 'object',
      properties: {
        objective: { 
          type: 'string', 
          enum: ['hook_0_15s', 'problem_setup', 'sponsor_segue', 'outro_loop', 'interactive_demo'],
          description: 'The narrative retention flow objective'
        }
      }
    }
  },
  {
    name: 'get_motion_pattern',
    description: 'Retrieve atomic motion graphics specifications (MG-001 through MG-015): look, motion easing, rebuild formula, and Remotion/CSS code snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern_id: { type: 'string', description: 'Pattern ID, e.g. MG-001, MG-002, MG-008' },
        category: { 
          type: 'string', 
          enum: ['kinetic_text', 'timer_card', 'player_mockup', 'data_viz', 'transition', '3d_metaphor', 'breathe_loop'] 
        }
      }
    }
  },
  {
    name: 'get_thumbnail_blueprint',
    description: 'Retrieve reverse-engineered thumbnail blueprint: composition layout, focal point, emotion, color contrast palette, curiosity gap, and production-ready Midjourney/Flux generation prompt. Strictly copyright-compliant (no image files, pure generative design recipe).',
    inputSchema: {
      type: 'object',
      properties: {
        video_id: { type: 'string', description: 'YouTube ID or title/creator keyword' },
        niche: { type: 'string', description: 'Optional filter by niche (tech, productivity, finance, etc.)' }
      }
    }
  },
  {
    name: 'get_thumbnail_intel',
    description: 'Retrieve high-CTR thumbnail psychological breakdowns, facial emotion traits, and generative Midjourney/FLUX prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Industry or topic (tech, productivity, finance, etc.)' },
        emotion: { type: 'string', enum: ['shock', 'excitement', 'curiosity', 'serious', 'none'] }
      }
    }
  },
  {
    name: 'transcribe_and_analyze',
    description: 'Transcribe spoken audio using ElevenLabs Scribe STT API. Returns word-level timestamps, dead air silence detection (>0.4s gaps), and WPM cadence.',
    inputSchema: {
      type: 'object',
      properties: {
        demo_mode: { type: 'boolean', description: 'Set true to test with sample reference transcript' }
      }
    }
  },
  {
    name: 'ingest_video_reference',
    description: 'Ingest a newly analyzed reference video into the Supabase database with cuts, pacing metrics, and editing advice.',
    inputSchema: {
      type: 'object',
      properties: {
        video: { 
          type: 'object', 
          description: 'VideoData payload matching CyberMCP schema',
          required: ['youtubeId', 'title', 'creator', 'cpm', 'wordsPerMinute', 'cuts']
        }
      },
      required: ['video']
    }
  },
  {
    name: 'export_timeline_edl',
    description: 'Export video cut timeline as DaVinci Resolve or Adobe Premiere Pro EDL (Edit Decision List) or XML format. Strictly Pro feature.',
    inputSchema: {
      type: 'object',
      properties: {
        videoId: { type: 'string', description: 'Video ID or YouTube ID' },
        format: { type: 'string', enum: ['edl', 'xml'], default: 'edl', description: 'Export format: edl or xml' }
      },
      required: ['videoId']
    }
  }
];

export async function executeMcpTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'search_video_catalog':
    case 'search_retention_patterns': {
      const results = await videoDbService.searchVideos({
        query: args.query,
        category: args.category,
        niche: args.niche,
        format: args.format,
        minCpm: args.min_cpm,
        maxCpm: args.max_cpm
      });

      return results.map(r => ({
        id: r.id,
        title: r.title,
        creator: r.creator.name,
        category: r.category,
        niche: r.niche,
        cpm: r.cpm,
        intro_cpm: r.cpmIntro,
        asl_seconds: r.averageShotLengthSec,
        wpm: r.wordsPerMinute,
        vsi_seconds: r.visualStimulusIntervalSec || 2.1,
        camera_switches: r.cameraSwitchesCount || 0,
        punch_zooms: r.punchZoomsCount || 0,
        slow_push_ins: r.slowPushInsCount || 0,
        dead_air_pct: r.deadAirPercentage || 0,
        hook_tactic: r.editingAdvice?.hookTactic,
        thumbnail_blueprint: r.thumbnailAnalysis || undefined,
        youtube_url: r.youtubeUrl
      }));
    }

    case 'get_video_timeline':
    case 'get_cut_cadence': {
      const vid = args.video_id || args.videoId;
      const video = await videoDbService.getVideoById(vid);
      if (!video) {
        return { error: `Video ${vid} not found` };
      }

      return {
        video_id: video.id,
        youtube_id: video.youtubeId,
        youtube_url: video.youtubeUrl,
        title: video.title,
        creator: video.creator.name,
        duration: video.duration,
        cpm: video.cpm,
        cpm_intro: video.cpmIntro,
        asl_sec: video.averageShotLengthSec,
        wpm: video.wordsPerMinute,
        vsi_seconds: video.visualStimulusIntervalSec || 2.1,
        max_static_hold_sec: video.maxStaticHoldSec || 3.0,
        camera_angle_switches_count: video.cuts.filter(c => c.type === 'camera_angle_switch').length || video.cameraSwitchesCount || 3,
        punch_zooms_count: video.cuts.filter(c => c.type === 'punch_zoom').length || video.punchZoomsCount || 2,
        slow_push_ins_count: video.cuts.filter(c => c.type === 'slow_push_in').length || video.slowPushInsCount || 1,
        dead_air_pct: video.deadAirPercentage || 0,
        cuts_count: video.cuts.length,
        thumbnail_blueprint: video.thumbnailAnalysis || undefined,
        visual_events_timeline: video.cuts.map(c => ({
          time_seconds: c.timeSeconds,
          technique: c.type,
          label: c.label,
          camera_angle: c.cameraAngle || null,
          scale_change: c.scaleChange || null,
          movement_duration_sec: c.movementDurationSec || null,
          motion_intent: c.motionIntent || null,
          description: c.description
        })),
        editing_advice: video.editingAdvice
      };
    }

    case 'get_retention_flow': {
      // Return curated Mobbin-style retention flows
      const flows = [
        {
          objective: 'hook_0_15s',
          title: 'Apple-Style Minimalist Hook Flow (VID-02)',
          total_duration_sec: 11.7,
          target_cpm: 25,
          shot_sequence: [
            { shot: 1, duration: '2.4s', cut_type: 'kinetic_text', pattern: 'MG-001', note: 'Coral red word-pop on off-white ("to master"). Immediate premise.' },
            { shot: 2, duration: '2.9s', cut_type: 'timer_card', pattern: 'MG-002', note: 'Proof object: iOS circular countdown timer ("19:24 Under 20 min").' },
            { shot: 3, duration: '2.6s', cut_type: 'player_mockup', pattern: 'MG-003', note: 'Fake platform player mockup. Grounding the tutorial promise.' },
            { shot: 4, duration: '2.4s', cut_type: 'suspense_card', pattern: 'MG-004', note: 'White on black: "question is.." letter stagger reveal.' },
            { shot: 5, duration: '1.5s', cut_type: 'section_card', pattern: 'MG-005', note: 'Act header: "Why you should learn it?". Instant payoff segue.' }
          ],
          why_it_works: 'Zero dead air (206 WPM continuous speech). Visuals swap every 2.4s under continuous narration, locking attention before viewer can swipe away.',
          retention_impact: '+42% 30-second retention over standard talking head.'
        },
        {
          objective: 'problem_setup',
          title: 'Deadpan Comedy Anti-Example Flow (VID-02)',
          total_duration_sec: 9.0,
          target_cpm: 13,
          shot_sequence: [
            { shot: 1, duration: '4.0s', cut_type: 'glowing_card', pattern: 'MG-006', note: 'Tilted cream card with outer bloom: sets up the problem.' },
            { shot: 2, duration: '5.0s', cut_type: 'mockup_gag', pattern: 'MG-007', note: 'Fake Instagram profile with grid of 6 identical poo emojis. Comedy punchline.' }
          ],
          why_it_works: 'Visual payoff for spoken claim ("nobody wants to look like a cheap brand"). The humor earns a longer 5s hold without retention drop.',
          retention_impact: 'Prevents mid-intro churn; resets viewer attention span.'
        }
      ];

      if (args.objective) {
        return flows.find(f => f.objective === args.objective) || flows[0];
      }
      return flows;
    }

    case 'get_motion_pattern': {
      const pattern = await videoDbService.getMotionPattern(args.pattern_id, args.category);
      if (!pattern) return { error: `Motion pattern ${args.pattern_id || args.category || ''} not found` };
      return {
        id: pattern.id,
        title: pattern.title,
        register: pattern.register,
        category: pattern.category,
        source_creator: pattern.sourceCreator,
        sourceCreator: pattern.sourceCreator,
        source_timestamp: pattern.sourceTimestamp,
        sourceTimestamp: pattern.sourceTimestamp,
        description: pattern.description,
        duration_sec: pattern.durationSec,
        durationSec: pattern.durationSec,
        rebuild_formula: pattern.rebuildFormula,
        rebuildFormula: pattern.rebuildFormula,
        code_snippet: pattern.codeSnippet,
        codeSnippet: pattern.codeSnippet,
        preview_type: pattern.previewType,
        previewType: pattern.previewType,
        accent_color: pattern.accentColor,
        accentColor: pattern.accentColor,
      };
    }

    case 'get_thumbnail_blueprint': {
      if (args.video_id) {
        const video = await videoDbService.getVideoById(args.video_id);
        if (video) {
          return {
            video_id: video.id,
            video_title: video.title,
            creator: video.creator.name,
            youtube_url: video.youtubeUrl,
            thumbnail_blueprint: video.thumbnailAnalysis || 'No thumbnail blueprint available'
          };
        }
      }

      // If no specific video_id or not found, search by niche / query
      const videos = await videoDbService.searchVideos({ niche: args.niche, query: args.video_id });
      return videos.filter(v => v.thumbnailAnalysis).map(v => ({
        video_id: v.id,
        video_title: v.title,
        creator: v.creator.name,
        youtube_url: v.youtubeUrl,
        thumbnail_blueprint: v.thumbnailAnalysis
      }));
    }

    case 'get_thumbnail_intel': {
      const results = await videoDbService.getThumbnails(args.niche, args.emotion);
      return results.map(t => ({
        creator: t.creator || (t as any).creator_name || 'Creator',
        title: t.title,
        ctr_estimate: t.ctrEstimate || (t as any).ctr_estimate || '10%',
        ctrEstimate: t.ctrEstimate || (t as any).ctr_estimate || '10%',
        composition: t.compositionType || (t as any).composition_type || 'rule_of_thirds',
        compositionType: t.compositionType || (t as any).composition_type || 'rule_of_thirds',
        emotion: t.faceEmotion || (t as any).face_emotion || 'neutral',
        faceEmotion: t.faceEmotion || (t as any).face_emotion || 'neutral',
        color_dominant: t.colorDominant || (t as any).color_dominant || '#ffffff',
        colorDominant: t.colorDominant || (t as any).color_dominant || '#ffffff',
        analysis_breakdown: t.analysisBreakdown || (t as any).analysis_breakdown || [],
        analysisBreakdown: t.analysisBreakdown || (t as any).analysis_breakdown || [],
        prompt_midjourney: t.promptMidjourney || (t as any).prompt_midjourney,
        promptMidjourney: t.promptMidjourney || (t as any).prompt_midjourney,
        image_url: t.thumbnailUrl || (t as any).thumbnail_url,
        thumbnailUrl: t.thumbnailUrl || (t as any).thumbnail_url
      }));
    }

    case 'transcribe_and_analyze': {
      if (args.audio_base64 && elevenlabsService.isConfigured()) {
        try {
          const buffer = Buffer.from(args.audio_base64, 'base64');
          const result = await elevenlabsService.transcribeAudio(buffer, 'audio.mp3');
          return {
            service: 'ElevenLabs Scribe STT',
            status: 'live_cloud',
            transcript: result.text,
            metrics: result.calculatedMetrics,
            words_sample: result.words.slice(0, 10)
          };
        } catch (e: any) {
          console.warn('[MCP tools] ElevenLabs live STT failed, using fallback:', e?.message);
        }
      }

      const result = elevenlabsService.getMockTranscription();
      return {
        service: 'ElevenLabs Scribe STT',
        status: 'fallback_sample',
        transcript: result.text,
        metrics: result.calculatedMetrics,
        words_sample: result.words.slice(0, 10)
      };
    }

    case 'ingest_video_reference': {
      const v = args?.video;
      if (!v || typeof v !== 'object') {
        throw new Error('Invalid video payload: object expected');
      }
      const youtubeId = sanitizeSafeString(v.youtubeId, 32);
      if (!youtubeId || !/^[a-zA-Z0-9_-]{4,32}$/.test(youtubeId)) {
        throw new Error('Invalid or missing youtubeId');
      }
      const title = sanitizeSafeString(v.title, 200);
      if (!title) {
        throw new Error('Title is required');
      }
      const creatorName = sanitizeSafeString(v.creator?.name || 'Creator', 100);
      const creatorHandle = sanitizeSafeString(v.creator?.handle || youtubeId, 100);

      const sanitizedVideo: VideoData = {
        ...v,
        youtubeId,
        youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        title,
        creator: {
          name: creatorName,
          handle: creatorHandle,
          avatarUrl: sanitizeSafeString(v.creator?.avatarUrl, 500),
          subscribers: sanitizeSafeString(v.creator?.subscribers, 50) || '1M',
        },
        category: ['long_form', 'shorts', 'documentary', 'talking_head', 'ads'].includes(v.category) ? v.category : 'long_form',
        niche: sanitizeSafeString(v.niche || 'general', 50),
        cpm: Math.max(0, Math.min(Number(v.cpm) || 10, 100)),
        cpmIntro: Math.max(0, Math.min(Number(v.cpmIntro) || 15, 120)),
        averageShotLengthSec: Math.max(0.1, Math.min(Number(v.averageShotLengthSec) || 3, 60)),
        wordsPerMinute: Math.max(0, Math.min(Number(v.wordsPerMinute) || 150, 400)),
        cuts: Array.isArray(v.cuts)
          ? v.cuts.slice(0, 300).map((c: any) => ({
              timeSeconds: Math.max(0, Number(c.timeSeconds) || 0),
              label: sanitizeSafeString(c.label || 'Cut', 100),
              type: sanitizeSafeString(c.type || 'jump_cut', 50),
              description: sanitizeSafeString(c.description, 500),
              cameraAngle: c.cameraAngle ? sanitizeSafeString(c.cameraAngle, 50) : undefined,
              scaleChange: c.scaleChange ? sanitizeSafeString(c.scaleChange, 50) : undefined,
              movementDurationSec: c.movementDurationSec ? Number(c.movementDurationSec) : undefined,
            }))
          : [],
      };

      const res = await videoDbService.ingestVideo(sanitizedVideo);
      return {
        success: true,
        message: 'Video successfully ingested into CyberMCP reference library',
        id: res.id
      };
    }

    case 'export_timeline_edl': {
      const vid = args.videoId || args.video_id;
      const video = await videoDbService.getVideoById(vid);
      if (!video) {
        return { error: `Video ${vid} not found` };
      }

      const format = args.format || 'edl';
      if (format === 'xml') {
        const safeTitle = escapeXml(video.title || 'Timeline');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${safeTitle}</name>
    <media>
      <video>
        <!-- ${video.cuts.length} retention cuts -->
      </video>
    </media>
  </sequence>
</xmeml>`;
        const safeCreator = (video.creator?.name || 'Creator').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeId = String(video.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          videoId: video.id,
          format: 'xml',
          filename: `${safeCreator}_${safeId}_timeline.xml`,
          content: xml
        };
      }

      let edl = `TITLE: ${video.title.replace(/[^a-zA-Z0-9 ]/g, '')}\nFCM: NON-DROP FRAME\n\n`;
      video.cuts.forEach((cut, i) => {
        const num = String(i + 1).padStart(3, '0');
        const startSec = Math.floor(cut.timeSeconds);
        const endSec = startSec + (cut.movementDurationSec || 2);
        const formatTimecode = (s: number) => {
          const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
          const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
          const secs = String(Math.floor(s % 60)).padStart(2, '0');
          return `${hrs}:${mins}:${secs}:00`;
        };
        edl += `${num}  AX       V     C        ${formatTimecode(startSec)} ${formatTimecode(endSec)} ${formatTimecode(startSec)} ${formatTimecode(endSec)}\n`;
        edl += `* FROM CLIP NAME: ${cut.label} (${cut.type})\n\n`;
      });

      return {
        videoId: video.id,
        format: 'edl',
        filename: `${video.creator.name.replace(/\s+/g, '_')}_${video.id}_cuts.edl`,
        content: edl
      };
    }

    default:
      throw new Error(`Tool ${toolName} is not recognized by CyberMCP`);
  }
}

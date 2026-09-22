import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processSingleVideo, SingleVideoAnalysisResult } from './process-single-video';
import { videoDbService } from '../src/services/db';
import { VideoData } from '../src/types';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ReanalysisProgressItem {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  category: string;
  niche: string;
  durationSeconds: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  durationSec?: number;
  cutsCount?: number;
  motionIntentsCount?: number;
  wpm?: number;
  cpm?: number;
  error?: string | null;
}

const QUEUE_DIR = path.join(process.cwd(), 'queue');
const PROGRESS_FILE = path.join(QUEUE_DIR, 'reanalysis_progress.json');

function saveProgress(items: ReanalysisProgressItem[]) {
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(items, null, 2));
}

async function loadOrCreateProgress(): Promise<ReanalysisProgressItem[]> {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const existing: ReanalysisProgressItem[] = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      if (existing && existing.length > 0) {
        console.log(`📋 Loaded existing progress file with ${existing.length} items.`);
        return existing;
      }
    } catch (e) {
      console.warn(`⚠️ Could not parse existing progress file, recreating from Supabase.`);
    }
  }

  console.log(`🔍 Fetching all videos from Supabase to initialize re-analysis queue...`);
  const { data: dbVideos, error } = await supabase
    .from('videos')
    .select('id, youtube_id, youtube_url, category, niche, title, duration_seconds')
    .order('duration_seconds', { ascending: true }); // Process shorter videos first for quick wins

  if (error || !dbVideos) {
    throw new Error(`Failed to fetch videos from Supabase: ${error?.message}`);
  }

  console.log(`📦 Found ${dbVideos.length} videos in Supabase.`);

  // Check which videos already have motionIntent populated
  const items: ReanalysisProgressItem[] = [];
  for (const v of dbVideos) {
    const yUrl = v.youtube_url || `https://www.youtube.com/watch?v=${v.youtube_id}`;
    
    // Check if shots in DB already have motion intent format
    const { data: shots } = await supabase
      .from('shots')
      .select('visual_description')
      .eq('video_id', v.id)
      .limit(10);

    const hasMotionIntent = shots && shots.some(s => s.visual_description && s.visual_description.startsWith('['));

    items.push({
      id: v.id,
      youtubeId: v.youtube_id,
      youtubeUrl: yUrl,
      title: v.title,
      category: v.category || 'talking_head',
      niche: v.niche || 'productivity',
      durationSeconds: v.duration_seconds || 0,
      status: hasMotionIntent ? 'completed' : 'pending',
      completedAt: hasMotionIntent ? new Date().toISOString() : undefined,
      cutsCount: hasMotionIntent ? shots.length : undefined
    });
  }

  saveProgress(items);
  console.log(`💾 Initialized reanalysis progress file with ${items.length} items (${items.filter(i => i.status === 'completed').length} already up to date).`);
  return items;
}

async function syncVideosDataFile() {
  console.log(`\n============================================================`);
  console.log(`🔄 SYNCING ALL UPDATED VIDEOS TO src/data/videos.ts`);
  console.log(`============================================================`);

  const allVideos: VideoData[] = await videoDbService.searchVideos({});
  console.log(`Fetched ${allVideos.length} videos with full cut timelines & motion intents from Supabase.`);

  const fileContent = `// Auto-synchronized dataset of high-retention reference videos with thumbnail blueprints & real metrics
import { VideoData } from "@/types";

export const VIDEOS_DATA: VideoData[] = ${JSON.stringify(allVideos, null, 2)};
`;

  const destPath = path.join(process.cwd(), 'src/data/videos.ts');
  fs.writeFileSync(destPath, fileContent, 'utf8');
  console.log(`✅ Saved ${allVideos.length} videos to src/data/videos.ts!`);
}

async function main() {
  console.log(`\n============================================================`);
  console.log(`🚀 CYBERMCP FULL-DURATION BATCH RE-ANALYSIS RUNNER`);
  console.log(`   - 100% video duration (no sampling)`);
  console.log(`   - Free YouTube VTT subtitle transcription`);
  console.log(`   - Semantic Motion Design Intent classification`);
  console.log(`   - Supabase sync & static file backup`);
  console.log(`============================================================\n`);

  const items = await loadOrCreateProgress();
  const pendingItems = items.filter(i => i.status === 'pending');
  const completedInitial = items.filter(i => i.status === 'completed').length;

  console.log(`📊 Progress: ${completedInitial}/${items.length} completed, ${pendingItems.length} pending.\n`);

  if (pendingItems.length === 0) {
    console.log(`✨ All ${items.length} videos are already re-analyzed!`);
    await syncVideosDataFile();
    return;
  }

  let currentIndex = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.status !== 'pending') continue;

    currentIndex++;
    console.log(`\n------------------------------------------------------------`);
    console.log(`▶️ [${currentIndex}/${pendingItems.length}] Processing (${i + 1}/${items.length}): "${item.title}"`);
    console.log(`   URL: ${item.youtubeUrl}`);
    console.log(`   Duration: ${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s | Category: ${item.category} | Niche: ${item.niche}`);
    console.log(`------------------------------------------------------------`);

    item.status = 'processing';
    item.startedAt = new Date().toISOString();
    saveProgress(items);

    const startTime = Date.now();
    try {
      const result: SingleVideoAnalysisResult = await processSingleVideo(item.youtubeUrl, item.category, item.niche);
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      if (result.success) {
        // Fetch cuts to count motion intents
        const verifiedVid = await videoDbService.getVideoById(item.youtubeId);
        const motionCount = verifiedVid?.cuts?.filter(c => c.motionIntent).length || 0;

        item.status = 'completed';
        item.completedAt = new Date().toISOString();
        item.durationSec = elapsedSec;
        item.cutsCount = result.cutsCount;
        item.motionIntentsCount = motionCount;
        item.wpm = result.wpm;
        item.cpm = result.cpm;
        item.error = null;

        console.log(`✅ [${currentIndex}/${pendingItems.length}] COMPLETED in ${elapsedSec}s!`);
        console.log(`   - Cuts: ${result.cutsCount} | Motion Intents: ${motionCount}`);
        console.log(`   - WPM: ${result.wpm} | CPM: ${result.cpm} | VSI: ${result.vsi}s`);
      } else {
        item.status = 'error';
        item.completedAt = new Date().toISOString();
        item.error = result.error || 'Unknown analysis error';
        console.error(`❌ [${currentIndex}/${pendingItems.length}] FAILED: ${item.error}`);
      }
    } catch (err: any) {
      item.status = 'error';
      item.completedAt = new Date().toISOString();
      item.error = err.message || 'Fatal execution error';
      console.error(`❌ [${currentIndex}/${pendingItems.length}] EXCEPTION: ${item.error}`);
    }

    saveProgress(items);
  }

  console.log(`\n============================================================`);
  console.log(`🏁 ALL VIDEOS IN QUEUE PROCESSED!`);
  console.log(`============================================================`);

  const finalCompleted = items.filter(i => i.status === 'completed').length;
  const finalErrors = items.filter(i => i.status === 'error').length;
  console.log(`🎉 Final Summary: ${finalCompleted}/${items.length} Completed, ${finalErrors} Errors.`);

  // Sync to static file
  await syncVideosDataFile();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal batch runner error:', err);
    process.exit(1);
  });
}

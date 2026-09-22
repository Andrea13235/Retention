import * as fs from 'fs';
import * as path from 'path';
import { processSingleVideo, SingleVideoAnalysisResult } from './process-single-video';
import { VideoDbService } from '../src/services/db';
import { VideoData } from '../src/types';

interface QueueItem {
  url: string;
  category?: string;
  niche?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  addedAt: string;
  processedAt?: string | null;
  result?: any;
  error?: string | null;
}

const QUEUE_DIR = path.join(process.cwd(), 'queue');
const QUEUE_FILE = path.join(QUEUE_DIR, 'videos_queue.json');
const URLS_TXT = path.join(QUEUE_DIR, 'urls.txt');

function loadQueue(): QueueItem[] {
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }

  // If urls.txt exists, import any new URLs
  if (fs.existsSync(URLS_TXT)) {
    const rawUrls = fs.readFileSync(URLS_TXT, 'utf8')
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && !u.startsWith('#'));

    let currentQueue: QueueItem[] = [];
    if (fs.existsSync(QUEUE_FILE)) {
      try {
        currentQueue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      } catch (e) {
        console.error(`⚠️ Failed to parse ${QUEUE_FILE}, backing up corrupted file:`, e);
        try {
          fs.copyFileSync(QUEUE_FILE, `${QUEUE_FILE}.corrupt.${Date.now()}`);
        } catch {}
        currentQueue = [];
      }
    }

    const existingUrls = new Set(currentQueue.map(item => item.url));
    let addedCount = 0;

    for (const url of rawUrls) {
      if (!existingUrls.has(url)) {
        currentQueue.push({
          url,
          status: 'pending',
          addedAt: new Date().toISOString()
        });
        existingUrls.add(url);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      saveQueue(currentQueue);
      console.log(`📥 Imported ${addedCount} new URLs from urls.txt into queue.`);
    }
  }

  if (fs.existsSync(QUEUE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch (e) {
      console.error(`⚠️ Error reading ${QUEUE_FILE}:`, e);
      return [];
    }
  }

  return [];
}

function saveQueue(queue: QueueItem[]) {
  const tmpFile = `${QUEUE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(queue, null, 2), 'utf8');
  fs.renameSync(tmpFile, QUEUE_FILE);
}

async function runSequentialQueue() {
  console.log(`\n============================================================`);
  console.log(`📋 CYBERMCP SEQUENTIAL VIDEO QUEUE RUNNER`);
  console.log(`============================================================`);

  const queue = loadQueue();
  const pendingCount = queue.filter(item => item.status === 'pending').length;

  if (pendingCount === 0) {
    console.log(`✨ No pending videos in queue!`);
    console.log(`👉 Add YouTube URLs to queue/urls.txt or queue/videos_queue.json to process.`);
    return;
  }

  console.log(`Found ${pendingCount} pending video(s). Processing strictly ONE AT A TIME...\n`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    if (item.status !== 'pending') {
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`▶️ Processing video ${i + 1}/${queue.length}: ${item.url}`);
    console.log(`------------------------------------------------------------`);

    item.status = 'processing';
    saveQueue(queue);

    const startTime = Date.now();
    const result: SingleVideoAnalysisResult = await processSingleVideo(item.url, item.category, item.niche);
    const durationMs = Date.now() - startTime;

    if (result.success) {
      item.status = 'completed';
      item.processedAt = new Date().toISOString();
      item.result = {
        youtubeId: result.youtubeId,
        title: result.title,
        creator: result.creator,
        cpm: result.cpm,
        introCpm: result.cpmIntro,
        wpm: result.wpm,
        vsi: result.vsi,
        cameraSwitches: result.cameraSwitches,
        punchZooms: result.punchZooms,
        slowPushIns: result.slowPushIns,
        cutsCount: result.cutsCount,
        supabaseId: result.supabaseId,
        processDurationSec: Math.round(durationMs / 1000)
      };
      item.error = null;
      console.log(`\n✅ VIDEO COMPLETED & INGESTED INTO SUPABASE IN ${Math.round(durationMs / 1000)}s!`);
      console.log(`   - Title: "${result.title}" by ${result.creator}`);
      console.log(`   - WPM: ${result.wpm} | CPM: ${result.cpm} | VSI: ${result.vsi}s`);
      console.log(`   - Camera Switches: ${result.cameraSwitches} | Punch Zooms: ${result.punchZooms} | Slow Push-Ins: ${result.slowPushIns}`);
    } else {
      item.status = 'error';
      item.processedAt = new Date().toISOString();
      item.error = result.error || 'Unknown analysis error';
      console.error(`\n❌ FAILED TO PROCESS: ${item.url}`);
      console.error(`   - Reason: ${item.error}`);
    }

    saveQueue(queue);
    console.log(`💾 Saved state to queue/videos_queue.json.`);
  }

  console.log(`\n============================================================`);
  console.log(`🏁 ALL QUEUE JOBS FINISHED!`);
  console.log(`============================================================`);

  console.log(`\n============================================================`);
  console.log(`🔄 SYNCING ALL VIDEOS FROM SUPABASE TO src/data/videos.ts...`);
  console.log(`============================================================`);
  try {
    const dbService = new VideoDbService();
    const allVideos = await dbService.searchVideos({});
    if (allVideos && allVideos.length > 0) {
      const destPath = path.join(process.cwd(), 'src/data/videos.ts');
      const fileContent = `// Auto-synchronized dataset of high-retention reference videos with thumbnail blueprints & real metrics\nimport { VideoData } from "@/types";\n\nexport const VIDEOS_DATA: VideoData[] = ${JSON.stringify(allVideos, null, 2)};\n`;
      fs.writeFileSync(destPath, fileContent, 'utf8');
      console.log(`✅ Successfully synced ${allVideos.length} videos to src/data/videos.ts!`);
    }
  } catch (syncErr: any) {
    console.warn(`⚠️ Warning syncing to src/data/videos.ts:`, syncErr.message);
  }
}

if (require.main === module) {
  runSequentialQueue().catch(err => {
    console.error(`Fatal queue runner error:`, err);
    process.exit(1);
  });
}

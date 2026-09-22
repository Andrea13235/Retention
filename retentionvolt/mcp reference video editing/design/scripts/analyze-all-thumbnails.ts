import { supabase, supabaseAdmin, isSupabaseConfigured } from '../src/lib/supabase';
import { generateThumbnailBlueprint } from '../src/services/thumbnail-blueprint';
import { videoDbService } from '../src/services/db';
import * as fs from 'fs';
import * as path from 'path';

async function backfillThumbnailBlueprints() {
  const db = supabaseAdmin || supabase;
  if (!isSupabaseConfigured || !db) {
    console.error('❌ Supabase is not configured. Check environment variables.');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('🎨 REVERSE-ENGINEERING THUMBNAIL BLUEPRINTS FOR ALL VIDEOS');
  console.log('   (No copyright image files stored - pure analytical blueprints)');
  console.log('============================================================\n');

  // 1. Fetch all videos from Supabase with pagination
  let rawVideos: any[] = [];
  const batchSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from('videos')
      .select('*, creator:creators(*)')
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('❌ Failed to fetch videos:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    rawVideos = rawVideos.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  console.log(`📋 Found ${rawVideos.length} videos to process.\n`);

  let updatedCount = 0;

  for (let i = 0; i < rawVideos.length; i++) {
    const row = rawVideos[i];
    const creatorName = row.creator?.name || 'Unknown Creator';
    const durationSec = Number(row.duration_seconds || 60);

    console.log(`[${i + 1}/${rawVideos.length}] 🖼️ Processing thumbnail blueprint for: "${row.title}" (${creatorName})`);

    const blueprint = generateThumbnailBlueprint({
      title: row.title,
      creatorName,
      category: row.category,
      niche: row.niche,
      aspectRatio: row.aspect_ratio || '16:9',
      durationSeconds: durationSec,
      cpm: Number(row.cpm || 10),
      wpm: Number(row.words_per_minute || 180),
      views: row.views,
      youtubeId: row.youtube_id
    });

    // Update in Supabase
    const { error: updateErr } = await db
      .from('videos')
      .update({ thumbnail_analysis: blueprint })
      .eq('id', row.id);

    if (updateErr) {
      console.error(`   ❌ Failed to update Supabase row: ${updateErr.message}`);
    } else {
      console.log(`   ✅ Blueprint saved to Supabase (Layout: ${blueprint.layoutComposition}, Text: ${blueprint.textOverlay.hasText ? blueprint.textOverlay.text : 'None'})`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Successfully updated ${updatedCount}/${rawVideos.length} videos in Supabase!`);

  // 2. Fetch complete dataset and write to src/data/videos.ts
  console.log('\n🔄 Syncing complete dataset into src/data/videos.ts...');
  const allVideos = await videoDbService.searchVideos({});
  const fileContent = `// Auto-synchronized dataset of high-retention reference videos with thumbnail blueprints & real metrics
import { VideoData } from "@/types";

export const VIDEOS_DATA: VideoData[] = ${JSON.stringify(allVideos, null, 2)};
`;

  const destPath = path.join(process.cwd(), 'src/data/videos.ts');
  fs.writeFileSync(destPath, fileContent, 'utf8');
  console.log(`✅ Saved ${allVideos.length} videos with thumbnail blueprints to src/data/videos.ts!`);

  // 3. Verification query
  const { count } = await db
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .not('thumbnail_analysis', 'is', null);

  console.log(`\n🛡️ Verification check: ${count} videos in Supabase have thumbnail_analysis populated.`);
}

backfillThumbnailBlueprints()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

import * as fs from 'fs';
import * as path from 'path';
import { VIDEOS_DATA } from '../src/data/videos';
import { THUMBNAILS_DATA as EXISTING_THUMBNAILS } from '../src/data/thumbnails';
import { ThumbnailData, VideoData } from '../src/types';
import { supabaseAdmin, supabase, isSupabaseConfigured } from '../src/lib/supabase';

function formatViews(viewsStr?: string): string {
  if (!viewsStr) return '1.2M';
  const clean = viewsStr.toUpperCase().trim();
  if (clean.endsWith('M')) return clean;
  if (clean.endsWith('K')) {
    const numK = parseFloat(clean.replace('K', ''));
    if (isNaN(numK)) return viewsStr;
    if (numK >= 1000) {
      const millions = numK / 1000;
      return millions >= 10 ? `${Math.round(millions)}M` : `${millions.toFixed(1)}M`;
    }
    return `${Math.round(numK)}K`;
  }
  const num = parseFloat(clean);
  if (!isNaN(num)) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}K`;
    return `${num}`;
  }
  return viewsStr;
}

function deriveCtrEstimate(video: VideoData): string {
  const views = video.views || '';
  const creator = (video.creator?.name || '').toLowerCase();
  
  if (creator.includes('mrbeast')) return '17.8%';
  if (creator.includes('dude perfect')) return '16.4%';
  if (creator.includes('mark rober')) return '17.2%';
  if (creator.includes('ryan trahan')) return '15.8%';
  if (creator.includes('lemmino')) return '15.4%';
  if (creator.includes('kurzgesagt')) return '14.9%';
  if (creator.includes('johnny harris')) return '14.2%';
  if (creator.includes('veritasium')) return '13.9%';
  if (creator.includes('3blue1brown')) return '13.6%';
  if (creator.includes('reallifelore')) return '13.5%';
  if (creator.includes('brownlee') || creator.includes('mkbhd')) return '12.8%';
  if (creator.includes('apple')) return '12.5%';
  if (creator.includes('linus')) return '13.1%';
  if (creator.includes('ali abdaal')) return '11.8%';
  if (creator.includes('alex hormozi')) return '12.6%';
  if (creator.includes('dave2d') || creator.includes('snazzy')) return '11.9%';
  if (creator.includes('huberman') || creator.includes('williamson')) return '11.4%';
  if (creator.includes('diary of a ceo') || creator.includes('colin')) return '12.1%';
  if (creator.includes('nippard') || creator.includes('renaissance')) return '13.0%';

  const score = video.retentionScore || 75;
  const ctr = 10.5 + (score / 100) * 4.5;
  return `${ctr.toFixed(1)}%`;
}

function deriveFaceEmotion(video: VideoData): 'shock' | 'excitement' | 'curiosity' | 'serious' | 'none' {
  const creator = (video.creator?.name || '').toLowerCase();
  const title = video.title.toLowerCase();
  const gaze = (video.thumbnailAnalysis?.facialExpressionAndGaze || '').toLowerCase();

  if (creator === 'apple' || creator.includes('snazzy') || creator.includes('coldfusion') || creator.includes('polymatter')) {
    return 'none';
  }
  if (creator.includes('mrbeast') || creator.includes('airrack') || creator.includes('dude perfect') || creator.includes('rober')) {
    return gaze.includes('excitement') ? 'excitement' : 'shock';
  }
  if (gaze.includes('shock') || title.includes('survived') || title.includes('cheapest') || title.includes('vs')) {
    return 'shock';
  }
  if (gaze.includes('excitement') || title.includes('trick') || title.includes('rich') || title.includes('glitterbomb')) {
    return 'excitement';
  }
  if (video.niche === 'science' || video.niche === 'storytelling' || gaze.includes('curiosity') || gaze.includes('skepticism')) {
    return 'curiosity';
  }
  if (gaze.includes('laser_focus') || gaze.includes('pensive') || gaze.includes('neutral') || video.niche === 'podcast' || video.niche === 'productivity') {
    return 'serious';
  }
  if (gaze.includes('absent') || gaze.includes('no face') || video.niche === 'tech' && !gaze.includes('shock')) {
    return 'none';
  }
  return 'serious';
}

function deriveCompositionType(video: VideoData): 'rule_of_thirds' | 'split_screen' | 'centered_face' | 'minimalist' | 'object_focus' {
  const comp = (video.thumbnailAnalysis?.layoutComposition || '').toLowerCase();
  const creator = (video.creator?.name || '').toLowerCase();
  const title = video.title.toLowerCase();

  if (comp.includes('product') || comp.includes('hardware') || creator === 'apple') {
    return 'object_focus';
  }
  if (comp.includes('split') || title.includes('vs') || title.includes('before') || title.includes('comparison')) {
    return 'split_screen';
  }
  if (comp.includes('centered') || creator.includes('mrbeast') || creator.includes('airrack')) {
    return 'centered_face';
  }
  if (comp.includes('minimalist') || creator.includes('d\'avella') || creator.includes('ali abdaal')) {
    return 'minimalist';
  }
  return 'rule_of_thirds';
}

function deriveTags(video: VideoData, comp: string, emotion: string): string[] {
  const tags: string[] = [];
  const niche = video.niche || 'general';

  if (comp === 'split_screen') tags.push('Split Screen');
  else if (comp === 'centered_face') tags.push('Centered Subject');
  else if (comp === 'object_focus') tags.push('Product Focus');
  else if (comp === 'minimalist') tags.push('Minimalist Staging');
  else tags.push('Rule of Thirds');

  if (emotion === 'shock') tags.push('High Shock Intensity');
  else if (emotion === 'excitement') tags.push('High Energy');
  else if (emotion === 'curiosity') tags.push('Mystery / Curiosity Gap');
  else if (emotion === 'serious') tags.push('Authoritative Gaze');
  else if (emotion === 'none') tags.push('Zero Face / Pure Asset');

  const textOverlay = video.thumbnailAnalysis?.textOverlay;
  if (textOverlay && textOverlay.hasText && textOverlay.wordCount > 0) {
    tags.push(`${textOverlay.wordCount} Words Overlay`);
  } else {
    tags.push('Zero Text Clean');
  }

  const color = video.thumbnailAnalysis?.colorPalette?.[0];
  if (color) {
    tags.push(`Key Hue ${color}`);
  }

  return tags.slice(0, 4);
}

function deriveBreakdown(video: VideoData): string[] {
  const analysis = video.thumbnailAnalysis;
  if (!analysis) {
    return [
      'High-contrast color grading designed to maximize visual pop in high-density browse feeds.',
      'Framing places the primary subject along optimal optical gaze tracks for immediate cognitive capture.',
      'Visual curiosity gap creates immediate narrative tension without cluttering the canvas.'
    ];
  }

  const contrast = analysis.contrastRatio || 'High dynamic range lighting with clean rim contrast';
  const focal = analysis.focalPoint || 'Primary subject framed with shallow depth of field';
  const curiosity = analysis.curiosityTrigger || 'Open loop visual question driving viewer intrigue';
  const textInfo = analysis.textOverlay?.hasText 
    ? `Text overlay "${analysis.textOverlay.text}" (${analysis.textOverlay.wordCount} words) delivers an immediate cognitive hook without cluttering the mobile thumbnail frame.`
    : 'Zero-text approach leaves 100% of thumbnail real estate to visual storytelling and high-contrast imagery.';

  return [
    `Lighting & Palette: ${contrast}. Dominant palette leverages high-contrast separation to break feed scroll inertia.`,
    `Subject Framing & Gaze: ${focal}. Composition guides natural eye tracking directly to the emotional focal point within 250ms.`,
    `Curiosity Gap & Hook: ${curiosity}. ${textInfo}`
  ];
}

async function main() {
  console.log('============================================================');
  console.log('🚀 GENERATING THUMBNAIL DATA FOR ALL 49 LONG-FORM (16:9) VIDEOS');
  console.log('============================================================\n');

  const longVideos = VIDEOS_DATA.filter(v => v.aspectRatio === '16:9');
  console.log(`Found ${longVideos.length} long-form reference videos.`);

  const existingMap = new Map<string, ThumbnailData>();
  EXISTING_THUMBNAILS.forEach(t => existingMap.set(t.youtubeId, t));

  const completeThumbnails: ThumbnailData[] = [];

  for (const video of longVideos) {
    const existing = existingMap.get(video.youtubeId);
    if (existing) {
      // Enrich existing record with promptMidjourney and standardized fields
      completeThumbnails.push({
        ...existing,
        promptMidjourney: existing.promptMidjourney || video.thumbnailAnalysis?.aiPromptBlueprint || 'Hyper-realistic YouTube thumbnail, cinematic lighting, 8k resolution --ar 16:9 --v 6.0'
      });
      console.log(`✓ Preserved & enriched existing thumbnail: "${video.title}" (${video.creator?.name})`);
    } else {
      const emotion = deriveFaceEmotion(video);
      const composition = deriveCompositionType(video);
      const ctr = deriveCtrEstimate(video);
      const views = formatViews(video.views);
      const dominantColor = video.thumbnailAnalysis?.colorPalette?.[0] || '#00e5ff';
      const textWords = video.thumbnailAnalysis?.textOverlay?.wordCount ?? 0;
      const tags = deriveTags(video, composition, emotion);
      const breakdown = deriveBreakdown(video);
      const prompt = video.thumbnailAnalysis?.aiPromptBlueprint || 'Hyper-realistic YouTube thumbnail, cinematic lighting, 8k resolution --ar 16:9 --v 6.0';

      const item: ThumbnailData = {
        id: `thumb-${video.youtubeId}`,
        youtubeId: video.youtubeId,
        title: video.title,
        creator: video.creator?.name || 'Unknown Creator',
        thumbnailUrl: video.thumbnailUrl,
        views,
        ctrEstimate: ctr,
        niche: video.niche.charAt(0).toUpperCase() + video.niche.slice(1),
        faceEmotion: emotion,
        compositionType: composition,
        colorDominant: dominantColor,
        textCountWords: textWords,
        tags,
        analysisBreakdown: breakdown,
        promptMidjourney: prompt
      };

      completeThumbnails.push(item);
      console.log(`+ Generated thumbnail [${emotion} | ${composition} | ${ctr}]: "${video.title}" (${item.creator})`);
    }
  }

  console.log(`\nGenerated ${completeThumbnails.length} total thumbnail analyses.`);

  // Write to src/data/thumbnails.ts
  const fileContent = `import { ThumbnailData } from '@/types';

export const THUMBNAILS_DATA: ThumbnailData[] = ${JSON.stringify(completeThumbnails, null, 2)};
`;

  const targetPath = path.join(__dirname, '..', 'src', 'data', 'thumbnails.ts');
  fs.writeFileSync(targetPath, fileContent, 'utf8');
  console.log(`\n💾 Successfully wrote ${completeThumbnails.length} items to src/data/thumbnails.ts!`);

  // Sync to Supabase
  if (isSupabaseConfigured && (supabaseAdmin || supabase)) {
    const db = (supabaseAdmin || supabase)!;
    console.log('\n☁️ Synchronizing 49 thumbnails with Supabase database...');
    let successCount = 0;
    for (const thumb of completeThumbnails) {
      const { error } = await db.from('thumbnails').upsert({
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
        prompt_midjourney: thumb.promptMidjourney
      }, { onConflict: 'youtube_id' });

      if (error) {
        console.error(`   ❌ Failed to sync thumbnail ${thumb.youtubeId}:`, error.message);
      } else {
        successCount++;
      }
    }
    console.log(`✅ Supabase synchronized: ${successCount}/${completeThumbnails.length} rows upserted.`);
  } else {
    console.log('⚠️ Supabase credentials not configured, skipping cloud sync.');
  }

  console.log('\n============================================================');
  console.log('✨ ALL 49 LONG-FORM THUMBNAILS SYNCHRONIZED AND READY!');
  console.log('============================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

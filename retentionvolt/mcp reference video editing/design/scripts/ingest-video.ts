import * as fs from 'fs';
import * as path from 'path';
import { ElevenLabsService } from '../src/services/elevenlabs';
import { VideoDbService } from '../src/services/db';
import { VideoData } from '../src/types';

/**
 * CLI Video Ingestion Pipeline
 * Usage:
 *   npx ts-node scripts/ingest-video.ts <path-to-audio-file> [youtubeId] [title] [creator]
 */
async function run() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('❌ Error: Missing required arguments.');
    console.error('Usage: npx ts-node scripts/ingest-video.ts <path-to-audio-file> <youtubeId> [title] [creator]');
    process.exit(1);
  }

  const audioFilePath = args[0];
  const youtubeId = args[1].trim();
  const title = args[2] || 'Analyzed Video Reference';
  const creatorName = args[3] || 'Anonymous Creator';

  console.log('🚀 Starting CyberMCP Video Reference Ingestion...');

  const elevenlabs = new ElevenLabsService();
  const db = new VideoDbService();

  let transcription;

  if (audioFilePath && fs.existsSync(audioFilePath)) {
    console.log(`🎙️ Transcribing audio file with ElevenLabs Scribe STT: ${audioFilePath}`);
    const fileBuffer = fs.readFileSync(audioFilePath);
    transcription = await elevenlabs.transcribeAudio(fileBuffer, path.basename(audioFilePath));
  } else {
    console.log('ℹ️ No audio file provided or file not found. Using reference benchmark data.');
    transcription = elevenlabs.getMockTranscription();
  }

  const metrics = transcription.calculatedMetrics!;
  console.log(`✅ Transcription Complete!`);
  console.log(`   - Language: ${transcription.language_code}`);
  console.log(`   - Words: ${metrics.totalWords}`);
  console.log(`   - WPM: ${metrics.wordsPerMinute}`);
  console.log(`   - Dead Air Gaps (>0.4s): ${metrics.deadAirCount} (${metrics.deadAirTotalSec}s, ${metrics.deadAirPercentage}%)`);
  console.log(`   - Hook Pacing (0-30s): ${metrics.hookWpm} WPM`);

  // Build VideoData object
  const videoPayload: VideoData = {
    id: youtubeId,
    youtubeId: youtubeId,
    youtubeUrl: `https://youtube.com/watch?v=${youtubeId}`,
    title: title,
    creator: {
      name: creatorName,
      handle: `@${creatorName.toLowerCase().replace(/\s+/g, '')}`,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      subscribers: '1.2M'
    },
    duration: `${Math.round(metrics.durationSeconds)}s`,
    durationSeconds: metrics.durationSeconds,
    cpm: 18,
    cpmIntro: 24,
    averageShotLengthSec: 3.3,
    wordsPerMinute: metrics.wordsPerMinute,
    deadAirPercentage: metrics.deadAirPercentage,
    retentionScore: 91,
    hookDurationSec: 5,
    category: 'long_form',
    niche: 'productivity',
    tags: ['retention', 'minimalist', 'high-wpm'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=450&fit=crop',
    aspectRatio: '16:9',
    views: '850K',
    editingAdvice: {
      hookTactic: 'Dynamic kinetic text + Proof card within first 5 seconds',
      bodyPacing: 'Visual element change every 2.4s to match 200+ WPM speech',
      soundDesign: 'Subtle riser on transition, zero decorative whooshes',
      motionStyle: 'Clean/restrained with Apple-minimal easing curve'
    },
    cuts: [
      { timeSeconds: 0, label: 'Hook Opener', type: 'motion_graphic', description: 'Kinetic text pop' },
      { timeSeconds: 2.4, label: 'Proof Object', type: 'motion_graphic', description: 'Timer countdown ring' },
      { timeSeconds: 5.3, label: 'Context Frame', type: 'motion_graphic', description: 'Player mockup' },
      { timeSeconds: 7.9, label: 'Suspense Beat', type: 'jump_cut', description: 'Card fade' }
    ],
    motionGraphicIds: ['MG-001', 'MG-002', 'MG-003'],
    transcriptRaw: transcription.words,
    transcriptText: transcription.text
  };

  const result = await db.ingestVideo(videoPayload);
  console.log(`🎉 Ingested reference video into CyberMCP database! ID: ${result.id}`);
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Ingestion failed:', err);
    process.exit(1);
  });
}

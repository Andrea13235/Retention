import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapping: youtubeId -> { niche, category, tags }
const nicheMap: Record<string, { niche: string; tags?: string[] }> = {
  // === TECH ===
  'ohqxP8EEumo': { niche: 'tech', tags: ['tech', 'review', 'apple', 'smartphone', 'high-retention'] },  // MKBHD iPhone 18 Pro
  'eHYaESEzFHc': { niche: 'tech', tags: ['tech', 'review', 'apple', 'iphone', 'high-retention'] },      // Dave2D iPhone 18 Pro Max
  'e1E-yfcKdUw': { niche: 'tech', tags: ['tech', 'apple', 'commentary', 'high-retention'] },            // Snazzy Labs Apple Is Falling Apart
  'AkK_n5Q8M38': { niche: 'tech', tags: ['tech', 'pc', 'build', 'budget', 'high-retention'] },         // Linus CHEAPEST PC
  'Cb1Dv565f2I': { niche: 'tech', tags: ['tech', 'apple', 'vr', 'immersive', 'high-retention'] },      // Marques 50h Apple Vision Pro
  'fundOLJehWA': { niche: 'tech', tags: ['tech', 'science', 'longevity', 'cleo-abram', 'high-retention'] }, // Cleo Abram Dog 80 Years
  'NuvA32_dmtg': { niche: 'tech', tags: ['tech', 'ai', 'mcp', 'filmmaking', 'high-retention'] },        // GPT-6 Astra + Higgsfield MCP
  'PBrYMBacnyM': { niche: 'tech', tags: ['tech', 'apple', 'iphone', 'shorts', 'high-retention'] },     // iPhone 17 scratch resistant short
  'uJdjKOBikTE': { niche: 'tech', tags: ['tech', 'apple', 'animation', 'shorts', 'high-retention'] },  // This iPhone Duo Animation
  'aircAruvnKk': { niche: 'science', tags: ['science', 'ai', 'neural-network', 'education', 'high-retention'] }, // 3Blue1Brown neural network

  // === FINANCE ===
  'A5w-dEgIU1M': { niche: 'finance', tags: ['finance', 'wall-street', 'math', 'story', 'high-retention'] }, // The Equation That Beat Wall Street
  '9TwzN5wak8A': { niche: 'finance', tags: ['finance', 'mortgage', 'dave-ramsey', 'real-estate', 'high-retention'] }, // Graham Stephan mortgage
  '-Zi1m8hzK8I': { niche: 'finance', tags: ['finance', 'billionaire', 'interview', 'business', 'high-retention'] }, // Noah Kagan Billionaire
  'O6DrQJ5OOlU': { niche: 'motivation', tags: ['motivation', 'mindset', 'finance', 'dark', 'high-retention'] }, // Iman Gadzhi Dark Motivation
  'GgSNvCY-AcY': { niche: 'finance', tags: ['finance', 'passive-income', 'ali-abdaal', 'business', 'high-retention'] }, // Ali Abdaal passive income
  'pkXrny5QZLU': { niche: 'finance', tags: ['finance', 'spotify', 'story', 'documentary', 'high-retention'] }, // MagnatesMedia Spotify
  'nVtb2vNUOdU': { niche: 'finance', tags: ['finance', 'nvidia', 'stock', 'tech', 'high-retention'] }, // ColdFusion Nvidia
  'uQTosk4xLT8': { niche: 'finance', tags: ['finance', 'geopolitics', 'china', 'political', 'high-retention'] }, // PolyMatter China
  'FbSNfj2S6Pw': { niche: 'productivity', tags: ['productivity', 'tips', 'long-form', 'high-retention'] }, // 5 Essential Productivity Tips
  'mAJOpO73d8Y': { niche: 'productivity', tags: ['productivity', 'notion', 'tutorial', 'course', 'high-retention'] }, // Notion Databases

  // === SCIENCE ===
  'GE-lAftuQgc': { niche: 'science', tags: ['science', 'ocean', 'education', 'vsauce', 'high-retention'] }, // The Ocean Is Deep
  '7pOXunRYJIw': { niche: 'science', tags: ['science', 'physics', 'slow-motion', 'guns', 'high-retention'] }, // Smarter Every Day Suppressor
  'eCMmmEEyOO0': { niche: 'science', tags: ['science', 'physics', 'veritasium', 'education', 'high-retention'] }, // Slinky Drop Answer
  'n3Xv_g3g-mA': { niche: 'science', tags: ['science', 'psychology', 'loneliness', 'education', 'high-retention'] }, // Kurzgesagt Loneliness
  '2gOubOLfU8E': { niche: 'finance', tags: ['finance', 'federal-reserve', 'shorts', 'education', 'high-retention'] }, // Federal Reserve Short

  // === FITNESS ===
  '12xHxUnBEiI': { niche: 'fitness', tags: ['fitness', 'back', 'training', 'science', 'high-retention'] }, // Jeff Nippard Back Training
  'QSrGsPXv_Cw': { niche: 'fitness', tags: ['fitness', 'gym', 'beginners', 'mistakes', 'high-retention'] }, // Renaissance Periodization Gym Mistakes
  'RTgJSQtvo88': { niche: 'fitness', tags: ['fitness', 'sleep', 'huberman', 'health', 'high-retention'] }, // Huberman Sleep Toolkit

  // === ENTERTAINMENT ===
  '0e3GPea1Tyg': { niche: 'entertainment', tags: ['entertainment', 'mrbeast', 'squid-game', 'challenge', 'high-retention'] }, // MrBeast Squid Game
  'A2FsgKoGD04': { niche: 'entertainment', tags: ['entertainment', 'dude-perfect', 'trick-shots', 'sports', 'high-retention'] }, // Dude Perfect Trick Shots
  'hFZFjoX2cGg': { niche: 'entertainment', tags: ['entertainment', 'mark-rober', 'squirrel', 'engineering', 'high-retention'] }, // Mark Rober Squirrel Maze
  '5gXyaw1RWek': { niche: 'entertainment', tags: ['entertainment', 'airrack', 'challenge', 'mall', 'high-retention'] }, // Airrack Mall Survival
  'h4T_LlK1VE4': { niche: 'entertainment', tags: ['entertainment', 'mark-rober', 'glitterbomb', 'porch-pirates', 'high-retention'] }, // Mark Rober Glitterbomb
  '1WEAJ-DFkHE': { niche: 'entertainment', tags: ['entertainment', 'mrbeast', 'travel', 'budget', 'high-retention'] }, // MrBeast $1 vs $500k Plane
  'WodxTmx_eOw': { niche: 'entertainment', tags: ['entertainment', 'comedy', 'movies', 'reality', 'high-retention'] }, // Movies vs Reality
  'USspP9TFii0': { niche: 'science', tags: ['science', 'tech', 'cleo-abram', 'shorts', 'high-retention'] }, // Cleo Abram Device Short
  'ouss9FuL5Lk': { niche: 'science', tags: ['science', 'military', 'aviation', 'shorts', 'high-retention'] }, // Fighter Jets Short
  'iRWWU_FPjeE': { niche: 'science', tags: ['science', 'privacy', 'tech', 'shorts', 'high-retention'] }, // Peace Sign Selfies Short
  'LiH-P4rSkLI': { niche: 'entertainment', tags: ['entertainment', 'quiz', 'classroom', 'shorts', 'high-retention'] }, // Classroom Quiz Short

  // === PODCAST ===
  'AcK_zgJjnoo': { niche: 'podcast', tags: ['podcast', 'diary-of-a-ceo', 'psychology', 'interview', 'high-retention'] }, // Diary of a CEO Lie Detector
  '8son5OkbC90': { niche: 'podcast', tags: ['podcast', 'modern-wisdom', 'huberman', 'health', 'high-retention'] }, // Modern Wisdom Huberman
  'iKx3gAODybU': { niche: 'podcast', tags: ['podcast', 'lex-fridman', 'history', 'vikings', 'high-retention'] }, // Lex Fridman Vikings
  '80yPdZRKb34': { niche: 'podcast', tags: ['podcast', 'colin-samir', 'creator', 'interview', 'high-retention'] }, // Colin & Samir Chicken Shop Date

  // === STORYTELLING ===
  'CbUjuwhQPKs': { niche: 'storytelling', tags: ['storytelling', 'mystery', 'lemmino', 'documentary', 'high-retention'] }, // LEMMiNO D.B. Cooper
  'uDbR4lf7Zbw': { niche: 'storytelling', tags: ['storytelling', 'essay', 'culture', 'documentary', 'high-retention'] }, // Moon Dystopian Movie
  'Dr4lseoF82c': { niche: 'storytelling', tags: ['storytelling', 'tom-scott', 'history', 'documentary', 'high-retention'] }, // Tom Scott Thomas Tank Engine
  '7rd6HWqvaHQ': { niche: 'entertainment', tags: ['entertainment', 'animation', '3d', 'zack-films', 'high-retention'] }, // Zack D Films Time Machine

  // === FILMMAKING ===
  'XlYWZRf_IKM': { niche: 'filmmaking', tags: ['filmmaking', 'cinema', 'dan-mace', 'education', 'high-retention'] }, // Dan Mace How to Master Filmmaking
  'iyWyliFoCuk': { niche: 'filmmaking', tags: ['filmmaking', 'vfx', 'corridor-crew', 'cgi', 'high-retention'] }, // Corridor Crew VFX React
  'GsojLuJpe_0': { niche: 'filmmaking', tags: ['filmmaking', 'maps', 'documentary', 'motion', 'high-retention'] }, // How I Make My Maps
  'gLkbK8h_9fc': { niche: 'storytelling', tags: ['storytelling', 'engineering', 'history', 'documentary', 'high-retention'] }, // How Channel Tunnel Works

  // === MOTIVATION / PRODUCTIVITY ===
  '9z8_YhWoq2o': { niche: 'productivity', tags: ['productivity', 'social-media', 'digital-detox', 'experiment', 'high-retention'] }, // I quit social media
  'P14HA83uNJE': { niche: 'motivation', tags: ['motivation', 'ambition', 'productivity', 'essay', 'high-retention'] }, // Ambitious video
  '7wR41pLPoy0': { niche: 'productivity', tags: ['productivity', 'meditation', 'mindfulness', 'shorts', 'high-retention'] }, // Meditation short
  '7ITff1fIbSc': { niche: 'productivity', tags: ['productivity', 'audience', 'growth', 'creator', 'high-retention'] }, // How to Grow 0 Followers
  'jRPh01ehL7Q': { niche: 'storytelling', tags: ['storytelling', 'nas-daily', 'amazon', 'short-doc', 'high-retention'] }, // Nas Daily Amazon
};

async function main() {
  console.log('🔄 Starting niche bulk update...\n');

  let updated = 0;
  let errors = 0;

  for (const [youtubeId, data] of Object.entries(nicheMap)) {
    const updatePayload: Record<string, any> = { niche: data.niche };
    if (data.tags) updatePayload.tags = data.tags;

    const { error } = await supabase
      .from('videos')
      .update(updatePayload)
      .eq('youtube_id', youtubeId);

    if (error) {
      console.error(`❌ [${youtubeId}] Error: ${error.message}`);
      errors++;
    } else {
      console.log(`✅ [${youtubeId}] → ${data.niche}`);
      updated++;
    }
  }

  console.log(`\n🎉 Done! ${updated} updated, ${errors} errors.`);

  // Show final distribution
  const { data: videos } = await supabase.from('videos').select('youtube_id, niche, title');
  if (videos) {
    const dist: Record<string, number> = {};
    videos.forEach(v => dist[v.niche] = (dist[v.niche] || 0) + 1);
    console.log('\n📊 Final niche distribution:');
    Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => {
      console.log(`   ${n}: ${c} videos`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

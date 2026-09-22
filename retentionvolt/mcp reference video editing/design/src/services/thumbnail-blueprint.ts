import { ThumbnailAnalysis } from '@/types';

interface VideoContext {
  title: string;
  creatorName: string;
  category: string;
  niche: string;
  aspectRatio: '16:9' | '9:16';
  durationSeconds: number;
  cpm: number;
  wpm: number;
  views?: string;
  youtubeId: string;
}

/**
 * Reverse-engineers the psychological thumbnail blueprint and generative AI prompt
 * based on the video's virality metrics, format, creator archetype, and niche.
 * Does NOT store or redistribute copyright image files.
 */
export function generateThumbnailBlueprint(ctx: VideoContext): ThumbnailAnalysis {
  const isVertical = ctx.aspectRatio === '9:16';
  const ratioFlag = isVertical ? '--ar 9:16' : '--ar 16:9';
  const titleLower = ctx.title.toLowerCase();
  const creatorLower = ctx.creatorName.toLowerCase();

  // 1. MrBeast Archetype (High-stakes challenge, impossible scale, high saturation)
  if (creatorLower.includes('mrbeast') || titleLower.includes('vs') || titleLower.includes('challenge') || titleLower.includes('quiz') || titleLower.includes('squid game')) {
    const hasMonetaryText = ctx.title.match(/(\$[0-9,]+K?|\b[0-9]+\b)/i);
    const textSnippet = hasMonetaryText ? hasMonetaryText[0] : (isVertical ? 'PASS THIS?' : '');

    return {
      layoutComposition: isVertical ? 'vertical_stacked_dilemma' : 'hero_centered_depth_scale',
      focalPoint: `High-energy host framed prominently with wide-open expressive eyes and dynamic hand gesture, positioned against an impossible high-stakes background environment with intense visual depth.`,
      facialExpressionAndGaze: 'wide_eyed_shock_direct_contact (Direct pupil lock on the viewer to instantly interrupt scroll momentum in the YouTube feed).',
      textOverlay: {
        hasText: Boolean(textSnippet),
        text: textSnippet || undefined,
        wordCount: textSnippet ? textSnippet.split(' ').length : 0,
        textStyle: 'Ultra-heavy geometric sans-serif (Impact / Montserrat Black), high-contrast white fill with thick 12px black stroke and vivid yellow drop-glow.',
        reason: textSnippet ? 'Instantly conveys the astronomical stakes and numerical curiosity gap.' : 'Visual scale is so overwhelming that text is deliberately omitted to maximize curiosity.'
      },
      colorPalette: ['#FF0055', '#00A86B', '#FFD700', '#0055FF', '#FFFFFF'],
      contrastRatio: 'Extremely High (Hyper-saturated subject rim light with complementary neon background hues, +25% saturation boost).',
      curiosityTrigger: 'Stakes & Impossible Scale Gap: Viewer questions how an individual could assemble or survive such an immense real-world setup.',
      aiPromptBlueprint: `Hyper-realistic YouTube thumbnail, energetic expressive host centered looking straight into camera with shocked wide eyes and open mouth, dramatic dual rim lighting in cyan and magenta, massive epic scale arena filled with hundreds of detailed elements in the deep background, hyper-saturated vivid colors, clean studio focus on face, photorealistic 8k, cinematic depth of field, commercial advertising photography style ${ratioFlag} --v 6.0 --style raw`
    };
  }

  // 2. Visual Journalism / Documentary / Johnny Harris / Vox Style
  if (ctx.category === 'documentary' || creatorLower.includes('johnny harris') || creatorLower.includes('wendover') || creatorLower.includes('reallifelore')) {
    const topicWord = ctx.title.split(' ').slice(0, 2).join(' ').toUpperCase();

    return {
      layoutComposition: 'split_depth_documentary_infographic',
      focalPoint: `Tactile 3D topographic relief map or geopolitical schematic illuminated with dimensional paper textures, glowing border vectors, and historical archival documents in floating perspective.`,
      facialExpressionAndGaze: 'investigative_curiosity_neutral (Intense investigative stare or candid archival subject silhouette looking toward the unfolding geopolitical crisis).',
      textOverlay: {
        hasText: true,
        text: topicWord,
        wordCount: topicWord.split(' ').length,
        textStyle: 'Understated editorial grotesk or classic serif typography, vintage cream `#F4E8C1` with subtle charcoal drop shadow, perfectly aligned to the grid.',
        reason: 'Signals high-value intellectual investigative journalism rather than clickbait sensationalism.'
      },
      colorPalette: ['#F4E8C1', '#1E2A38', '#D9381E', '#3D4852', '#0D1117'],
      contrastRatio: 'Chiaroscuro Cinematic (Warm incandescent desk lamp lighting washing over tactile textures surrounded by deep moody oceanic navy).',
      curiosityTrigger: 'Hidden Truth / Secret History Gap: Visualizes an unseen border, secret economic highway, or historical manipulation.',
      aiPromptBlueprint: `Editorial documentary YouTube thumbnail, detailed 3D topographic paper relief map of terrain with glowing contour lines, vintage cartography aesthetic, warm incandescent desk lamp directional light, soft film grain, archival photo overlay, cinematic color grading, national geographic quality, depth of field ${ratioFlag} --v 6.0`
    };
  }

  // 3. Tech Review / Modern AI / Higgsfield / MKBHD Style
  if (ctx.niche === 'tech' || creatorLower.includes('marques') || creatorLower.includes('mkbhd') || creatorLower.includes('higgsfield') || creatorLower.includes('linus') || titleLower.includes('iphone') || titleLower.includes('pc') || titleLower.includes('mcp') || titleLower.includes('ai')) {
    const techHero = titleLower.includes('iphone') ? 'Flagship Smartphone' : (titleLower.includes('pc') ? 'Custom Hardware Rig' : 'Futuristic AI Hologram Interface');

    return {
      layoutComposition: 'hero_product_depth_split',
      focalPoint: `Floating ${techHero} rendered in pristine macro focus with razor-sharp specular reflections, flanked by the creator looking critically at the device with subtle side profile.`,
      facialExpressionAndGaze: 'critical_evaluation_laser_focus (Analytical, highly discerning expression conveying technical skepticism and premium authority).',
      textOverlay: {
        hasText: true,
        text: titleLower.includes('ai') ? 'AI MADE THIS' : 'DON\'T BUY',
        wordCount: 2,
        textStyle: 'Minimalist Swiss typography (Helvetica Neue Bold), clean matte white or electric neon orange `#FF5500`, positioned in the upper-left safe zone.',
        reason: 'Delivers a definitive contrarian hook that challenges consumer assumptions.'
      },
      colorPalette: ['#0A0A0A', '#1F1F1F', '#FF4500', '#00E5FF', '#F5F5F7'],
      contrastRatio: 'Studio Precision Contrast (Dramatic dual key-lights with dark studio background, isolating device edges with razor-thin specular flares).',
      curiosityTrigger: 'Contrarian Verdict & Hardware Leap: Viewer needs to know if the newly released product is groundbreaking or a catastrophic failure.',
      aiPromptBlueprint: `Commercial tech product YouTube thumbnail, sleek futuristic hardware device floating in zero gravity with laser-etched details and iridescent glass reflections, dramatic studio rim lighting with deep charcoal background, cinematic macro photography, 85mm f/1.4 lens, razor sharp focus, high-end Apple commercial aesthetic ${ratioFlag} --v 6.0`
    };
  }

  // 4. Science / Philosophy / Veritasium / Kurzgesagt Style
  if (creatorLower.includes('veritasium') || creatorLower.includes('kurzgesagt') || creatorLower.includes('3blue1brown') || titleLower.includes('equation') || titleLower.includes('neural') || titleLower.includes('loneliness') || titleLower.includes('ocean')) {
    return {
      layoutComposition: 'paradox_concept_juxtaposition',
      focalPoint: `Central paradoxical concept or impossible geometric structure rendered in glowing mathematical luminescence, challenging natural laws of physics or human perception.`,
      facialExpressionAndGaze: 'analytical_skepticism_thoughtful (Pensive intellectual gaze questioning an open formula, or absent in favor of pure conceptual animation).',
      textOverlay: {
        hasText: true,
        text: titleLower.includes('equation') ? 'THE EQUATION' : 'IMPOSSIBLE',
        wordCount: 1,
        textStyle: 'Monospace scientific sans-serif or glowing neon typography, pure electric cyan `#00F0FF` with ambient atmospheric bloom.',
        reason: 'Frames the entire video as an intellectual mystery waiting to be solved.'
      },
      colorPalette: ['#00F0FF', '#121214', '#FF003C', '#2A2A38', '#FFFFFF'],
      contrastRatio: 'High Dynamic Range Luminescence (Blinding luminous formulas emerging from pitch-black cosmic vacuum).',
      curiosityTrigger: 'Intellectual Paradox: A visually impossible scenario that makes the viewer immediately question common sense.',
      aiPromptBlueprint: `Conceptual science YouTube thumbnail, luminous geometric glowing equation floating in a dark cosmic void with volumetric starlight, hyper-detailed visualization of physics and mathematics, dramatic cinematic contrast, glowing electric cyan and deep indigo, Unreal Engine 5 render, 8k resolution ${ratioFlag} --v 6.0`
    };
  }

  // 5. Self-Mastery / Productivity / Business (Ali Abdaal, Alex Hormozi, Matt D'Avella, Thomas Frank)
  if (ctx.niche === 'productivity' || ctx.niche === 'finance' || creatorLower.includes('abdaal') || creatorLower.includes('hormozi') || creatorLower.includes('d\'avella') || creatorLower.includes('frank')) {
    const isHormozi = creatorLower.includes('hormozi');
    const textVal = isHormozi ? 'START HERE' : '30 DAYS';

    return {
      layoutComposition: 'clean_minimalist_split_transformation',
      focalPoint: `Creator framed waist-up in a sunlit modern minimalist studio or raw podcast setup, gesturing directly toward a high-contrast visual comparison or step-by-step progress framework.`,
      facialExpressionAndGaze: isHormozi ? 'intense_discipline_uncompromising_conviction' : 'approachable_mentor_calm_authority (Warm, friendly eye contact building instant psychological trust).',
      textOverlay: {
        hasText: true,
        text: textVal,
        wordCount: 2,
        textStyle: isHormozi ? 'Heavy condensed sans in emergency yellow `#FFE600` on black pill banner' : 'Clean Apple-style sans-serif with subtle drop shadow',
        reason: 'Reduces an overwhelming life challenge down to a concrete, immediately actionable decision.'
      },
      colorPalette: ['#FFFFFF', '#18181B', '#F59E0B', '#10B981', '#E4E4E7'],
      contrastRatio: 'High Key Cleanliness (Diffused softbox beauty lighting, warm wooden accents, zero visual clutter, immaculate depth).',
      curiosityTrigger: 'Transformation & Efficiency Gap: Promises a drastic life improvement or financial unlock through a counter-intuitive daily ritual.',
      aiPromptBlueprint: `YouTube thumbnail of an inspiring mentor in a modern minimalist aesthetic studio, warm directional key light, clean Scandinavian interior design background, holding a clean notebook or looking intensely at camera, vibrant gold and crisp white color palette, professional editorial photography, 8k ${ratioFlag} --v 6.0`
    };
  }

  // 6. Shorts / High Pacing Viral Hooks (Zack D. Films, Cleo Abram, Humphrey Yang)
  return {
    layoutComposition: isVertical ? 'vertical_central_focal_burst' : 'cinematic_wide_rule_of_thirds',
    focalPoint: `Ultra-detailed focal element depicted at the exact instant of critical transition or danger, cropped tight to force immediate visual comprehension on mobile screens.`,
    facialExpressionAndGaze: 'urgent_reaction_high_stakes (Heightened dramatic tension with focus locked on the physical interaction).',
    textOverlay: {
      hasText: true,
      text: 'WATCH THIS',
      wordCount: 2,
      textStyle: 'Bold condensed block typography, neon yellow fill with 8px black stroke for instantaneous readability on 3-inch mobile screens.',
      reason: 'Mobile feeds require less than 0.2 seconds of comprehension time.'
    },
    colorPalette: ['#FFE600', '#FF1E1E', '#09090B', '#FFFFFF', '#3B82F6'],
    contrastRatio: 'Hyper-Contrasted Dynamic (Maximized luminance difference between subject edges and background elements).',
    curiosityTrigger: 'Unbelievable Moment Frozen in Time: Captures a bizarre or dangerous phenomenon mid-motion.',
    aiPromptBlueprint: `High-impact YouTube thumbnail, dramatic central action moment frozen in time with high-velocity motion blur, intense rim lighting in vivid neon yellow and deep crimson, sharp detailed focal subject, cinematic hyper-realism, 8k resolution ${ratioFlag} --v 6.0`
  };
}

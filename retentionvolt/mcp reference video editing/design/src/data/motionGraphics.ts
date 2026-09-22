import { MotionGraphicItem } from '@/types';

export const MOTION_GRAPHICS_DATA: MotionGraphicItem[] = [
  {
    id: 'MG-001',
    title: 'Kinetic Word-Pop Hook',
    register: 'clean/restrained',
    category: 'kinetic_text',
    sourceCreator: 'Apple / Ali Abdaal',
    sourceTimestamp: '00:01 - 00:03',
    description: 'Words pop and scale in one at a time, center-anchored with subtle motion blur. Creates immediate subconscious readability without visual clutter.',
    durationSec: 2.4,
    rebuildFormula: 'Scale 0.8 -> 1.05 -> 1.0 (overshoot easing cubic-out) + opacity 0 -> 1. Stagger 110ms per word. Font: Inter or SF Pro Display Bold.',
    codeSnippet: `// CSS Animation Keyframes
@keyframes wordPop {
  0% { opacity: 0; transform: scale(0.85); }
  70% { opacity: 1; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1.0); }
}
.word-pop {
  animation: wordPop 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}`,
    previewType: 'text_pop',
    accentColor: '#ffffff'
  },
  {
    id: 'MG-002',
    title: 'iOS-Style Timer Card (Proof Object)',
    register: 'clean/restrained',
    category: 'timer_card',
    sourceCreator: 'Ali Abdaal / Vox',
    sourceTimestamp: '00:03 - 00:06',
    description: 'Pill-shaped glassmorphic card with circular countdown dial in pure white. Pairs spoken claims ("in under 5 minutes") with an objective visual twin.',
    durationSec: 2.9,
    rebuildFormula: 'Rounded pill rect (radius 24px) + background blur(12px). Circular SVG ring with stroke-dashoffset transition over spoken duration.',
    codeSnippet: `<div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
  <svg className="w-6 h-6 -rotate-90">
    <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeDasharray="63" strokeDashoffset="18" />
  </svg>
  <span className="font-mono font-bold text-white text-sm">04:59 REMAINING</span>
</div>`,
    previewType: 'timer_ring',
    accentColor: '#ffffff'
  },
  {
    id: 'MG-003',
    title: 'Fake Player Mockup (Context Frame)',
    register: 'clean/restrained',
    category: 'player_mockup',
    sourceCreator: 'Vox / MKBHD / Apple',
    sourceTimestamp: '00:05 - 00:08',
    description: 'Simplified dark 16:9 mockup player floating over clean background with a single high-contrast accent progress bar. Eliminates browser chrome distractions.',
    durationSec: 3.2,
    rebuildFormula: '16:9 container with 16px corner radius, drop shadow 0 20px 40px rgba(0,0,0,0.4). Progress line animated from 0% to 35% with linear ease.',
    codeSnippet: `<div className="relative aspect-video rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-2xl">
  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
    <div className="h-full bg-white transition-all duration-1000 w-[35%]" />
  </div>
</div>`,
    previewType: 'mockup',
    accentColor: '#ffffff'
  },
  {
    id: 'MG-004',
    title: 'High-Impact Price/Stat Stamp',
    register: 'loud/energetic',
    category: 'kinetic_text',
    sourceCreator: 'MrBeast',
    sourceTimestamp: '00:01 - 00:02',
    description: 'Huge bold stat or price ($456,000) that slams onto screen with slight screen-shake and bass-drop audio sync.',
    durationSec: 1.5,
    rebuildFormula: 'Scale from 2.0 -> 1.0 in 150ms with camera shake (translate ±4px for 3 frames). Impact sound effect at frame 4.',
    codeSnippet: `.stat-slam {
  animation: slam 0.18s cubic-bezier(0.85, 0, 0.15, 1) forwards;
}
@keyframes slam {
  0% { transform: scale(2.2); opacity: 0; filter: blur(6px); }
  100% { transform: scale(1.0); opacity: 1; filter: blur(0); }
}`,
    previewType: 'text_pop',
    accentColor: '#ff005b'
  },
  {
    id: 'MG-005',
    title: 'Topographic Vector Path Sweep',
    register: 'documentary',
    category: 'data_viz',
    sourceCreator: 'Johnny Harris / Vox',
    sourceTimestamp: '00:09 - 00:14',
    description: 'Glowing vector stroke that draws itself along geographical borders or line charts while camera executes a smooth 3D parallax tilt.',
    durationSec: 4.8,
    rebuildFormula: 'SVG path with stroke-dasharray and stroke-dashoffset: pathLength -> 0. Blend mode: screen or add over vintage paper texture.',
    codeSnippet: `<svg className="w-full h-32">
  <path d="M10,80 Q95,10 180,60 T350,30" fill="none" stroke="#ffffff" strokeWidth="3"
    className="animate-[dash_3s_ease-in-out_forwards]" strokeDasharray="500" strokeDashoffset="0" />
</svg>`,
    previewType: 'chart',
    accentColor: '#ff7324'
  },
  {
    id: 'MG-006',
    title: 'Paper Texture Whip Transition',
    register: 'documentary',
    category: 'transition',
    sourceCreator: 'Johnny Harris / MagnatesMedia',
    sourceTimestamp: '00:04 - 00:05',
    description: 'Analog ripped paper edge wiping across the screen at 1/12s with synchronized tearing Foley.',
    durationSec: 0.6,
    rebuildFormula: 'Horizontal translate -100% -> 100% in 180ms with 3-frame stop motion jitter (step-end easing).',
    codeSnippet: `.paper-rip {
  mask-image: url('/textures/paper-rip.png');
  transition: transform 0.2s cubic-bezier(0.77, 0, 0.175, 1);
}`,
    previewType: 'whip_pan',
    accentColor: '#ffd700'
  }
];

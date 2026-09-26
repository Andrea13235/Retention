import { GenAITier } from "./types";

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthlyEur: number;
  creditsMonthly: number;
  popular?: boolean;
  description: string;
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "plan_starter",
    name: "Creator Starter",
    priceMonthlyEur: 29,
    creditsMonthly: 300,
    description: "Ideal for solo creators publishing 2-3 shorts or long videos per week.",
    features: [
      "Up to 30 Eco edits or 12 Balanced edits",
      "Claude Opus Editorial Intelligence",
      "Meta Muse Voice STT (word-level)",
      "Native RetentionVolt Blueprints",
      "Full HD 1080p NVENC GPU Render",
      "High-CTR Thumbnail generator",
    ],
  },
  {
    id: "plan_pro",
    name: "Pro Studio",
    priceMonthlyEur: 59,
    creditsMonthly: 750,
    popular: true,
    description: "Designed for serious YouTubers and TikTok creators scaling weekly output.",
    features: [
      "Up to 75 Eco edits or 30 Balanced edits",
      "Priority Modal.com GPU Queue",
      "Claude Opus Deep Retention Analysis",
      "Higgsfield DoP Generative B-Roll",
      "4K Ultra-HD NVENC Render",
      "Custom Brand Presets & Fonts",
    ],
  },
  {
    id: "plan_agency",
    name: "Agency Virality",
    priceMonthlyEur: 149,
    creditsMonthly: 2200,
    description: "Maximum throughput for agencies, media houses and multi-channel teams.",
    features: [
      "Up to 220 Eco edits or 90 Balanced edits",
      "Dedicated GPU Instance on Modal",
      "Higgsfield Cinematic Pro (4 clips/video)",
      "Direct API & Webhook Access",
      "Unlimited High-CTR Covers",
      "Dedicated Slack Priority Support",
    ],
  },
];

export const CREDIT_RATES = {
  BASE_EDIT: 10, // 10 credits for full autonomous HyperFrames edit
  GENAI_BROLL_CLIP: 15, // 15 credits per Higgsfield AI B-roll clip
  THUMBNAIL_COVER: 5, // 5 credits per AI thumbnail
};

export function calculateJobCredits(tier: GenAITier): number {
  switch (tier) {
    case "eco":
      return CREDIT_RATES.BASE_EDIT; // 10 credits
    case "balanced":
      return CREDIT_RATES.BASE_EDIT + CREDIT_RATES.GENAI_BROLL_CLIP; // 25 credits (1 clip)
    case "cinematic":
      return CREDIT_RATES.BASE_EDIT + CREDIT_RATES.GENAI_BROLL_CLIP * 3; // 55 credits (3 clips)
    default:
      return CREDIT_RATES.BASE_EDIT;
  }
}

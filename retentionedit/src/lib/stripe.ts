import Stripe from "stripe";

// Server-side Stripe client singleton
let stripeInstance: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is missing from environment variables.");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia" as any,
      typescript: true,
      appInfo: {
        name: "RetentionEdit",
        version: "1.0.0",
      },
    });
  }
  return stripeInstance;
}

export type PlanId = "free" | "starter" | "pro" | "agency";
export type BillingInterval = "month" | "year";

export interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  monthlyPriceEur: number;
  annualPriceEurPerMonth: number;
  annualPriceEurTotal: number;
  monthlyPriceId: string;
  annualPriceId: string;
  creditsMonthly: number;
  popular?: boolean;
  features: string[];
  capabilities: {
    maxGenAITier: "eco" | "balanced" | "cinematic";
    maxResolution: "1080p" | "4k";
    fps: 30 | 60;
    priorityQueue: boolean;
    dedicatedGpu: boolean;
    customBranding: boolean;
    directApi: boolean;
    unlimitedCovers: boolean;
    vipSupport: boolean;
  };
}

export const STRIPE_PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free Trial",
    description: "Experience autonomous AI editing with free initial starter credits.",
    monthlyPriceEur: 0,
    annualPriceEurPerMonth: 0,
    annualPriceEurTotal: 0,
    monthlyPriceId: "",
    annualPriceId: "",
    creditsMonthly: 25,
    features: [
      "25 Starter credits",
      "Eco Autonomous Edits",
      "Full HD 1080p NVENC GPU Render",
      "Meta Muse Voice STT (word-level)",
      "Standard queue processing",
    ],
    capabilities: {
      maxGenAITier: "balanced",
      maxResolution: "1080p",
      fps: 30,
      priorityQueue: false,
      dedicatedGpu: false,
      customBranding: false,
      directApi: false,
      unlimitedCovers: false,
      vipSupport: false,
    },
  },
  starter: {
    id: "starter",
    name: "Creator Starter",
    description: "Ideal for solo creators publishing 2-3 shorts or long videos per week.",
    monthlyPriceEur: 29,
    annualPriceEurPerMonth: 19,
    annualPriceEurTotal: 228,
    monthlyPriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY || "price_1UK0AiV056aEazqQ4tMYd0Hy",
    annualPriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL || "price_1UK0AiV056aEazqQVXwcKwHr",
    creditsMonthly: 300,
    features: [
      "300 Credits / month (Rolls over)",
      "Claude Opus Editorial Intelligence",
      "Meta Muse Voice STT (word-level)",
      "Native RetentionVolt Blueprints",
      "Full HD 1080p NVENC GPU Render",
      "Balanced GenAI 2.5D Cutaways",
      "High-CTR Thumbnail generator",
      "No Watermark & Full Commercial Rights",
    ],
    capabilities: {
      maxGenAITier: "balanced",
      maxResolution: "1080p",
      fps: 30,
      priorityQueue: false,
      dedicatedGpu: false,
      customBranding: false,
      directApi: false,
      unlimitedCovers: false,
      vipSupport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro Studio",
    description: "Designed for serious YouTubers and TikTok creators scaling watch-time.",
    monthlyPriceEur: 59,
    annualPriceEurPerMonth: 39,
    annualPriceEurTotal: 468,
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_1UK0AjV056aEazqQ8485RglH",
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || "price_1UK0AjV056aEazqQMZnvC5CM",
    creditsMonthly: 750,
    popular: true,
    features: [
      "750 Credits / month (Rolls over)",
      "Priority Modal.com GPU Queue (2x faster)",
      "Higgsfield DoP Cinematic Camera Moves",
      "Cinematic Pro Tier (Up to 4 AI cutaways)",
      "4K Ultra-HD NVENC 60FPS Hardware Export",
      "Custom Brand Presets & Fonts",
      "High-CTR Thumbnail generator included",
      "Claude Opus Deep Psychology Analysis",
    ],
    capabilities: {
      maxGenAITier: "cinematic",
      maxResolution: "4k",
      fps: 60,
      priorityQueue: true,
      dedicatedGpu: false,
      customBranding: true,
      directApi: false,
      unlimitedCovers: false,
      vipSupport: false,
    },
  },
  agency: {
    id: "agency",
    name: "Agency Virality",
    description: "Maximum throughput for agencies, media houses and multi-channel teams.",
    monthlyPriceEur: 149,
    annualPriceEurPerMonth: 99,
    annualPriceEurTotal: 1188,
    monthlyPriceId: process.env.STRIPE_PRICE_AGENCY_MONTHLY || "price_1UK0AkV056aEazqQu3dQTy9V",
    annualPriceId: process.env.STRIPE_PRICE_AGENCY_ANNUAL || "price_1UK0AkV056aEazqQdl29XShS",
    creditsMonthly: 2200,
    features: [
      "2,200 Credits / month (Rolls over)",
      "Dedicated GPU Instance on Modal.com",
      "Higgsfield Cinematic Pro (4 AI clips/video)",
      "Team Workspace & Multi-Seat Access",
      "Direct API & Webhook Dispatch",
      "Unlimited High-CTR Covers",
      "Dedicated VIP Slack Channel Support",
    ],
    capabilities: {
      maxGenAITier: "cinematic",
      maxResolution: "4k",
      fps: 60,
      priorityQueue: true,
      dedicatedGpu: true,
      customBranding: true,
      directApi: true,
      unlimitedCovers: true,
      vipSupport: true,
    },
  },
};

export type FeatureKey =
  | "balanced_tier"
  | "cinematic_tier"
  | "export_4k"
  | "priority_queue"
  | "dedicated_gpu"
  | "custom_branding"
  | "direct_api"
  | "unlimited_covers";

export interface FeatureGateCheck {
  allowed: boolean;
  reason?: string;
  requiredPlan: PlanId;
  currentPlan: PlanId;
}

export function checkFeatureAccess(userPlan: PlanId = "free", feature: FeatureKey): FeatureGateCheck {
  const normPlan: PlanId = (["free", "starter", "pro", "agency"].includes(userPlan) ? userPlan : "free") as PlanId;
  const planCaps = STRIPE_PLANS[normPlan]?.capabilities;

  switch (feature) {
    case "balanced_tier":
      return { allowed: true, requiredPlan: "free", currentPlan: normPlan };

    case "cinematic_tier":
      if (normPlan === "free" || normPlan === "starter") {
        return {
          allowed: false,
          reason: "Il tier Cinematic Pro (fino a 4 scene Higgsfield con movimenti di camera avanzati) è un'esclusiva dei piani Pro Studio e Agency.",
          requiredPlan: "pro",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "pro", currentPlan: normPlan };

    case "export_4k":
      if (normPlan === "free" || normPlan === "starter") {
        return {
          allowed: false,
          reason: "L'esportazione video 4K Ultra-HD a 60 FPS richiede l'accesso Pro Studio o Agency con accelerazione hardware NVENC.",
          requiredPlan: "pro",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "pro", currentPlan: normPlan };

    case "priority_queue":
      if (normPlan === "free" || normPlan === "starter") {
        return {
          allowed: false,
          reason: "La coda di rendering prioritario GPU su Modal.com richiede il piano Pro Studio o Agency.",
          requiredPlan: "pro",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "pro", currentPlan: normPlan };

    case "custom_branding":
      if (normPlan === "free" || normPlan === "starter") {
        return {
          allowed: false,
          reason: "La personalizzazione di font, stili del brand e preset richiede Pro Studio o Agency.",
          requiredPlan: "pro",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "pro", currentPlan: normPlan };

    case "dedicated_gpu":
      if (normPlan !== "agency") {
        return {
          allowed: false,
          reason: "L'istanza GPU serverless dedicata senza code di attesa è riservata al piano Agency Virality.",
          requiredPlan: "agency",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "agency", currentPlan: normPlan };

    case "direct_api":
      if (normPlan !== "agency") {
        return {
          allowed: false,
          reason: "L'accesso programmatico alle API dirette e ai webhook di RetentionEdit è riservato al piano Agency Virality.",
          requiredPlan: "agency",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "agency", currentPlan: normPlan };

    case "unlimited_covers":
      if (normPlan !== "agency") {
        return {
          allowed: false,
          reason: "La generazione illimitata di thumbnail e cover ad alto CTR senza consumo di crediti è inclusa nel piano Agency Virality.",
          requiredPlan: "agency",
          currentPlan: normPlan,
        };
      }
      return { allowed: true, requiredPlan: "agency", currentPlan: normPlan };

    default:
      return { allowed: true, requiredPlan: "free", currentPlan: normPlan };
  }
}

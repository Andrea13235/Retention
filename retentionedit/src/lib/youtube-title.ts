import type { RetentionBlueprint } from "./types";

/**
 * YouTube Viral Title Engine
 * Generates high-CTR, retention-optimized YouTube titles.
 * Follows proven patterns: curiosity gap, emotional hook, specificity,
 * power words, and eliminates raw camera filenames (e.g. IMG_0790).
 */
export function generateYouTubeTitle(params: {
  rawTitle: string;
  transcriptText?: string;
  niche?: string;
  blueprint?: RetentionBlueprint;
}): string {
  const { rawTitle, transcriptText = "", blueprint } = params;

  // 1. Check if rawTitle is a generic camera/device filename
  const isCameraFilename =
    /^(IMG|MOV|VID|DSC|MVI|PEX|CLIP|VIDEO|REC|SCREEN|UNTITLED)[-_0-9A-Z.]*$/i.test(rawTitle.trim()) ||
    /^video[0-9_-]*$/i.test(rawTitle.trim()) ||
    !rawTitle ||
    rawTitle.trim() === "Untitled edit" ||
    rawTitle.trim() === "Untitled Autonomous Edit";

  const cleanRaw = rawTitle
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  const textLower = (transcriptText + " " + cleanRaw).toLowerCase();

  // Detect language: Italian or English
  const isItalian =
    /\b(sono|questo|perch[eé]|guarda|video|oggi|come|quanto|soldi|fattura|ruzza|tutti|cosa|sempre|metodo|segreto|ciao|ragazzi|errore|guadagn|facciamo)\b/i.test(
      textLower
    );

  // If the user provided a real, descriptive title that is already good and not a camera filename:
  // e.g. "Quanto fattura Ruzza? Il 2026"
  if (!isCameraFilename && cleanRaw.length >= 8) {
    if (cleanRaw.includes("?") || cleanRaw.includes("!")) {
      return cleanRaw;
    }
    // Enhance existing title with curiosity kicker
    if (isItalian) {
      if (textLower.includes("quanto") || textLower.includes("fattura") || textLower.includes("soldi")) {
        return `${cleanRaw}: La Cifra Shock Svelata! (2026)`;
      }
      return `${cleanRaw} (Il Metodo Segreto del 2026)`;
    } else {
      return `${cleanRaw} (The 2026 Secret Blueprint)`;
    }
  }

  // Camera file (IMG_0790, etc.) or empty title: Generate a master YouTube title from transcript / blueprint!
  if (isItalian) {
    if (textLower.includes("fattura") || textLower.includes("soldi") || textLower.includes("guadagn") || textLower.includes("ruzza")) {
      return "Quanto Fattura Davvero nel 2026? La Cifra Shock Svelata!";
    }
    if (
      textLower.includes("retention") ||
      textLower.includes("edit") ||
      textLower.includes("video") ||
      textLower.includes("visualizzazion") ||
      textLower.includes("algoritm")
    ) {
      const candidates = [
        "Ho Scoperto il Segreto della Retention al 100% (Non Farlo Mai!)",
        "Come Rendere Virale Qualsiasi Video nel 2026 (Metodo Segreto)",
        "L'Errore che Distrugge i Tuoi Video nei Primi 3 Secondi!",
        "Ecco Come Trattenere il 100% degli Spettatori (Regola 2026)",
      ];
      return candidates[Math.abs(hashString(rawTitle)) % candidates.length];
    }
    if (textLower.includes("abitudin") || textLower.includes("tempo") || textLower.includes("produttiv") || textLower.includes("lavoro")) {
      return "Ho Cambiato la Mia Vita con Questa Sola Abitudine (Risultati Assurdi)";
    }
    if (textLower.includes("compra") || textLower.includes("tech") || textLower.includes("iphone") || textLower.includes("mac")) {
      return "Vale Davvero la Pena nel 2026? La Verità che Nessuno Dice";
    }

    // Default high-retention Italian YouTube titles based on blueprint
    const bpTitle = blueprint?.thumbnail?.title;
    if (bpTitle && bpTitle.length > 3 && !bpTitle.includes("DO THIS")) {
      return `${bpTitle}: Il Segreto che Nessuno ti Rivela (2026)`;
    }

    const defaultItalian = [
      "Non Fare MAI Più Questo Errore nei Tuoi Video! (Regola del 100%)",
      "Ho Provato Questa Strategia per 30 Giorni: Risultati Incredibili",
      "Il Segreto che Nessun Creator Vuole Rivelarti nel 2026",
      "Ecco Come Dominare l'Algoritmo nel 2026 (Guida Definitiva)",
    ];
    return defaultItalian[Math.abs(hashString(rawTitle)) % defaultItalian.length];
  }

  // English YouTube titles
  if (textLower.includes("retention") || textLower.includes("edit") || textLower.includes("hook") || textLower.includes("algorithm")) {
    const candidates = [
      "The 100% Retention Rule Every Creator Needs to Know (2026)",
      "Stop Making Videos Like This! (The Viral Blueprint)",
      "I Tested the Secret Retention Formula: Mind-Blowing Results",
      "How to Hook 100% of Viewers in the First 3 Seconds",
    ];
    return candidates[Math.abs(hashString(rawTitle)) % candidates.length];
  }

  if (textLower.includes("money") || textLower.includes("revenue") || textLower.includes("business") || textLower.includes("rich")) {
    return "How Much Does It REALLY Make in 2026? (The Shocking Truth)";
  }

  const defaultEnglish = [
    "The 100% Retention Rule Every Creator Needs to Know (2026)",
    "Do NOT Make This Huge Mistake in 2026! (Watch Before Uploading)",
    "I Tested This Secret Strategy for 30 Days (Crazy Results)",
    "The Ultimate Secret to Explode Your Views in 2026",
  ];
  return defaultEnglish[Math.abs(hashString(rawTitle)) % defaultEnglish.length];
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

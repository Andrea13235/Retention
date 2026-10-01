"use client";

import type { EditPlan, VideoFormat } from "./types";

/**
 * My Projects persistent store.
 *
 * - Metadata (title, cover, counts, remote URLs, editPlan) lives in localStorage.
 * - Uploaded video bytes live in IndexedDB (blob object URLs die on reload).
 * - Every mutation dispatches `retentionedit:projects-changed` on window so
 *   Home ("Recent projects") and the Projects tab stay in sync.
 */

export interface ProjectEntry {
  id: string;
  title: string;
  /** dataURL (captured frame) or /images/... path. "" = use live video frame. */
  coverUrl: string;
  /** Remote playable URL (https://... or /videos/...). "" = session blob in IDB. */
  videoUrl: string;
  clipsCount: number;
  createdAt: number;
  format: VideoFormat;
  /** "uploading" → card istantanea al click (upload chunked in corso);
   *  "processing" → card con animazione di caricamento; "ready" → card normale. */
  status?: "uploading" | "processing" | "ready";
  /** Percentuale upload chunked 0–100 (solo mentre status === "uploading"). */
  uploadPct?: number;
  /** Durata RAW (s) usata per l'ETA. */
  rawDuration?: number;
  /** Job reale su R2 (local_…): serve al resume dopo reload. */
  renderJobId?: string;
  /** Collezione a cui appartiene il progetto (es. Favorites, TikTok, ecc.) */
  collection?: string;
  /** Flag salvataggio nello storage permanente (Cloudflare R2 / Archivio). */
  savedToStorage?: boolean;
  /** EditPlan completo serializzato (cuts, zooms, karaoke subtitles) */
  editPlan?: EditPlan;
}

function getCurrentUserId(): string {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem("retentionedit_user_profile_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return "default";
}

export function getProjectStorageKey(userId?: string): string {
  const uid = (userId || getCurrentUserId()).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  return `retentionedit_projects_${uid}_v1`;
}

const MAX_ENTRIES = 12;
const EVENT_NAME = "retentionedit:projects-changed";

export function isBuggedOrStaleProject(item: ProjectEntry): boolean {
  if (!item || !item.id) return true;

  const lowerTitle = (item.title || "").toLowerCase();
  const lowerId = (item.id || "").toLowerCase();

  // 1. Remove Ruzza per user instruction
  if (lowerTitle.includes("ruzza") || lowerId.includes("ruzza") || lowerId === "seed-ruzza-2026") {
    return true;
  }

  // 2. Remove "L'Errore che Distrugge i Tuoi Video" per user instruction
  if (
    lowerTitle.includes("distrugge") ||
    lowerTitle.includes("errore che distrugge") ||
    lowerTitle.includes("primi 3 seco") ||
    lowerId.includes("distrugge")
  ) {
    return true;
  }

  // Non eliminiamo mai le card "processing": il montaggio reale è per-frame
  // e può durare minuti. Quelle vecchie verranno riprese al prossimo resume;
  // al limite l'utente le cancella con ☰ → Delete.

  return false;
}

export function sanitizeProjectEntry(item: ProjectEntry): ProjectEntry {
  // SOLO editing reale: si azzerano solo URL oggettivamente morti
  // (domini placeholder, bucket pubblici legacy). Niente blacklist demo:
  // raw-desktalk/raw-podcast sono sorgenti reali del pipeline.
  let videoUrl = item.videoUrl || "";
  if (
    videoUrl.includes("demo_retention") ||
    videoUrl.includes("cloudflarestorage.com")
  ) {
    videoUrl = "";
  }

  let coverUrl = item.coverUrl || "";
  if (coverUrl.includes("ruzza")) {
    coverUrl = "";
  }

  return {
    ...item,
    videoUrl,
    coverUrl,
  };
}

export function normalizeProjectTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "") // strip .mp4, .mov, etc.
    .replace(/\b(202[0-9]|clips?|edit|untitled)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function deduplicateProjects(list: ProjectEntry[]): ProjectEntry[] {
  const seenTitles = new Set<string>();
  const seenIds = new Set<string>();
  const result: ProjectEntry[] = [];

  // Filter out bugged, stale, or Ruzza projects, then sanitize paths
  const valid = list.filter((item) => !isBuggedOrStaleProject(item)).map(sanitizeProjectEntry);

  // Sort: uploading prima di tutto (l'ultimo click), poi ready, poi processing, poi newest first
  const sorted = [...valid].sort((a, b) => {
    if (a.status === "uploading" && b.status !== "uploading") return -1;
    if (b.status === "uploading" && a.status !== "uploading") return 1;
    if (a.status === "ready" && b.status === "processing") return -1;
    if (b.status === "ready" && a.status === "processing") return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  for (const item of sorted) {
    if (seenIds.has(item.id)) continue;
    const norm = normalizeProjectTitle(item.title);
    if (norm.length >= 3 && seenTitles.has(norm)) {
      continue; // Duplicate project card! Only keep one per video.
    }
    if (norm.length >= 3) seenTitles.add(norm);
    seenIds.add(item.id);
    result.push(item);
  }

  return result;
}

function purgeStaleLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("retentionedit_projects")) {
        const val = localStorage.getItem(k);
        if (
          val &&
          (val.includes("distrugge") ||
            val.includes("Distrugge") ||
            val.includes("ruzza") ||
            val.includes("primi 3 seco"))
        ) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) {
              const cleaned = arr.filter((item) => !isBuggedOrStaleProject(item));
              localStorage.setItem(k, JSON.stringify(cleaned));
            }
          } catch {}
        }
      }
    }
  } catch {}
}

if (typeof window !== "undefined") {
  purgeStaleLocalStorage();
}

function readAll(userId?: string): ProjectEntry[] {
  if (typeof window === "undefined") return [];
  purgeStaleLocalStorage();
  try {
    const key = getProjectStorageKey(userId);
    let raw = localStorage.getItem(key);
    // Legacy migration fallback for existing active user
    if (!raw && (!userId || userId === getCurrentUserId())) {
      raw = localStorage.getItem("retentionedit_projects_v1");
    }
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ProjectEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    
    // Purge solo URL oggettivamente morti (bucket pubblici legacy) — niente blacklist demo.
    for (const p of parsed) {
      if (
        p.videoUrl &&
        p.videoUrl.includes("cloudflarestorage.com")
      ) {
        p.videoUrl = "";
      }
      if (
        p.coverUrl &&
        p.coverUrl.includes("ruzza")
      ) {
        p.coverUrl = "";
      }
    }

    const deduped = deduplicateProjects(parsed);
    if (deduped.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(deduped));
      try {
        localStorage.setItem("retentionedit_projects_v1", JSON.stringify(deduped));
      } catch {}
    }
    return deduped;
  } catch {
    return [];
  }
}

function writeAll(entries: ProjectEntry[], userId?: string): void {
  if (typeof window === "undefined") return;
  const key = getProjectStorageKey(userId);
  try {
    const deduped = deduplicateProjects(entries);
    const sorted = deduped
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(key, JSON.stringify(sorted));
  } catch {
    // Quota exceeded: drop oldest entries and retry once.
    try {
      const deduped = deduplicateProjects(entries);
      const sorted = deduped
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5);
      localStorage.setItem(key, JSON.stringify(sorted));
    } catch {
      // ignore
    }
  }
}

export function loadProjectEntries(userId?: string): ProjectEntry[] {
  return readAll(userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function notifyProjectsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeProjectsChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, cb);
  return () => window.removeEventListener(EVENT_NAME, cb);
}

/** Insert or replace an entry, then notify listeners. */
export async function upsertProject(
  entry: ProjectEntry,
  blob: Blob | File | null,
  userId?: string
): Promise<void> {
  if (blob) {
    try {
      await putProjectBlob(entry.id, blob);
    } catch {
      // ignore — entry still saved with cover/remote URL
    }
  }
  const normNew = normalizeProjectTitle(entry.title);
  const all = readAll(userId).filter((e) => {
    if (e.id === entry.id) return false;
    if (normNew.length >= 3 && normalizeProjectTitle(e.title) === normNew) return false;
    if (entry.videoUrl && e.videoUrl && e.videoUrl === entry.videoUrl) return false;
    return true;
  });
  writeAll([entry, ...all], userId);
  notifyProjectsChanged();
}

export async function deleteProject(id: string, userId?: string): Promise<void> {
  writeAll(readAll(userId).filter((e) => e.id !== id), userId);
  try {
    await deleteProjectBlob(id);
  } catch {
    // ignore
  }
  notifyProjectsChanged();
}

/** Update specific fields of an existing project */
export function updateProject(id: string, patch: Partial<ProjectEntry>, userId?: string): void {
  const all = readAll(userId);
  const index = all.findIndex((e) => e.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...patch };
    writeAll(all, userId);
    notifyProjectsChanged();
  }
}

const COLLECTIONS_KEY = "retentionedit_collections_v1";
const DEFAULT_COLLECTIONS = ["Favorites", "TikTok / Reels", "YouTube Shorts", "Podcast Highlights"];

export function loadCollections(): string[] {
  if (typeof window === "undefined") return DEFAULT_COLLECTIONS;
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(DEFAULT_COLLECTIONS));
      return DEFAULT_COLLECTIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COLLECTIONS;
  } catch {
    return DEFAULT_COLLECTIONS;
  }
}

export function addCollection(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = loadCollections();
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
    } catch {}
    notifyProjectsChanged();
  }
}

/** A URL is replayable across reloads only if remote or absolute-path. */
export function isReplayableUrl(url: string): boolean {
  return /^(https?:\/\/|\/)/.test(url) && !url.startsWith("blob:");
}

/**
 * Resolve a playable URL for an entry: remote URL directly,
 * otherwise the persisted IndexedDB blob as a fresh object URL,
 * otherwise null (session expired → user must re-upload).
 */
const MEMORY_BLOB_CACHE = new Map<string, Blob>();

export async function getProjectVideoUrl(
  entry: ProjectEntry
): Promise<string | null> {
  // 1. ALWAYS check for physically rendered/edited video first
  try {
    const rendered = await getProjectBlob(`${entry.id}_rendered`);
    if (rendered && rendered.size > 0) return URL.createObjectURL(rendered);
  } catch {}

  // 2. Fallback to raw uploaded video
  try {
    const blob = await getProjectBlob(entry.id);
    if (blob) return URL.createObjectURL(blob);
  } catch {
    // ignore
  }

  // 3. If no blob, use entry.videoUrl se replayable (SOLO editing reale —
  // sorgente o MP4 montato; niente blacklist demo, solo bucket morti).
  if (
    entry.videoUrl &&
    isReplayableUrl(entry.videoUrl) &&
    !entry.videoUrl.includes("cloudflarestorage.com")
  ) {
    return entry.videoUrl;
  }

  return null;
}

/**
 * Cover della card: prima IDB (`<id>_cover`, PNG Higgsfield scaricata a fine
 * job), poi coverUrl remota. Così la copertina resta visibile dopo il reload
 * anche se l'URL firmato del server è scaduto.
 */
export async function getProjectCoverUrl(entry: ProjectEntry): Promise<string | null> {
  try {
    const cover = await getProjectBlob(`${entry.id}_cover`);
    if (cover && cover.size > 2048) return URL.createObjectURL(cover);
  } catch {
    // ignore — fallback sotto
  }
  if (entry.coverUrl && entry.coverUrl.length > 0) return entry.coverUrl;
  return null;
}

// ---------------------------------------------------------------------------
// IndexedDB blob storage (video bytes) with v3 isolation
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open("retentionedit-videos-v3", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("videos")) {
        req.result.createObjectStore("videos");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putProjectBlob(id: string, blob: Blob): Promise<void> {
  MEMORY_BLOB_CACHE.set(id, blob);
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("videos", "readwrite");
        tx.objectStore("videos").put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn("Failed to persist blob to IndexedDB:", err);
  }
}

export function getProjectBlobSync(id: string): Blob | null {
  return MEMORY_BLOB_CACHE.get(id) ?? null;
}

export async function getProjectBlob(id: string): Promise<Blob | null> {
  const cached = MEMORY_BLOB_CACHE.get(id);
  if (cached) return cached;
  try {
    const db = await openDb();
    try {
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction("videos", "readonly");
        const req = tx.objectStore("videos").get(id);
        req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
      if (blob) {
        MEMORY_BLOB_CACHE.set(id, blob);
        return blob;
      }
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
  return null;
}

async function deleteProjectBlob(id: string): Promise<void> {
  MEMORY_BLOB_CACHE.delete(id);
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("videos", "readwrite");
        tx.objectStore("videos").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

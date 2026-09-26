"use client";

import type { VideoFormat } from "./types";

/**
 * My Projects persistent store.
 *
 * - Metadata (title, cover, counts, remote URLs) lives in localStorage.
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
  /** "processing" → card con animazione di caricamento + ETA; "ready" → card normale. */
  status?: "processing" | "ready";
  /** Durata RAW (s) usata per l'ETA. */
  rawDuration?: number;
  /** True se il job include il voiceover ElevenLabs (pesa sull'ETA). */
  hasVoiceover?: boolean;
  /** Collezione a cui appartiene il progetto (es. Favorites, TikTok, ecc.) */
  collection?: string;
  /** Flag salvataggio nello storage permanente (Cloudflare R2 / Archivio). */
  savedToStorage?: boolean;
}

const STORAGE_KEY = "retentionedit_projects_v1";
const MAX_ENTRIES = 12;
const EVENT_NAME = "retentionedit:projects-changed";

const SEED_ENTRY: ProjectEntry = {
  id: "seed-ruzza-2026",
  title: "Quanto fattura Ruzza? Il 2025...",
  coverUrl: "/images/ruzza-thumb.png",
  videoUrl: "/videos/raw-vlog.mp4",
  clipsCount: 32,
  createdAt: new Date("2026-09-23T12:00:00").getTime(),
  format: "short",
};

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

  // Sort: prefer ready over processing, then newest first
  const sorted = [...list].sort((a, b) => {
    if (a.status === "ready" && b.status === "processing") return -1;
    if (b.status === "ready" && a.status === "processing") return 1;
    return b.createdAt - a.createdAt;
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

  if (result.length === 0) {
    result.push(SEED_ENTRY);
  }
  return result;
}

function readAll(): ProjectEntry[] {
  if (typeof window === "undefined") return [SEED_ENTRY];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([SEED_ENTRY]));
      return [SEED_ENTRY];
    }
    const parsed = JSON.parse(raw) as ProjectEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [SEED_ENTRY];
    
    // Auto-clean any duplicates from localStorage
    const deduped = deduplicateProjects(parsed);
    if (deduped.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
    }
    return deduped;
  } catch {
    return [SEED_ENTRY];
  }
}

function writeAll(entries: ProjectEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const deduped = deduplicateProjects(entries);
    const seed = deduped.filter((e) => e.id === SEED_ENTRY.id);
    const rest = deduped
      .filter((e) => e.id !== SEED_ENTRY.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ENTRIES - 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...rest, ...seed]));
  } catch {
    // Quota exceeded: drop oldest non-seed entries and retry once.
    try {
      const deduped = deduplicateProjects(entries);
      const seed = deduped.filter((e) => e.id === SEED_ENTRY.id);
      const rest = deduped
        .filter((e) => e.id !== SEED_ENTRY.id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...rest, ...seed]));
    } catch {
      // ignore — in-memory still works for this session
    }
  }
}

export function loadProjectEntries(): ProjectEntry[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
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
  blob: Blob | File | null
): Promise<void> {
  if (blob) {
    try {
      await putProjectBlob(entry.id, blob);
    } catch {
      // ignore — entry still saved with cover/remote URL
    }
  }
  const normNew = normalizeProjectTitle(entry.title);
  const all = readAll().filter((e) => {
    if (e.id === entry.id) return false;
    if (normNew.length >= 3 && normalizeProjectTitle(e.title) === normNew) return false;
    if (entry.videoUrl && e.videoUrl && entry.videoUrl !== "/videos/raw-vlog.mp4" && e.videoUrl === entry.videoUrl) return false;
    return true;
  });
  writeAll([entry, ...all]);
  notifyProjectsChanged();
}

export async function deleteProject(id: string): Promise<void> {
  writeAll(readAll().filter((e) => e.id !== id));
  try {
    await deleteProjectBlob(id);
  } catch {
    // ignore
  }
  notifyProjectsChanged();
}

/** Update specific fields of an existing project */
export function updateProject(id: string, patch: Partial<ProjectEntry>): void {
  const all = readAll();
  const index = all.findIndex((e) => e.id === id);
  if (index !== -1) {
    all[index] = { ...all[index], ...patch };
    writeAll(all);
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
export async function getProjectVideoUrl(
  entry: ProjectEntry
): Promise<string | null> {
  if (entry.videoUrl && isReplayableUrl(entry.videoUrl)) return entry.videoUrl;
  try {
    const blob = await getProjectBlob(entry.id);
    if (blob) return URL.createObjectURL(blob);
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// IndexedDB blob storage (video bytes)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open("retentionedit-projects", 1);
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
}

export async function getProjectBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction("videos", "readonly");
      const req = tx.objectStore("videos").get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function deleteProjectBlob(id: string): Promise<void> {
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
}

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PipelineJob } from "./types";

/**
 * Persistenza job su disco — SERVER ONLY.
 *
 * I job vivono in `<project>/.vault/jobs/<jobId>.json` (gitignored).
 * Sopravvivono al restart del server dev e permettono a status/result
 * di rispondere anche dopo un reload. Scrittura atomica best-effort
 * (tmp + rename); in caso di errore I/O la pipeline continua in-memory.
 */
function getBaseVaultDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production"
  );
  if (isServerless) {
    return path.join(process.env.TMPDIR || "/tmp", ".vault");
  }
  return path.join(process.cwd(), ".vault");
}

function jobsDir(): string {
  const dir = path.join(getBaseVaultDir(), "jobs");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

function jobPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(jobsDir(), `${safe}.json`);
}

export function persistJob(job: PipelineJob): void {
  const safe = job.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  try {
    const dest = jobPath(job.id);
    const tmp = `${dest}.tmp`;
    writeFileSync(tmp, JSON.stringify(job));
    renameSync(tmp, dest);
  } catch {
    // I/O fallito → la pipeline continua in-memory
  }

  // Cloud sync to Supabase storage bucket (cross-container/serverless resilience)
  import("@/lib/supabase").then(({ supabaseAdmin }) => {
    if (supabaseAdmin) {
      supabaseAdmin.storage
        .from("retentionedit_jobs")
        .upload(`${safe}.json`, JSON.stringify(job), { contentType: "application/json", upsert: true })
        .catch(() => {});
    }
  }).catch(() => {});
}

export async function persistJobAsync(job: PipelineJob): Promise<void> {
  persistJob(job);
  const safe = job.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    if (supabaseAdmin) {
      await supabaseAdmin.storage
        .from("retentionedit_jobs")
        .upload(`${safe}.json`, JSON.stringify(job), { contentType: "application/json", upsert: true });
    }
  } catch {}
}

export function loadJob(id: string): PipelineJob | null {
  const candidates = [jobPath(id), `${jobPath(id)}.tmp`];
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const parsed = JSON.parse(readFileSync(p, "utf8")) as PipelineJob;
      if (parsed && parsed.id === id) return parsed;
    } catch {
      // corrotto → prova il prossimo
    }
  }
  return null;
}

export async function loadJobAsync(id: string): Promise<PipelineJob | null> {
  const local = loadJob(id);
  if (local) return local;

  // Cloud fallback: fetch from Supabase storage bucket
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.storage
        .from("retentionedit_jobs")
        .download(`${safe}.json`);
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text) as PipelineJob;
        if (parsed && parsed.id === id) {
          // Cache locally in /tmp
          persistJob(parsed);
          return parsed;
        }
      }
    }
  } catch {}

  return null;
}

/** Ultimi N job persistiti (per eventuale ripresa). Mai i byte video, solo metadati. */
export function listRecentJobs(limit = 20): Array<{ id: string; title: string; createdAt: number }> {
  try {
    const dir = jobsDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .slice(0, limit)
      .map((f) => {
        try {
          const parsed = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as PipelineJob;
          return { id: parsed.id, title: parsed.title, createdAt: parsed.createdAt };
        } catch {
          return null;
        }
      })
      .filter((x): x is { id: string; title: string; createdAt: number } => x !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PipelineJob } from "./types";
import { sanitizeR2KeySegment } from "./r2";

/**
 * RetentionEdit — Isolated Job Persistence Store (Server-Only).
 *
 * Guarantees 100% tenant isolation:
 * - Jobs live in `<project>/.vault/jobs/<userId>/<jobId>.json`.
 * - Cloud backup lives in `retentionedit_jobs/<userId>/<jobId>.json`.
 * - Cross-user access (IDOR) is strictly rejected: a user cannot read another user's job.
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

function userJobsDir(userId: string): string {
  const safeUser = sanitizeR2KeySegment(userId || "default", 50);
  const dir = path.join(getBaseVaultDir(), "jobs", safeUser);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

function legacyJobsDir(): string {
  const dir = path.join(getBaseVaultDir(), "jobs");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function userJobPath(id: string, userId: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(userJobsDir(userId), `${safeId}.json`);
}

function legacyJobPath(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(legacyJobsDir(), `${safeId}.json`);
}

export function persistJob(job: PipelineJob): void {
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const safeUser = sanitizeR2KeySegment(job.userId || "default", 50);

  try {
    const dest = userJobPath(job.id, job.userId);
    const tmp = `${dest}.tmp`;
    writeFileSync(tmp, JSON.stringify(job));
    renameSync(tmp, dest);
  } catch {
    // I/O failed → continue in-memory
  }

  // Cloud sync to Supabase storage bucket under user-isolated prefix
  import("@/lib/supabase").then(({ supabaseAdmin }) => {
    if (supabaseAdmin) {
      supabaseAdmin.storage
        .from("retentionedit_jobs")
        .upload(`${safeUser}/${safeId}.json`, JSON.stringify(job), {
          contentType: "application/json",
          upsert: true,
        })
        .catch(() => {});
    }
  }).catch(() => {});
}

export async function persistJobAsync(job: PipelineJob): Promise<void> {
  persistJob(job);
  const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const safeUser = sanitizeR2KeySegment(job.userId || "default", 50);

  // R2 PRIMA (source of truth serverless — sopravvive alle invocation Vercel),
  // Supabase dopo (best-effort legacy). Senza R2 il job muore con /tmp.
  try {
    const { isR2Configured, uploadR2Object } = await import("@/lib/r2");
    if (isR2Configured()) {
      await uploadR2Object(
        `jobs/${safeUser}/${safeId}.json`,
        Buffer.from(JSON.stringify(job)),
        "application/json"
      );
      return;
    }
  } catch {}

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    if (supabaseAdmin) {
      await supabaseAdmin.storage
        .from("retentionedit_jobs")
        .upload(`${safeUser}/${safeId}.json`, JSON.stringify(job), {
          contentType: "application/json",
          upsert: true,
        });
    }
  } catch {}
}

export function loadJob(id: string, expectedUserId?: string): PipelineJob | null {
  const candidates: string[] = [];

  if (expectedUserId) {
    const uPath = userJobPath(id, expectedUserId);
    candidates.push(uPath, `${uPath}.tmp`);
  }

  // Legacy fallback candidates
  const lPath = legacyJobPath(id);
  candidates.push(lPath, `${lPath}.tmp`);

  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const parsed = JSON.parse(readFileSync(p, "utf8")) as PipelineJob;
      if (parsed && parsed.id === id) {
        // Strict ownership check if expectedUserId provided
        if (expectedUserId && parsed.userId !== expectedUserId) {
          return null; // IDOR protection: reject unauthorized access
        }
        return parsed;
      }
    } catch {
      // corrupted → try next
    }
  }
  return null;
}

export async function loadJobAsync(id: string, expectedUserId?: string): Promise<PipelineJob | null> {
  const local = loadJob(id, expectedUserId);
  if (local) return local;

  // R2 PRIMA (source of truth serverless), Supabase dopo (legacy).
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const safeUser = expectedUserId ? sanitizeR2KeySegment(expectedUserId, 50) : null;

  if (safeUser) {
    try {
      const { isR2Configured, downloadR2Object } = await import("@/lib/r2");
      if (isR2Configured()) {
        const buf = await downloadR2Object(`jobs/${safeUser}/${safeId}.json`);
        if (buf && buf.length > 0) {
          const parsed = JSON.parse(buf.toString("utf8")) as PipelineJob;
          if (parsed && parsed.id === id) {
            if (expectedUserId && parsed.userId !== expectedUserId) {
              return null; // IDOR protection
            }
            persistJob(parsed); // cache locale
            return parsed;
          }
        }
      }
    } catch {}
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    if (supabaseAdmin) {
      const pathsToTry = safeUser
        ? [`${safeUser}/${safeId}.json`, `${safeId}.json`]
        : [`${safeId}.json`];

      for (const remotePath of pathsToTry) {
        const { data, error } = await supabaseAdmin.storage
          .from("retentionedit_jobs")
          .download(remotePath);

        if (!error && data) {
          const text = await data.text();
          const parsed = JSON.parse(text) as PipelineJob;
          if (parsed && parsed.id === id) {
            if (expectedUserId && parsed.userId !== expectedUserId) {
              return null; // IDOR protection
            }
            // Cache locally in user folder
            persistJob(parsed);
            return parsed;
          }
        }
      }
    }
  } catch {}

  return null;
}

/** List recent jobs for a specific user. */
export function listRecentJobs(
  userId?: string,
  limit = 20
): Array<{ id: string; title: string; createdAt: number }> {
  try {
    const dir = userId ? userJobsDir(userId) : legacyJobsDir();
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

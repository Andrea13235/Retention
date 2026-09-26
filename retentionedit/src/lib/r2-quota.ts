import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

export type StorageQuotaPlan = "free" | "starter" | "pro" | "agency";
export const STORAGE_QUOTAS_GB: Record<StorageQuotaPlan, number> = {
  free: 10,
  starter: 50,
  pro: 200,
  agency: 1000,
};
export const STORAGE_QUOTAS_BYTES: Record<StorageQuotaPlan, number> = {
  free: 10 * 1024 ** 3,
  starter: 50 * 1024 ** 3,
  pro: 200 * 1024 ** 3,
  agency: 1000 * 1024 ** 3,
};

export interface StorageRecord {
  r2Key: string;
  userId: string;
  bytes: number;
  createdAt: number;
  kind: "raw" | "export" | "thumbnail";
}

function getVaultDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production"
  );
  const base = isServerless ? (process.env.TMPDIR || "/tmp") : process.cwd();
  return path.join(base, ".vault");
}

function ledgerPath(): string {
  return path.join(getVaultDir(), "r2-ledger.json");
}
function readLedger(): StorageRecord[] {
  try {
    if (!existsSync(ledgerPath())) return [];
    const raw = readFileSync(ledgerPath(), "utf8");
    const arr = JSON.parse(raw) as StorageRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeLedger(records: StorageRecord[]): void {
  try {
    mkdirSync(getVaultDir(), { recursive: true });
    writeFileSync(ledgerPath(), JSON.stringify(records, null, 2), { mode: 0o600 });
  } catch {
    // ignore
  }
}

export function usedBytesForUser(userId: string): number {
  return readLedger()
    .filter((r) => r.userId === userId)
    .reduce((sum, r) => sum + (Number.isFinite(r.bytes) ? r.bytes : 0), 0);
}

export function addStorageRecord(rec: StorageRecord): void {
  const all = readLedger();
  // Idempotent per r2Key
  const next = [rec, ...all.filter((r) => r.r2Key !== rec.r2Key)];
  writeLedger(next.slice(0, 5000));
}

export function removeStorageRecord(r2Key: string): void {
  writeLedger(readLedger().filter((r) => r.r2Key !== r2Key));
}

export function resolvePlan(plan: string | undefined): StorageQuotaPlan {
  const p = (plan || "free").toLowerCase();
  if (p === "pro" || p === "agency" || p === "starter" || p === "free") return p;
  return "free";
}

export function quotaBytesForPlan(plan: StorageQuotaPlan): number {
  return STORAGE_QUOTAS_BYTES[plan];
}

export function canFitUpload(params: { userId: string; plan: string | undefined; fileBytes: number }): {
  ok: boolean;
  quotaBytes: number;
  usedBytes: number;
  remainingBytes: number;
} {
  const resolved = resolvePlan(params.plan);
  const quota = quotaBytesForPlan(resolved);
  const used = usedBytesForUser(params.userId);
  const remaining = Math.max(0, quota - used);
  return { ok: used + params.fileBytes <= quota, quotaBytes: quota, usedBytes: used, remainingBytes: remaining };
}

// Dev helper: estimate local uploads dir usage for a user prefix (when ledger not yet hydrated)
export function estimateLocalUploadsBytes(prefix: string): number {
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(dir)) return 0;
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    let total = 0;
    for (const name of readdirSync(dir)) {
      if (prefix && !name.includes(prefix)) continue;
      try {
        total += statSync(path.join(dir, name)).size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

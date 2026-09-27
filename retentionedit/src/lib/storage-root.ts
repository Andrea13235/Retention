/**
 * RetentionEdit — writable storage root (SERVER ONLY).
 *
 * Local dev: <repo>/.vault (gitignored, persistent).
 * Vercel serverless: /tmp (only writable path; ephemeral per invocation).
 *
 * Jobs survive across polls on Vercel ONLY within the same warm instance.
 * For durable cross-instance jobs use R2 (download/upload) — the status
 * route already re-kicks runLocalJob from persisted state when present.
 *
 * Never import from client components.
 */
import { tmpdir } from "node:os";
import path from "node:path";

let cached: string | null = null;

export function storageRoot(): string {
  if (cached) return cached;
  // Vercel sets VERCEL=1; Lambda sets AWS_LAMBDA_FUNCTION_NAME.
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    cached = path.join(tmpdir(), "retentionedit-vault");
  } else {
    cached = path.join(process.cwd(), ".vault");
  }
  return cached;
}

/** True when running on ephemeral serverless storage. */
export function isEphemeralStorage(): boolean {
  return storageRoot().startsWith(tmpdir());
}

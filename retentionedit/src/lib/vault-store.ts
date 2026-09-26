/**
 * RetentionEdit — Secure server-side API key vault.
 *
 * SERVER ONLY (node:crypto + node:fs). Never import from client components.
 *
 * - Secrets entered in Settings → API Keys are AES-256-GCM encrypted at rest
 *   in `<project>/.vault/secrets.json` (gitignored, chmod 600 best-effort).
 * - The master key is `VAULT_MASTER_KEY` (64 hex chars) when set, otherwise a
 *   random key auto-generated once at `.vault/.key` (also gitignored).
 * - `.env.local` stays a valid fallback source; vault wins over env.
 * - Status/test endpoints NEVER return secret values — only booleans.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";

export const VAULT_PROVIDERS = [
  "anthropic",
  "meta_mms",
  "higgsfield",
  "modal",
  "meta_muse",
  "r2_account_id",
  "r2_access_key_id",
  "r2_secret_access_key",
  "r2_bucket",
  "r2_public_base_url",
] as const;

export type VaultProvider = (typeof VAULT_PROVIDERS)[number];

/** Canonical env var backing each provider (fallback source). */
export const VAULT_ENV_MAP: Record<VaultProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  meta_mms: "META_MMS_API_KEY",
  higgsfield: "HIGGSFIELD_API_KEY",
  modal: "MODAL_AUTH_TOKEN",
  meta_muse: "META_MUSE_API_KEY",
  r2_account_id: "R2_ACCOUNT_ID",
  r2_access_key_id: "R2_ACCESS_KEY_ID",
  r2_secret_access_key: "R2_SECRET_ACCESS_KEY",
  r2_bucket: "R2_BUCKET",
  r2_public_base_url: "R2_PUBLIC_BASE_URL",
};

/** Human label shown in Settings (never the value). */
export const VAULT_LABELS: Record<VaultProvider, string> = {
  anthropic: "Claude (Anthropic)",
  meta_mms: "Meta MMS (STT)",
  higgsfield: "Higgsfield (cover 4K)",
  modal: "Modal GPU (token)",
  meta_muse: "Meta Muse Voice (STT)",
  r2_account_id: "Cloudflare R2 — Account ID",
  r2_access_key_id: "Cloudflare R2 — Access Key ID",
  r2_secret_access_key: "Cloudflare R2 — Secret Access Key",
  r2_bucket: "Cloudflare R2 — Bucket",
  r2_public_base_url: "Cloudflare R2 — Public Base URL (optional)",
};

interface VaultBlob {
  iv: string;
  tag: string;
  data: string;
}

type VaultFile = Partial<Record<VaultProvider, VaultBlob>>;

function vaultDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production"
  );
  const base = isServerless ? (process.env.TMPDIR || "/tmp") : process.cwd();
  return path.join(base, ".vault");
}

function secretsPath(): string {
  return path.join(vaultDir(), "secrets.json");
}

function masterKey(): Buffer {
  const fromEnv = (process.env.VAULT_MASTER_KEY || "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
    return Buffer.from(fromEnv, "hex");
  }
  const keyPath = path.join(vaultDir(), ".key");
  try {
    if (existsSync(keyPath)) {
      const raw = readFileSync(keyPath, "utf8").trim();
      if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    }
    mkdirSync(vaultDir(), { recursive: true });
    const fresh = randomBytes(32).toString("hex");
    writeFileSync(keyPath, fresh + "\n", { mode: 0o600 });
    try {
      chmodSync(keyPath, 0o600);
    } catch {
      // ignore (non-POSIX FS)
    }
    return Buffer.from(fresh, "hex");
  } catch {
    // Last resort (ephemeral): vault unreadable → callers fall back to env.
    return randomBytes(32);
  }
}

function readVaultFile(): VaultFile {
  try {
    if (!existsSync(secretsPath())) return {};
    const parsed = JSON.parse(readFileSync(secretsPath(), "utf8")) as VaultFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeVaultFile(v: VaultFile): void {
  mkdirSync(vaultDir(), { recursive: true });
  writeFileSync(secretsPath(), JSON.stringify(v, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(secretsPath(), 0o600);
  } catch {
    // ignore
  }
}

function encrypt(plain: string): VaultBlob {
  const key = masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") };
}

function decrypt(blob: VaultBlob): string | null {
  try {
    const key = masterKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "hex"));
    decipher.setAuthTag(Buffer.from(blob.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function isVaultProvider(p: string): p is VaultProvider {
  return (VAULT_PROVIDERS as readonly string[]).includes(p);
}

/** Vault value only (null when absent/undecryptable). Never logs the value. */
export function getVaultSecret(provider: VaultProvider): string | null {
  const blob = readVaultFile()[provider];
  if (!blob) return null;
  const plain = decrypt(blob);
  return plain && plain.length > 0 ? plain : null;
}

/** Effective secret: vault wins, `.env.local`/env is the fallback. */
export function getSecret(provider: VaultProvider): string {
  return getVaultSecret(provider) || (process.env[VAULT_ENV_MAP[provider]] || "").trim();
}

/** Where the effective value currently comes from (never the value itself). */
export function secretSource(provider: VaultProvider): "vault" | "env" | null {
  if (getVaultSecret(provider)) return "vault";
  if ((process.env[VAULT_ENV_MAP[provider]] || "").trim().length > 0) return "env";
  return null;
}

export function setVaultSecret(provider: VaultProvider, apiKey: string): void {
  const v = (apiKey || "").trim();
  if (v.length < 8) throw new Error("API key too short (min 8 characters)");
  const file = readVaultFile();
  file[provider] = encrypt(v);
  writeVaultFile(file);
}

export function deleteVaultSecret(provider: VaultProvider): void {
  const file = readVaultFile();
  delete file[provider];
  writeVaultFile(file);
}

/** Status map for the Settings UI — booleans only, no secret material. */
export function vaultStatus(): Record<VaultProvider, { configured: boolean; source: "vault" | "env" | null }> {
  const out = {} as Record<VaultProvider, { configured: boolean; source: "vault" | "env" | null }>;
  for (const p of VAULT_PROVIDERS) {
    const source = secretSource(p);
    out[p] = { configured: source !== null, source };
  }
  return out;
}

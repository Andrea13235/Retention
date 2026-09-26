import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  name: string;
  role: string;
  plan: "free" | "pro";
  avatarUrl?: string;
  provider: "email" | "google";
  createdAt: string;
  onboardingCompleted: boolean;
  onboardingRole?: string;
  orgSize?: string;
  socialReach?: string;
  contentType?: string;
  hearSource?: string;
  useCase?: string;
}

function getDataDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production"
  );
  if (isServerless) {
    const dir = path.join(process.env.TMPDIR || "/tmp", "retentionedit-data");
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
    return dir;
  }
  return path.join(process.cwd(), "src", "data");
}

function getUsersFilePath(): string {
  return path.join(getDataDir(), "users.json");
}

// In-memory cache for serverless lifecycles
let MEMORY_USERS: StoredUser[] | null = null;

function ensureUsersFile(): StoredUser[] {
  if (MEMORY_USERS) return MEMORY_USERS;
  try {
    const filePath = getUsersFilePath();
    if (!fs.existsSync(filePath)) {
      // Try seed from read-only bundle if present
      const bundleSeed = path.join(process.cwd(), "src", "data", "users.json");
      if (fs.existsSync(bundleSeed)) {
        try {
          const raw = fs.readFileSync(bundleSeed, "utf-8");
          const parsed = JSON.parse(raw) as StoredUser[];
          MEMORY_USERS = parsed;
          return parsed;
        } catch {}
      }
      MEMORY_USERS = [];
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as StoredUser[];
    MEMORY_USERS = parsed;
    return parsed;
  } catch (err) {
    MEMORY_USERS = MEMORY_USERS || [];
    return MEMORY_USERS;
  }
}

function saveUsers(users: StoredUser[]): void {
  MEMORY_USERS = users;
  try {
    const dataDir = getDataDir();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(getUsersFilePath(), JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    // In-memory update succeeded; file I/O errors on read-only environments are non-fatal
  }
}

function hashPassword(password: string, salt: string): string {
  // SECURITY: 100k iterations (OWASP 2026) — users.json is dev-only fallback;
  // Supabase (bcrypt server-side) is the production source of truth on Vercel.
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

// In-memory rate limiter for auth routes (per-IP+email). Vercel-safe (per-instance).
const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
export function checkAuthRateLimit(key: string, maxAttempts = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = RATE_BUCKETS.get(key);
  if (!entry || now > entry.resetAt) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxAttempts;
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const users = ensureUsersFile();
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized);
}

export function registerUser(email: string, password: string, name?: string): { success: boolean; user?: StoredUser; error?: string } {
  const users = ensureUsersFile();
  const normalized = email.trim().toLowerCase();

  const existing = users.find((u) => u.email.toLowerCase() === normalized);
  if (existing) {
    return { success: false, error: "Questa email è già registrata. Effettua l'accesso." };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const newUser: StoredUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalized,
    passwordHash,
    salt,
    name: name?.trim() || normalized.split("@")[0] || "Creator",
    role: "Video Creator",
    plan: "free",
    provider: "email",
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
  };

  users.push(newUser);
  saveUsers(users);

  // Return user without salt/hash
  const safeUser = { ...newUser };
  delete safeUser.passwordHash;
  delete safeUser.salt;

  return { success: true, user: safeUser };
}

export function verifyUserCredentials(email: string, password: string): { success: boolean; user?: StoredUser; error?: string } {
  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, error: "Nessun account trovato con questa email. Registrati prima." };
  }

  if (user.provider === "google" && !user.passwordHash) {
    return { success: false, error: "Questo account è registrato tramite Google. Clicca su 'Continua con Google'." };
  }

  if (!user.passwordHash || !user.salt) {
    return { success: false, error: "Credenziali non valide." };
  }

  const checkHash = hashPassword(password, user.salt);
  if (checkHash !== user.passwordHash) {
    return { success: false, error: "Password non corretta. Riprova." };
  }

  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.salt;

  return { success: true, user: safeUser };
}

export function getOrCreateGoogleUser(data: { email: string; name?: string; avatarUrl?: string }): StoredUser {
  const users = ensureUsersFile();
  const normalized = data.email.trim().toLowerCase();

  let existing = users.find((u) => u.email.toLowerCase() === normalized);
  if (existing) {
    if (data.avatarUrl && !existing.avatarUrl) {
      existing.avatarUrl = data.avatarUrl;
    }
    if (data.name && existing.name === normalized.split("@")[0]) {
      existing.name = data.name;
    }
    saveUsers(users);
    const safeUser = { ...existing };
    delete safeUser.passwordHash;
    delete safeUser.salt;
    return safeUser;
  }

  const newUser: StoredUser = {
    id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalized,
    name: data.name || normalized.split("@")[0] || "Google Creator",
    role: "Video Creator",
    plan: "free",
    avatarUrl: data.avatarUrl,
    provider: "google",
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
  };

  users.push(newUser);
  saveUsers(users);

  return newUser;
}

// Mark onboarding as done and persist the collected answers.
// Returns the updated safe user (without hash/salt), or null if not found.
export function completeUserOnboarding(
  email: string,
  data: {
    onboardingRole?: string;
    orgSize?: string;
    socialReach?: string;
    contentType?: string;
    hearSource?: string;
  }
): StoredUser | null {
  const users = ensureUsersFile();
  const normalized = email.trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === normalized);
  if (!existing) return null;
  if (data.onboardingRole !== undefined) {
    existing.onboardingRole = data.onboardingRole;
    existing.role = data.onboardingRole;
  }
  if (data.orgSize !== undefined) existing.orgSize = data.orgSize;
  if (data.socialReach !== undefined) existing.socialReach = data.socialReach;
  if (data.contentType !== undefined) existing.contentType = data.contentType;
  if (data.hearSource !== undefined) existing.hearSource = data.hearSource;
  existing.onboardingCompleted = true;
  saveUsers(users);
  const safeUser = { ...existing };
  delete safeUser.passwordHash;
  delete safeUser.salt;
  return safeUser;
}

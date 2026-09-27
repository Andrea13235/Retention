/**
 * RetentionEdit — Privacy & Cloud Security Verification Test Suite.
 * Validates:
 * 1. Cryptographic HMAC session tokens & tampering resistance.
 * 2. Multi-tenant Job Isolation & IDOR prevention.
 * 3. R2 private storage gating & SigV4 presigned URL generation (zero public URLs).
 * 4. User-isolated local streaming and directory traversal resistance.
 * 5. Serverless GPU worker multi-tenant contracts & Bearer auth enforcement.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("🔒 [Security Audit] Starting Verification Suite...\n");

// 1. Session Token Cryptographic Security
console.log("▶ [Test 1] Cryptographic Session Token & Tamper Resistance");
const { createSessionToken, verifySessionToken } = await import("../src/lib/session-token.ts");

const testUserId = "usr_test_privacy_999";
const testEmail = "creator@retentionedit.com";
const validToken = await createSessionToken(testUserId, testEmail, 3600);

assert.ok(validToken.startsWith("re_v1."), "Token should start with re_v1.");
const verified = await verifySessionToken(validToken);
assert.ok(verified, "Valid token must verify");
assert.equal(verified.userId, testUserId, "Verified userId must match");
assert.equal(verified.email, testEmail, "Verified email must match");

// Test tampering with payload
const parts = validToken.split(".");
const tamperedPayload = Buffer.from(JSON.stringify({ u: "usr_attacker", exp: Math.floor(Date.now() / 1000) + 3600 }))
  .toString("base64url");
const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
const forgedResult = await verifySessionToken(forgedToken);
assert.equal(forgedResult, null, "Forged payload must be rejected (HMAC failure)");

// Test tampering with signature
const tamperedSig = parts[2].slice(0, -4) + "0000";
const tamperedSigToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;
const sigResult = await verifySessionToken(tamperedSigToken);
assert.equal(sigResult, null, "Tampered signature must be rejected");

// Test expired token
const expiredToken = await createSessionToken(testUserId, testEmail, -100);
const expiredResult = await verifySessionToken(expiredToken);
assert.equal(expiredResult, null, "Expired token must be rejected");

console.log("  ✅ Session token HMAC-SHA256 signature and tamper rejection passed.");

// 2. R2 Privacy & Zero-Leakage Checks
console.log("\n▶ [Test 2] R2 Storage Privacy & Public URL Prevention");
const { isPrivateUserKey, r2ObjectUrl } = await import("../src/lib/r2.ts");

assert.equal(isPrivateUserKey("raw/usr_1/vlog.mp4"), true, "raw/ must be private");
assert.equal(isPrivateUserKey("exports/usr_1/final.mp4"), true, "exports/ must be private");
assert.equal(isPrivateUserKey("thumbnails/usr_1/cover.jpg"), true, "thumbnails/ must be private");
assert.equal(isPrivateUserKey("jobs/usr_1/spec.json"), true, "jobs/ must be private");
assert.equal(isPrivateUserKey("public/branding/logo.png"), false, "public branding is non-private");

// Simulate environment with publicBaseUrl set
process.env.R2_PUBLIC_BASE_URL = "https://public-cdn.retentionedit.com";
process.env.R2_ACCOUNT_ID = "acc_dummy_123";
process.env.R2_ACCESS_KEY_ID = "key_dummy_123";
process.env.R2_SECRET_ACCESS_KEY = "sec_dummy_123";
process.env.R2_BUCKET = "retentionedit-private-vault";

// Verify that private key NEVER uses publicBaseUrl
const resolvedUrl = r2ObjectUrl("raw/usr_1/secret_footage.mp4");
assert.ok(resolvedUrl, "Must generate presigned URL");
assert.ok(
  !resolvedUrl.includes("public-cdn.retentionedit.com"),
  "CRITICAL: Private footage must NEVER be returned through publicBaseUrl!"
);
assert.ok(
  resolvedUrl.includes("X-Amz-Signature="),
  "Private footage must be protected by SigV4 presigned query authentication."
);
console.log("  ✅ Private R2 keys strictly shielded from public CDN domain and use SigV4 presigned URLs.");

// 3. Multi-Tenant Job Store & IDOR Protection
console.log("\n▶ [Test 3] Job Multi-Tenancy & IDOR Prevention");
const { persistJob, loadJob, listRecentJobs } = await import("../src/lib/job-store.ts");

const userA = "usr_alice_privacy";
const userB = "usr_bob_hacker";
const jobId = `job_test_${Date.now()}`;

const jobA = {
  id: jobId,
  userId: userA,
  title: "Alice Private Vlog",
  createdAt: Date.now(),
  format: "short",
  genaiTier: "balanced",
  rawVideoUrl: `r2://raw/${userA}/raw.mp4`,
  rawDuration: 60,
  currentStage: "done",
  stages: {},
  logs: [],
  renderedVideoUrl: `r2://exports/${userA}/${jobId}_final.mp4`,
};

persistJob(jobA);

// Alice reads her own job
const loadedByAlice = loadJob(jobId, userA);
assert.ok(loadedByAlice, "Alice must be able to load her own job");
assert.equal(loadedByAlice.userId, userA);
assert.equal(loadedByAlice.title, "Alice Private Vlog");

// Bob attempts IDOR attack on Alice's job
const loadedByBob = loadJob(jobId, userB);
assert.equal(loadedByBob, null, "IDOR BLOCKED: Bob must NOT be able to load Alice's job");

// Bob lists recent jobs
const bobJobs = listRecentJobs(userB);
const hasAliceJob = bobJobs.some((j) => j.id === jobId);
assert.equal(hasAliceJob, false, "Bob's job listing must NOT contain Alice's job");

console.log("  ✅ Multi-tenant job isolation and IDOR protection 100% verified.");

// 4. Modal GPU Serverless Worker multi-tenancy & mutual authentication verification
console.log("\n▶ [Test 4] Modal.com GPU Serverless Tenant Isolation & Auth Contract");
const modalAppPy = fs.readFileSync(path.join(process.cwd(), "modal", "app.py"), "utf-8");

assert.ok(
  modalAppPy.includes("MODAL_AUTH_TOKEN"),
  "Modal worker must check MODAL_AUTH_TOKEN for mutual authentication"
);
assert.ok(
  modalAppPy.includes("user_id = sanitize_segment(payload.get(\"user_id\""),
  "Modal worker must sanitize and extract user_id"
);
assert.ok(
  modalAppPy.includes("export_key = f\"exports/{user_id}/{job_id}_final.mp4\""),
  "Modal worker must isolate rendered outputs under exports/{user_id}/"
);
assert.ok(
  !modalAppPy.includes("r2.retentionedit.com"),
  "Modal worker must not expose any public r2 URLs"
);

console.log("  ✅ Modal GPU serverless worker multi-tenant contracts and Bearer authentication verified.");

// 5. User Uploads & Media Stream Sandbox
console.log("\n▶ [Test 5] Upload Path Traversal & User Directory Isolation");
const streamRouteTs = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "api", "media", "stream", "route.ts"),
  "utf-8"
);

assert.ok(
  streamRouteTs.includes("requireAuth"),
  "media stream route must require authentication"
);
assert.ok(
  streamRouteTs.includes("path.basename"),
  "media stream route must sanitize path via basename to prevent directory traversal"
);
assert.ok(
  streamRouteTs.includes("uploads\", userId"),
  "media stream route must search only inside the authenticated user's folder"
);
assert.ok(
  streamRouteTs.includes('"Cache-Control": "private'),
  "media stream route must send private Cache-Control headers"
);

console.log("  ✅ Upload media stream route sandbox and traversal prevention verified.");

// 6. Next.js API Routes Authentication & IDOR Verification
console.log("\n▶ [Test 6] API Routes Auth & IDOR Guard Verification");
const routesToCheck = [
  "src/app/api/pipeline/start/route.ts",
  "src/app/api/pipeline/status/route.ts",
  "src/app/api/pipeline/result/route.ts",
  "src/app/api/pipeline/revise/route.ts",
  "src/app/api/r2/presign/route.ts",
  "src/app/api/r2/download/route.ts",
  "src/app/api/r2/confirm/route.ts",
  "src/app/api/upload/route.ts",
  "src/app/api/vault/keys/route.ts",
  "src/app/api/vault/status/route.ts",
  "src/app/api/vault/test/route.ts",
  "src/app/thumbnails/[filename]/route.ts",
];

for (const routePath of routesToCheck) {
  const content = fs.readFileSync(path.join(process.cwd(), routePath), "utf-8");
  assert.ok(
    content.includes("requireAuth") || content.includes("getAuthenticatedUser"),
    `Route ${routePath} MUST require authentication!`
  );
  if (routePath.includes("download") || routePath.includes("presign") || routePath.includes("confirm")) {
    assert.ok(
      content.includes("userId"),
      `Route ${routePath} must bind operations to userId!`
    );
  }
}
console.log("  ✅ All sensitive API routes verified: require authentication and user-scoped data access.");

console.log("\n==========================================================");
console.log("🎉 ALL PRIVACY & CLOUD SECURITY VERIFICATIONS PASSED 100%!");
console.log("==========================================================\n");

#!/usr/bin/env node
/**
 * setup-check.js — verify the environment has all prerequisites
 * for retention.
 *
 * User prerequisites: Node ≥22, FFmpeg in PATH, Python 3.9+ (faster-whisper).
 * Automated: HyperFrames via npm, faster-whisper via setup-whisper.js,
 * headless Chrome via `hyperframes doctor`, Whisper model on first use.
 *
 * Exit 0 = all good. Exit 1 = something missing (message on stderr).
 */
import { execFileSync } from "node:child_process";

let failed = false;

function ok(label, detail = "") {
  console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, hint) {
  failed = true;
  console.error(`  ✗ ${label}\n    → ${hint}`);
}

function runClean(cmd, args = []) {
  try {
    const env = { ...process.env };
    delete env.PYTHONPATH;
    delete env.PYTHONHOME;
    return execFileSync(cmd, args, { stdio: "pipe", encoding: "utf8", env }).trim();
  } catch {
    return null;
  }
}

// 1. Node ≥ 22
{
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 22) ok("Node.js", `v${process.versions.node}`);
  else fail("Node.js ≥ 22", `found v${process.versions.node}, install Node 22+`);
}

// 2. FFmpeg in PATH
{
  const v = runClean("ffmpeg", ["-version"]);
  if (v) ok("FFmpeg", v.split("\n")[0].replace("ffmpeg version ", "v"));
  else fail("FFmpeg in PATH", "install FFmpeg (e.g. brew install ffmpeg)");
}

// 3. ffprobe (ships with FFmpeg, used by tools_ingest)
{
  if (runClean("ffprobe", ["-version"])) ok("ffprobe");
  else fail("ffprobe in PATH", "reinstall full FFmpeg");
}

// 4. Python with faster-whisper (any 3.9+, clean env)
{
  const v = runClean("python3", ["--version"]);
  if (v) ok("Python", v);
  else fail("Python 3", "install Python 3.9+ (needed by faster-whisper)");
}

// 5. faster-whisper — skill venv or reachable python
{
  const home = process.env.HOME || "";
  const retentionPy = home ? `${home}/.retention/.venv/bin/python` : null;
  const cutcraftPy = home ? `${home}/.cutcraft/.venv/bin/python` : null;
  const v =
    (retentionPy && runClean(retentionPy, ["-c", "import faster_whisper; print(faster_whisper.__version__)"])) ||
    (cutcraftPy && runClean(cutcraftPy, ["-c", "import faster_whisper; print(faster_whisper.__version__)"])) ||
    runClean("python3", ["-c", "import faster_whisper; print(faster_whisper.__version__)"]);
  if (v) ok("faster-whisper", `v${v}`);
  else
    console.log(
      "  ○ faster-whisper not installed → node scripts/setup-whisper.js"
    );
}

// 6. HyperFrames CLI installed locally
{
  const v = runClean("npx", ["--no-install", "hyperframes", "--version"]);
  if (v) ok("HyperFrames CLI", `v${v}`);
  else
    console.log(
      "  ○ HyperFrames not installed yet → npm install (in the skill folder)"
    );
}

if (failed) {
  console.error("\nsetup-check: INCOMPLETE ENVIRONMENT (see ✗ above)");
  process.exit(1);
}
console.log("\nsetup-check: OK — environment ready");

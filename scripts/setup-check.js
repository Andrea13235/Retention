#!/usr/bin/env node
/**
 * setup-check.js — verifica che l'ambiente abbia tutti i prerequisiti
 * della skill andrea-video-skill (§5 dello spec).
 *
 * Prerequisiti utente: Node ≥22, FFmpeg nel PATH, Python 3.9–3.12 (faster-whisper).
 * Automatizzato: HyperFrames via npm, faster-whisper via pip, Chrome headless
 * via `hyperframes doctor`, modello Whisper al primo uso.
 *
 * Exit 0 = tutto ok. Exit 1 = qualcosa manca (messaggio su stderr).
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
  else fail("Node.js ≥ 22", `trovato v${process.versions.node}, installa Node 22+`);
}

// 2. FFmpeg nel PATH
{
  const v = runClean("ffmpeg", ["-version"]);
  if (v) ok("FFmpeg", v.split("\n")[0].replace("ffmpeg version ", "v"));
  else fail("FFmpeg nel PATH", "installa FFmpeg (es. brew install ffmpeg)");
}

// 3. ffprobe (arriva con FFmpeg, serve a tools_ingest)
{
  if (runClean("ffprobe", ["-version"])) ok("ffprobe");
  else fail("ffprobe nel PATH", "reinstalla FFmpeg completo");
}

// 4. Python con faster-whisper (qualsiasi 3.9+, env pulito)
{
  const v = runClean("python3", ["--version"]);
  if (v) ok("Python", v);
  else fail("Python 3", "installa Python 3.9+ (serve a faster-whisper)");
}

// 5. faster-whisper — venv dedicato della skill o python raggiungibile
{
  const home = process.env.HOME || "";
  const venvPy = home ? `${home}/.andrea-video-skill/.venv/bin/python` : null;
  const v =
    (venvPy && runClean(venvPy, ["-c", "import faster_whisper; print(faster_whisper.__version__)"])) ||
    runClean("python3", ["-c", "import faster_whisper; print(faster_whisper.__version__)"]);
  if (v) ok("faster-whisper", `v${v}`);
  else
    console.log(
      "  ○ faster-whisper non installato → node scripts/setup-whisper.js"
    );
}

// 6. HyperFrames CLI installata localmente
{
  const v = runClean("npx", ["--no-install", "hyperframes", "--version"]);
  if (v) ok("HyperFrames CLI", `v${v}`);
  else
    console.log(
      "  ○ HyperFrames non ancora installato → npm install (nella cartella della skill)"
    );
}

if (failed) {
  console.error("\nsetup-check: AMBIENTE INCOMPLETO (vedi ✗ sopra)");
  process.exit(1);
}
console.log("\nsetup-check: OK — ambiente pronto");

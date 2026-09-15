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

function run(cmd, args = []) {
  try {
    return execFileSync(cmd, args, { stdio: "pipe", encoding: "utf8" }).trim();
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
  const v = run("ffmpeg", ["-version"]);
  if (v) ok("FFmpeg", v.split("\n")[0].replace("ffmpeg version ", "v"));
  else fail("FFmpeg nel PATH", "installa FFmpeg (es. brew install ffmpeg)");
}

// 3. ffprobe (arriva con FFmpeg, serve a tools_ingest)
{
  if (run("ffprobe", ["-version"])) ok("ffprobe");
  else fail("ffprobe nel PATH", "reinstalla FFmpeg completo");
}

// 4. Python 3.9–3.12 (solo per faster-whisper)
{
  const v = run("python3", ["--version"]);
  const m = v && v.match(/Python (\d+)\.(\d+)/);
  if (m) {
    const [_, major, minor] = m.map(Number);
    if (major === 3 && minor >= 9 && minor <= 12)
      ok("Python", v);
    else
      fail("Python 3.9–3.12", `trovato ${v}, faster-whisper richiede 3.9–3.12`);
  } else {
    fail("Python 3", "installa Python 3.9–3.12 (solo se usi faster-whisper)");
  }
}

// 5. faster-whisper (pip) — opzionale se si usa whisper.cpp
{
  const v = run("python3", ["-c", "import faster_whisper; print(faster_whisper.__version__)"]);
  if (v) ok("faster-whisper", `v${v}`);
  else
    console.log(
      "  ○ faster-whisper non installato (ok se usi whisper.cpp) → pip install -r requirements.txt"
    );
}

// 6. HyperFrames CLI installata localmente
{
  const v = run("npx", ["--no-install", "hyperframes", "--version"]);
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

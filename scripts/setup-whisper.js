#!/usr/bin/env node
/**
 * setup-whisper.js — create the skill's dedicated venv
 * (~/.retention/.venv) and install faster-whisper.
 * Idempotent: if the venv already exists with faster-whisper, does nothing.
 * Usage: node scripts/setup-whisper.js
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RETENTION_DIR = join(homedir(), ".retention");
const CUTCRAFT_DIR = join(homedir(), ".cutcraft");
// If .cutcraft/.venv already exists, reuse it; otherwise create .retention/.venv
const SKILL_DIR = existsSync(join(CUTCRAFT_DIR, ".venv")) ? CUTCRAFT_DIR : RETENTION_DIR;
const VENV = join(SKILL_DIR, ".venv");
const VENV_PY = join(VENV, "bin", "python");

function sh(cmd, args, opts = {}) {
  // Sterilized env: an inherited PYTHONPATH/PYTHONHOME (e.g. from another
  // venv) would install packages in the wrong place.
  const env = { ...process.env };
  delete env.PYTHONPATH;
  delete env.PYTHONHOME;
  delete env.VIRTUAL_ENV;
  return execFileSync(cmd, args, { stdio: "inherit", env, ...opts });
}

function quiet(cmd, args) {
  try {
    const env = { ...process.env };
    delete env.PYTHONPATH;
    delete env.PYTHONHOME;
    delete env.VIRTUAL_ENV;
    execFileSync(cmd, args, { stdio: "pipe", env });
    return true;
  } catch {
    return false;
  }
}

// faster-whisper already ready?
if (
  existsSync(VENV_PY) &&
  quiet(VENV_PY, ["-c", "import faster_whisper"])
) {
  console.log("setup-whisper: venv already ready →", VENV_PY);
  process.exit(0);
}

// Find a base python3 to create the venv
const bases = ["python3", "/opt/homebrew/bin/python3", "/usr/bin/python3"];
let base = null;
for (const b of bases) {
  try {
    execFileSync(b, ["-m", "venv", "--help"], { stdio: "pipe" });
    base = b;
    break;
  } catch {
    /* next */
  }
}
if (!base) {
  console.error("setup-whisper: no Python 3 with venv found — install Python 3.9+");
  process.exit(1);
}

console.log(`setup-whisper: creating venv with ${base} → ${VENV}`);
sh(base, ["-m", "venv", VENV]);
console.log("setup-whisper: installing faster-whisper (may take a few minutes)…");
sh(VENV_PY, ["-m", "pip", "install", "--upgrade", "pip"]);
sh(VENV_PY, ["-m", "pip", "install", "faster-whisper>=1.0.0"]);

if (!quiet(VENV_PY, ["-c", "import faster_whisper; print('ok')"])) {
  console.error("setup-whisper: installation failed");
  process.exit(1);
}
console.log("setup-whisper: OK — faster-whisper ready");

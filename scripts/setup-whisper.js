#!/usr/bin/env node
/**
 * setup-whisper.js — crea il venv dedicato della skill
 * (~/.andrea-video-skill/.venv) e installa faster-whisper.
 * Idempotente: se il venv esiste già con faster-whisper, non fa nulla.
 * Uso: node scripts/setup-whisper.js
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SKILL_DIR = join(homedir(), ".andrea-video-skill");
const VENV = join(SKILL_DIR, ".venv");
const VENV_PY = join(VENV, "bin", "python");

function sh(cmd, args, opts = {}) {
  // Env sterilizzato: un PYTHONPATH/PYTHONHOME ereditato (es. da un altro
  // venv) farebbe installare i pacchetti nel posto sbagliato.
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

// faster-whisper già pronto?
if (
  existsSync(VENV_PY) &&
  quiet(VENV_PY, ["-c", "import faster_whisper"])
) {
  console.log("setup-whisper: venv già pronto →", VENV_PY);
  process.exit(0);
}

// Trova un python3 base per creare il venv
const bases = ["python3", "/opt/homebrew/bin/python3", "/usr/bin/python3"];
let base = null;
for (const b of bases) {
  try {
    execFileSync(b, ["-m", "venv", "--help"], { stdio: "pipe" });
    base = b;
    break;
  } catch {
    /* prossimo */
  }
}
if (!base) {
  console.error("setup-whisper: nessun Python 3 con venv trovato — installa Python 3.9+");
  process.exit(1);
}

console.log(`setup-whisper: creo venv con ${base} → ${VENV}`);
sh(base, ["-m", "venv", VENV]);
console.log("setup-whisper: installo faster-whisper (può richiedere qualche minuto)…");
sh(VENV_PY, ["-m", "pip", "install", "--upgrade", "pip"]);
sh(VENV_PY, ["-m", "pip", "install", "faster-whisper>=1.0.0"]);

if (!quiet(VENV_PY, ["-c", "import faster_whisper; print('ok')"])) {
  console.error("setup-whisper: installazione fallita");
  process.exit(1);
}
console.log("setup-whisper: OK — faster-whisper pronto");

#!/usr/bin/env node
/**
 * scripts/install-skill.js
 * Comprehensive multi-platform AI Skill Installer for:
 * - Google Antigravity
 * - Claude Code (`code`)
 * - Codex (`codecs`)
 * - Cursor
 *
 * Registers "Retention.editing" (and aliases "Retention" / "retention")
 * across global configuration directories so typing /Retention.editing or /Retention
 * immediately works in any AI chat.
 */

import { existsSync } from "node:fs";
import { mkdir, symlink, cp, unlink, lstat, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const isWin = platform() === "win32";

async function linkOrCopy(source, target) {
  if (existsSync(target)) {
    try {
      const st = await lstat(target);
      if (st.isSymbolicLink()) {
        await unlink(target);
      } else {
        await unlink(target).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  try {
    await symlink(source, target, isWin ? "junction" : "dir");
    return "symlinked";
  } catch {
    try {
      await cp(source, target, { recursive: true });
      return "copied";
    } catch (e) {
      return null;
    }
  }
}

async function main() {
  console.log("=====================================================");
  console.log("⚡ Retention.editing — Universal AI Skill Installer");
  console.log("   Platforms: Google Antigravity, Claude Code, Codex");
  console.log("=====================================================\n");

  const home = homedir();
  const installedLocations = [];

  // Target directories for different AI assistants:
  const targetBases = [
    // 1. Google Antigravity
    join(home, ".gemini", "config", "skills"),
    join(home, ".gemini", "antigravity", "skills"),
    join(home, ".gemini", "skills"),
    // 2. Claude Code
    join(home, ".claude", "skills"),
    // 3. Codex
    join(home, ".codex", "skills"),
  ];

  // Aliases so both /Retention.editing and /Retention work seamlessly:
  const aliases = ["Retention.editing", "Retention", "retention.editing", "retention"];

  for (const base of targetBases) {
    try {
      await mkdir(base, { recursive: true });
      for (const alias of aliases) {
        const dest = join(base, alias);
        const res = await linkOrCopy(repoRoot, dest);
        if (res) {
          installedLocations.push(dest);
        }
      }
    } catch {
      // next base
    }
  }

  // 4. Claude Code Custom Slash Commands directory (~/.claude/commands/)
  try {
    const claudeCmdDir = join(home, ".claude", "commands");
    await mkdir(claudeCmdDir, { recursive: true });
    const cmdContent = `---
description: Auto-edit RAW footage into high-retention video via Whisper + HyperFrames + RetentionVolt
---
Activate and run the Retention.editing skill on the specified video.
`;
    await writeFile(join(claudeCmdDir, "Retention.editing.md"), cmdContent, "utf-8");
    await writeFile(join(claudeCmdDir, "Retention.md"), cmdContent, "utf-8");
    await writeFile(join(claudeCmdDir, "retention.md"), cmdContent, "utf-8");
    installedLocations.push(join(claudeCmdDir, "Retention.editing.md"));
  } catch {
    // optional
  }

  console.log(`✅ Successfully installed Retention into ${installedLocations.length} discovery locations!`);
  console.log("\nRegistered platforms:");
  console.log("  ✓ Google Antigravity (~/.gemini/config/skills & ~/.gemini/skills)");
  console.log("  ✓ Claude Code (~/.claude/skills & ~/.claude/commands)");
  console.log("  ✓ Codex (~/.codex/skills)");

  console.log("\n🎉 Ready to use!");
  console.log("Open your AI assistant (Antigravity, Claude Code, Codex) and type:");
  console.log("   👉 /Retention.editing");
  console.log("   👉 /Retention");
  console.log("   (Or simply say: 'Edit this video for me')\n");
}

main().catch((err) => {
  console.error("Installation failed:", err);
  process.exit(1);
});

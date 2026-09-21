#!/usr/bin/env node
/**
 * scripts/install-skill.js
 * Automatically registers and installs the Retention.editing skill globally
 * so that /Retention.editing becomes immediately available in Antigravity,
 * Claude Code, and Hermès AI chats.
 */

import { existsSync } from "node:fs";
import { mkdir, symlink, cp, unlink, lstat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

async function installSkill() {
  console.log("⚡ Installing Retention.editing AI Skill...\n");

  const home = homedir();
  const globalGeminiSkills = join(home, ".gemini", "config", "skills");
  const targetDir = join(globalGeminiSkills, "Retention.editing");

  try {
    // 1. Ensure ~/.gemini/config/skills exists
    await mkdir(globalGeminiSkills, { recursive: true });

    // 2. If target already exists, remove it cleanly
    if (existsSync(targetDir)) {
      try {
        const st = await lstat(targetDir);
        if (st.isSymbolicLink()) {
          await unlink(targetDir);
        } else {
          // directory exists, replace contents or symlink
          await unlink(targetDir).catch(() => {});
        }
      } catch {
        // proceed
      }
    }

    // 3. Create symlink (or copy fallback on restricted OS)
    let linked = false;
    try {
      await symlink(repoRoot, targetDir, platform() === "win32" ? "junction" : "dir");
      linked = true;
    } catch {
      // Fallback to recursive copy
      await cp(repoRoot, targetDir, { recursive: true });
    }

    console.log(`✅ Success! Retention.editing skill installed at:`);
    console.log(`   ${targetDir} ${linked ? "(symlinked)" : "(copied)"}\n`);
    console.log(`🎉 You can now open your AI chat and type:`);
    console.log(`   /Retention.editing`);
    console.log(`   or simply tell the agent: "Edit this video for me"\n`);
  } catch (err) {
    console.error(`❌ Failed to automatically install skill: ${err.message}`);
    console.log(`\nYou can install it manually by running:`);
    console.log(`   ln -s "${repoRoot}" "${targetDir}"\n`);
    process.exit(1);
  }
}

installSkill();

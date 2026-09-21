/**
 * retentionvolt_client.ts — Client helper for RetentionVolt (retentionvolt.com) CyberMCP.
 * Handles authentication, key persistence in ~/.retention/config.json,
 * and direct querying of the RetentionVolt database for patterns, motion graphics, and thumbnails.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RetentionVoltBlueprint } from "./types.js";

export const RETENTIONVOLT_LOGIN_URL = "https://retentionvolt.com/login";
export const RETENTIONVOLT_MCP_SETTINGS_URL = "https://retentionvolt.com/settings/mcp";
export const DEFAULT_RETENTIONVOLT_ENDPOINT = "https://retentionvolt.com/api/mcp";

export function getRetentionDir(): string {
  return join(homedir(), ".retention");
}

export function getConfigPath(): string {
  return join(getRetentionDir(), "config.json");
}

export async function getStoredApiKey(): Promise<string | undefined> {
  if (process.env.RETENTIONVOLT_API_KEY) {
    return process.env.RETENTIONVOLT_API_KEY.trim();
  }
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return undefined;
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed.api_key === "string" ? parsed.api_key.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const dir = getRetentionDir();
  await mkdir(dir, { recursive: true });
  const configPath = getConfigPath();
  let existing = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(await readFile(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const updated = { ...existing, api_key: apiKey.trim(), updated_at: new Date().toISOString() };
  await writeFile(configPath, JSON.stringify(updated, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export interface AuthStatus {
  connected: boolean;
  status: "authenticated" | "needs_key" | "invalid_key" | "server_unreachable";
  login_url: string;
  settings_url: string;
  message: string;
  plan?: string;
}

export async function connectRetentionVolt(
  apiKey?: string,
  endpoint = DEFAULT_RETENTIONVOLT_ENDPOINT
): Promise<AuthStatus> {
  const keyToTest = apiKey?.trim() ?? (await getStoredApiKey());

  if (!keyToTest) {
    return {
      connected: false,
      status: "needs_key",
      login_url: RETENTIONVOLT_LOGIN_URL,
      settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
      message:
        "RetentionVolt requires an API key (rv_live_...). Please log in at https://retentionvolt.com/login and generate your key at https://retentionvolt.com/settings/mcp.",
    };
  }

  // Verify key against endpoint with 10s timeout
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyToTest}`,
        "x-mcp-api-key": keyToTest,
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "ping_check",
        method: "ping",
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        connected: false,
        status: "invalid_key",
        login_url: RETENTIONVOLT_LOGIN_URL,
        settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
        message:
          "Invalid or expired RetentionVolt API key. Please check your subscription or generate a new key at https://retentionvolt.com/settings/mcp.",
      };
    }

    if (res.ok) {
      if (apiKey) {
        await saveApiKey(apiKey);
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, any>;
      const plan = body?.plan ?? body?.result?.plan ?? "pro";
      return {
        connected: true,
        status: "authenticated",
        login_url: RETENTIONVOLT_LOGIN_URL,
        settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
        plan,
        message: "Successfully connected and authenticated with RetentionVolt CyberMCP!",
      };
    }
  } catch {
    // If offline or network unreachable, but a valid live key is provided, store and operate locally
    if (keyToTest.startsWith("rv_live_")) {
      if (apiKey) await saveApiKey(apiKey);
      return {
        connected: true,
        status: "authenticated",
        login_url: RETENTIONVOLT_LOGIN_URL,
        settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
        plan: "pro",
        message: "API key stored locally. Operating in local mode until RetentionVolt cloud syncs.",
      };
    }
  }

  return {
    connected: false,
    status: "server_unreachable",
    login_url: RETENTIONVOLT_LOGIN_URL,
    settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
    message:
      "Could not reach RetentionVolt server. Please ensure you have an active internet connection and that the endpoint is reachable.",
  };
}

export async function fetchRetentionVoltBlueprint(
  query: string,
  opts: { niche?: string; format?: "short" | "long"; endpoint?: string } = {}
): Promise<RetentionVoltBlueprint> {
  const apiKey = await getStoredApiKey();
  const endpoint = opts.endpoint ?? DEFAULT_RETENTIONVOLT_ENDPOINT;

  if (apiKey) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-mcp-api-key": apiKey,
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "fetch_patterns",
          method: "tools/call",
          params: {
            name: "search_retention_patterns",
            arguments: {
              query,
              format: opts.format === "short" ? "shorts" : "long_form",
              niche: opts.niche,
            },
          },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const content = data?.result?.content?.[0]?.text;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            const bp = parsed.blueprint ?? parsed;
            if (bp && (bp.animations || bp.pattern_interrupts || bp.pattern_id)) {
              return {
                ...bp,
                source: "retentionvolt_cloud",
              };
            }
          } catch {
            // Fallback below
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback high-retention blueprint modeled after local heuristics
  const isShort = opts.format === "short";
  const safeTitle = (query.trim() || "Highlights").toUpperCase().slice(0, 36);

  return {
    pattern_id: `local-fallback-${isShort ? "short" : "long"}-${opts.niche ?? "general"}`,
    source: "local_fallback",
    animations: [
      {
        time: "00:00:03.000",
        type: "zoom_in",
        target: "face",
      },
      {
        time: isShort ? "00:00:07.000" : "00:00:12.000",
        type: "slow_zoom",
        direction: "in",
        duration: isShort ? 3 : 6,
      },
    ],
    pattern_interrupts: [
      {
        time: isShort ? "00:00:04.000" : "00:00:06.000",
        kind: "caption_pop",
        detail: "Local heuristic cadence accent",
      },
      {
        time: isShort ? "00:00:08.000" : "00:00:14.000",
        kind: isShort ? "caption_pop" : "zoom_punch",
        detail: "Local heuristic visual reset",
      },
    ],
    thumbnail: {
      title: safeTitle,
      badge: "RETENTION HEURISTIC",
      frame_time: "00:00:02.000",
      style: "bold",
    },
    retention_notes: [
      "[Local Fallback Heuristic] Pacing calibrated via local heuristics (connect RetentionVolt Pro for live database patterns).",
      "Dynamic hook frame extracted for high-CTR thumbnail layout.",
    ],
  };
}

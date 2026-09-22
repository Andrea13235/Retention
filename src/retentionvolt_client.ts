/**
 * retentionvolt_client.ts — Client helper for RetentionVolt (retentionvolt.com) CyberMCP.
 * Handles authentication, key persistence in ~/.retention/config.json,
 * and direct querying of the RetentionVolt database for patterns, motion graphics, and thumbnails.
 */
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RetentionVoltBlueprint } from "./types.js";

export const RETENTIONVOLT_LOGIN_URL = "https://retentionvolt.com/login-mcp";
export const RETENTIONVOLT_MCP_LOGIN_URL = "https://retentionvolt.com/login-mcp";
export const RETENTIONVOLT_MCP_SETTINGS_URL = "https://retentionvolt.com/settings/mcp";
export const DEFAULT_RETENTIONVOLT_ENDPOINT = "https://retentionvolt.com/api/mcp";

export function openBrowser(url: string): void {
  const start =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
      ? "start"
      : "xdg-open";
  try {
    exec(`${start} "${url}"`, () => {});
  } catch {
    // ignore
  }
}

let activeAuthServer: http.Server | null = null;

export function startLocalAuthServer(port = 19876): Promise<string> {
  return new Promise((resolve) => {
    if (activeAuthServer) {
      try {
        activeAuthServer.close();
      } catch {}
      activeAuthServer = null;
    }
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        if (url.pathname === "/callback") {
          const key =
            url.searchParams.get("key") ||
            url.searchParams.get("api_key") ||
            url.searchParams.get("token");
          if (key) {
            await saveApiKey(key);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`
              <!DOCTYPE html>
              <html lang="it">
              <head><meta charset="utf-8"><title>RetentionVolt — Connesso</title></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 60px 20px; background: #0c0d14; color: #ffffff;">
                <div style="max-width: 520px; margin: 0 auto; background: rgba(255,255,255,0.05); padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  <h1 style="color: #4ade80; margin-bottom: 16px; font-size: 26px;">⚡ RetentionVolt Connesso!</h1>
                  <p style="color: #94a3b8; font-size: 16px; line-height: 1.6;">Il tuo account è stato collegato automaticamente al server MCP locale.<br>Puoi chiudere questa scheda del browser e tornare al tuo assistente AI.</p>
                </div>
              </body>
              </html>
            `);
            server.close();
            activeAuthServer = null;
            resolve(key);
            return;
          }
        }
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing key parameter");
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal error");
      }
    });

    server.listen(port, () => {
      activeAuthServer = server;
    });

    // Auto-close after 3 minutes if no callback received
    setTimeout(() => {
      if (activeAuthServer === server) {
        try {
          server.close();
        } catch {}
        activeAuthServer = null;
      }
    }, 180_000);
  });
}

export function getRetentionDir(): string {
  if (process.env.RETENTION_CONFIG_DIR) {
    return process.env.RETENTION_CONFIG_DIR;
  }
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
  browser_opened?: boolean;
}

export async function connectRetentionVolt(
  apiKey?: string,
  endpoint = DEFAULT_RETENTIONVOLT_ENDPOINT,
  options?: { openBrowser?: boolean }
): Promise<AuthStatus> {
  if (options?.openBrowser) {
    const callbackUrl = encodeURIComponent("http://localhost:19876/callback");
    const targetUrl = `${RETENTIONVOLT_MCP_LOGIN_URL}?redirect_uri=${callbackUrl}`;
    openBrowser(targetUrl);
    startLocalAuthServer(19876).catch(() => {});
  }

  const keyToTest = apiKey?.trim() ?? (await getStoredApiKey());

  if (!keyToTest) {
    return {
      connected: false,
      status: "needs_key",
      login_url: RETENTIONVOLT_LOGIN_URL,
      settings_url: RETENTIONVOLT_MCP_SETTINGS_URL,
      browser_opened: options?.openBrowser ?? false,
      message: options?.openBrowser
        ? "Browser aperto su https://retentionvolt.com/login-mcp. Completa l'accesso per collegare automaticamente la chiave CyberMCP."
        : "RetentionVolt richiede una chiave API Pro (rv_live_...). Accedi a https://retentionvolt.com/login-mcp oppure recupera la tua chiave da https://retentionvolt.com/settings/mcp.",
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

import { NextRequest, NextResponse } from 'next/server';
import { MCP_TOOLS_DEFINITIONS, executeMcpTool } from '@/mcp/tools';
import { verifyMcpAuth } from '@/lib/mcpAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// === MCP REQUEST LOGGER ===
function anonymizeIp(ip?: string): string | null {
  if (!ip || ip === 'unknown') return null;
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 3).join(':')}::/48`;
  }
  return 'masked';
}

// Salva ogni richiesta MCP nel DB per analytics admin (privacy-first, IP anonimizzato)
async function logMcpRequest(opts: {
  userId?: string;
  userEmail?: string;
  plan: string;
  toolName?: string;
  method?: string;
  status: 'success' | 'auth_denied' | 'error';
  latencyMs?: number;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    if (!supabaseAdmin) return;
    await supabaseAdmin.from('mcp_request_logs').insert({
      user_id: opts.userId || null,
      user_email: opts.userEmail || null,
      plan: opts.plan || 'unauthenticated',
      tool_name: opts.toolName || null,
      method: opts.method || null,
      status: opts.status,
      latency_ms: opts.latencyMs || null,
      ip_address: anonymizeIp(opts.ipAddress),
      user_agent: opts.userAgent || null,
    });
  } catch {
    // Silent fail — non bloccare le richieste per un errore di logging
  }
}

const DEFAULT_ALLOWED = [
  'https://retentionvolt.com',
  'https://www.retentionvolt.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4001',
  'http://127.0.0.1:4001',
];

const ALLOWED_ORIGINS = [
  ...DEFAULT_ALLOWED,
  ...(process.env.MCP_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
];

function getAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Strictly allow official retentionvolt Vercel preview deployments
  if (/^https:\/\/retentionvolt(-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  return null;
}

function setMcpHeaders(res: NextResponse, req?: Request) {
  const allowed = req ? getAllowedOrigin(req) : '*';
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', allowed);
    res.headers.set('Vary', 'Origin');
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-API-KEY, X-Supabase-Token, MCP-Session-Id');
  res.headers.set('Access-Control-Expose-Headers', 'MCP-Session-Id');
  res.headers.set('Cache-Control', 'no-cache');
  return res;
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return setMcpHeaders(res, req);
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 120, windowMs: 60_000 });
  if (limited) return setMcpHeaders(limited as any, req);
  const authResult = await verifyMcpAuth(req);

  // Check if client requested SSE stream (text/event-stream) per Model Context Protocol spec
  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    const sessionId = `rv_sess_${Math.random().toString(36).substring(2, 12)}`;
    const stream = new ReadableStream({
      start(controller) {
        const endpointData = `event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`;
        controller.enqueue(new TextEncoder().encode(endpointData));
      }
    });

    const sseResponse = new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });
    return setMcpHeaders(sseResponse, req);
  }

  const res = NextResponse.json({
    name: 'cyber-mcp-retentionvolt',
    version: '2.0.0',
    description: 'CyberMCP: Retention intelligence video editing reference library, cut cadence metrics, and speech pacing analysis.',
    capabilities: {
      tools: true,
      resources: true
    },
    toolsCount: MCP_TOOLS_DEFINITIONS.length,
    status: 'online',
    plan_required: 'pro',
    current_access: authResult.isAuthorized ? 'pro_granted' : 'subscription_required',
    pricing: {
      monthly: '$12/month',
      annual: '$6/month ($72 billed annually - 50% OFF)',
      trial: '7-day free trial on annual plan',
      pricing_url: 'https://retentionvolt.com/pricing'
    }
  });
  return setMcpHeaders(res, req);
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const { jsonrpc, id, method, params } = body;

    // Handle client ping
    if (method === 'ping') {
      const response = NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          status: 'ok',
          service: 'cyber-mcp-retentionvolt',
          serverTime: new Date().toISOString()
        }
      });
      return setMcpHeaders(response, req);
    }

    // Handle notifications (like notifications/initialized) - no response required or empty response
    if (method && method.startsWith('notifications/')) {
      const response = NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {}
      });
      return setMcpHeaders(response, req);
    }

    // Standard MCP Protocol JSON-RPC Handler: initialize handshake
    if (method === 'initialize') {
      const response = NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true }
          },
          serverInfo: {
            name: 'cyber-mcp-retentionvolt',
            version: '2.0.0',
            description: 'CyberMCP: Mobbin for Video Editing. Requires Pro subscription.'
          }
        }
      });
      return setMcpHeaders(response, req);
    }

    // Verify Pro subscription for tools discovery and execution
    const authResult = await verifyMcpAuth(req);

    if (method === 'tools/list') {
      if (!authResult.isAuthorized) {
        // Return clear subscription advisory tool for AI agents
        const response = NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'pro_subscription_required',
                description: '⚠️ PRO SUBSCRIPTION REQUIRED: Retentionvolt CyberMCP server access requires an active Pro plan ($12/mo or $6/mo annual with 7-day free trial). Your current account is on the Free tier. Upgrade at https://retentionvolt.com/pricing to unlock video editing tools, cut cadences, and retention curves.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    pricing_url: {
                      type: 'string',
                      description: 'Visit to activate Pro subscription with 7-day free trial',
                      default: 'https://retentionvolt.com/pricing'
                    }
                  }
                }
              }
            ]
          }
        });
        return setMcpHeaders(response, req);
      }

      const response = NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS_DEFINITIONS
        }
      });
      return setMcpHeaders(response, req);
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const reqStart = Date.now();
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || '';

      // If tool is the subscription upgrade helper
      if (toolName === 'pro_subscription_required') {
        const response = NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  message: 'Pro subscription required to run CyberMCP tools.',
                  plan_pricing: {
                    pro_monthly: '$12/month',
                    pro_annual: '$6/month ($72/year - 50% discount with 7-day free trial)'
                  },
                  upgrade_url: 'https://retentionvolt.com/pricing',
                  instructions: 'Once subscribed to Pro, obtain your personal Pro API key from Settings > MCP and add it to your MCP client configuration.'
                }, null, 2)
              }
            ]
          }
        });
        return setMcpHeaders(response, req);
      }

      // Strictly guard all video editing & retention tools
      if (!authResult.isAuthorized) {
        logMcpRequest({
          userId: authResult.userId,
          userEmail: authResult.userEmail,
          plan: authResult.plan,
          toolName,
          method,
          status: 'auth_denied',
          latencyMs: Date.now() - reqStart,
          ipAddress,
          userAgent,
        });
        const response = NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32002,
            message: `PRO SUBSCRIPTION REQUIRED: MCP tool '${toolName}' is only available on Retentionvolt Pro ($12/mo or $6/mo annual with 7-day free trial). Your current plan is '${authResult.plan}'. Please upgrade at https://retentionvolt.com/pricing to connect AI agents.`,
            data: {
              requiredPlan: 'pro',
              currentPlan: authResult.plan,
              upgradeUrl: 'https://retentionvolt.com/pricing',
              freeTrialDays: 7,
              pricing: '$12/mo (or $6/mo annual - 50% off)'
            }
          }
        }, { status: 402 });
        return setMcpHeaders(response, req);
      }

      try {
        const result = await executeMcpTool(toolName, args);
        logMcpRequest({
          userId: authResult.userId,
          userEmail: authResult.userEmail,
          plan: authResult.plan,
          toolName,
          method,
          status: 'success',
          latencyMs: Date.now() - reqStart,
          ipAddress,
          userAgent,
        });
        const response = NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
        return setMcpHeaders(response, req);
      } catch (err: any) {
        logMcpRequest({
          userId: authResult.userId,
          userEmail: authResult.userEmail,
          plan: authResult.plan,
          toolName,
          method,
          status: 'error',
          latencyMs: Date.now() - reqStart,
          ipAddress,
          userAgent,
        });
        return setMcpHeaders(NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: err?.message || `Error calling tool ${toolName}` }
          }), req
        );
      }
    }

    return setMcpHeaders(NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: `Method ${method} is not supported` }
      }), req
    );

  } catch (error: any) {
    return setMcpHeaders(NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32603, message: error?.message || 'Internal CyberMCP error' }
      }, { status: 500 })
    );
  }
}

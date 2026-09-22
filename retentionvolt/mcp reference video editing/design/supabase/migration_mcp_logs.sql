-- ============================================================
-- RETENTIONVOLT — MCP REQUEST LOGS TABLE
-- Migration da eseguire su Supabase > SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS mcp_request_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT,                         -- Supabase user ID (se autenticato)
  user_email    TEXT,                         -- Email utente
  plan          TEXT        DEFAULT 'unauthenticated', -- 'free', 'pro', 'unauthenticated'
  tool_name     TEXT,                         -- Nome tool MCP (es. 'search_retention_patterns')
  method        TEXT,                         -- Metodo JSON-RPC (es. 'tools/call')
  status        TEXT        DEFAULT 'success', -- 'success', 'auth_denied', 'error'
  latency_ms    INT,                          -- Tempo di risposta in ms
  ip_address    TEXT,                         -- IP / IP hash del richiedente (privacy-safe)
  user_agent    TEXT,                         -- User Agent (es. Claude, Cursor, etc.)
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indici per query veloci nella admin dashboard
CREATE INDEX IF NOT EXISTS idx_mcp_logs_created  ON mcp_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_user     ON mcp_request_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_plan     ON mcp_request_logs(plan);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_status   ON mcp_request_logs(status);
CREATE INDEX IF NOT EXISTS idx_mcp_logs_tool     ON mcp_request_logs(tool_name);

-- Row Level Security
ALTER TABLE mcp_request_logs ENABLE ROW LEVEL SECURITY;

-- Solo il service role può leggere e scrivere (nessun accesso pubblico)
DROP POLICY IF EXISTS "Service role full access on mcp_request_logs" ON mcp_request_logs;
CREATE POLICY "Service role full access on mcp_request_logs"
  ON mcp_request_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- COMMENTO: Questa tabella viene popolata automaticamente dal
-- server MCP (src/app/api/mcp/route.ts) ogni volta che viene
-- ricevuta una richiesta di tool call. Non richiede configurazione
-- aggiuntiva — basta eseguire questa migration.
-- ============================================================

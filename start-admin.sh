#!/bin/bash
# ============================================================
# RETENTIONVOLT — Admin Dashboard Launcher (Local Only)
# ============================================================

set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ADMIN_DIR="$DIR/retentionvolt/mcp reference video editing/admin-dashboard"

if [ ! -d "$ADMIN_DIR" ]; then
  echo "❌ Cartella admin non trovata: $ADMIN_DIR" >&2
  exit 1
fi

echo "============================================================"
echo "🚀 Avvio Admin Dashboard RETENTIONVOLT (Locale)"
echo "📍 Porta: http://127.0.0.1:4001"
echo "🔐 Password in .env.local (ADMIN_SECRET)"
echo "============================================================"

# Controlla se la porta 4001 è già occupata
if lsof -Pi :4001 -sTCP:LISTEN -t >/dev/null ; then
  echo "⚡ Il server è già in esecuzione sulla porta 4001!"
else
  echo "📦 Avvio del server..."
  cd "$ADMIN_DIR"
  npm run dev &
  sleep 4
fi

echo "🌐 Apertura nel browser..."
open "http://127.0.0.1:4001"

echo "✅ Pronto! Premi CTRL+C nel terminale dove gira il server per fermarlo."

# Admin / Backend Analisi — Guida Hosting Sicuro

## Risposta breve alla tua domanda
> È più sicuro hostarlo dal mio PC?

**Sì, per ora è la scelta più sicura**, con un sottodominio privato come seconda opzione.
`/admin` sul sito pubblico è la peggiore (esponi Stripe + Supabase admin su stesso dominio del pubblico).

## Opzioni

### Opzione A — Locale (consigliata per ora, 0 rischio esposizione)
```bash
cd "mcp reference video editing/admin-dashboard"
cp .env.vault.example .env.local  # compila i secret veri
npm install && npm run dev  # http://localhost:4001
```
- Accesso solo dal tuo Mac. Per accesso da remoto: `ssh -L 4001:localhost:4001 tuo-server` o Tailscale/WireGuard.
- Nessun secret su Vercel, nessun endpoint pubblico da attaccare.
- Pro: massima sicurezza, zero costi. Contro: devi tenere il Mac acceso.

### Opzione B — Sottodominio privato (quando vuoi accesso ovunque)
1. Crea **progetto Vercel separato** `retentionvolt-admin` (non `design`).
2. Deploya `admin-dashboard/` su `admin.retentionvolt.com` (o `admin.design-six-green.vercel.app` temporaneo).
3. Su Vercel: **Settings > Deployment Protection > Standard Protection** (password) + IP Allowlist.
4. Metti env su quel progetto soltanto (ADMIN_SECRET forte, SUPABASE_SERVICE_ROLE, STRIPE_SECRET).
5. DNS: Vercel > Domains > Add `admin.retentionvolt.com`.
6. Aggiungi su `admin-dashboard/vercel.json`:
```json
{ "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }] }
```

### Opzione C — /admin sullo stesso sito (sconsigliata)
Se proprio vuoi `/admin` sullo stesso Vercel, il middleware già blocca con `ADMIN_SECRET`, ma:
- Stesso runtime del pubblico = più superficie d'attacco
- Un bug nel sito pubblico può esporre l'admin
- Evita.

## Fix già applicati nel codice
- `ADMIN_SECRET` senza fallback `retentionvolt_admin_2026` — se manca, admin bloccato (fail closed)
- Cookie `admin_token` con `httpOnly + secure (prod) + sameSite: strict + 8h`
- Security headers (`X-Frame-Options: DENY` ecc.) su entrambi i progetti

## Checklist prima di mettere in prod
- [ ] `ADMIN_SECRET` generato con `openssl rand -base64 32`, messo su Vercel (Production + Preview se vuoi testare)
- [ ] `next.config.js` headers già presenti (fatto)
- [ ] Vercel Protection attiva su progetto admin (Opzione B)
- [ ] `robots.txt` noindex su admin
